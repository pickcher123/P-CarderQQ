'use client';

export * from 'firebase/firestore';

import {
  addDoc as fbAddDoc,
  setDoc as fbSetDoc,
  updateDoc as fbUpdateDoc,
  deleteDoc as fbDeleteDoc,
  writeBatch as fbWriteBatch,
  runTransaction as fbRunTransaction,
  getDoc as fbGetDoc,
  doc as fbDoc,
  type CollectionReference,
  type DocumentReference,
  type DocumentData,
  type Firestore,
  type SetOptions,
  type UpdateData,
  type WriteBatch,
  type Transaction,
  type TransactionOptions,
} from 'firebase/firestore';

import {
  buildSemanticAuditInfo,
  COLLECTION_META,
  extractTargetName,
  hasCachedCardMeta,
  recordAdminActivityLog,
  registerCardMeta,
  resolveCurrentOperator,
  type AuditRiskTag,
  type AuditSeverity,
  type FieldChangeItem,
} from '@/lib/admin-audit';

const CREATOR_TRACKED_COLLECTIONS = new Set([
  'allCards',
  'cardPools',
  'luckBags',
  'group_breaks',
]);

function attachOperatorAttribution<T>(
  collectionName: string,
  op: 'create' | 'update',
  data: T
): T {
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    !CREATOR_TRACKED_COLLECTIONS.has(collectionName) ||
    shouldSkipAudit(collectionName)
  ) {
    return data;
  }

  const operator = resolveCurrentOperator();
  if (!operator.uid || operator.uid === 'unknown') {
    return data;
  }

  const record = data as Record<string, any>;
  if (op === 'create') {
    return {
      ...record,
      createdByUid: record.createdByUid || operator.uid,
      createdByEmail: record.createdByEmail || operator.email,
      createdByName: record.createdByName || operator.name,
      createdByRole: record.createdByRole || (operator.isSuperAdmin ? '最高主管' : '管理員'),
    } as T;
  }

  return {
    ...record,
    updatedByUid: operator.uid,
    updatedByEmail: operator.email,
    updatedByName: operator.name,
  } as T;
}

function getPathSegments(path: string): { collectionName: string; docId: string } {
  const parts = path.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return {
      collectionName: parts[parts.length - 2],
      docId: parts[parts.length - 1],
    };
  }
  return {
    collectionName: parts[0] || 'unknown',
    docId: '',
  };
}

function shouldSkipAudit(collectionName: string): boolean {
  if (typeof window === 'undefined') return true;
  if (collectionName === 'activityLogs') return true;
  const pathname = window.location.pathname;
  if (pathname.startsWith('/admin')) return false;
  // 命運大轉盤支援管理員開啟前台視窗 (/lucky-wheel) 編輯配置，Firestore Rules 僅限管理員寫入
  if (collectionName === 'lucky_wheels') return false;
  return true;
}

async function safeFetchBeforeSnapshot(ref: DocumentReference<any, any>): Promise<Record<string, any> | null> {
  try {
    const snap = await Promise.race([
      fbGetDoc(ref),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
    if (snap && snap.exists()) {
      const data = snap.data() as Record<string, any>;
      const { collectionName, docId } = getPathSegments(ref.path);
      if (collectionName === 'allCards' && docId) {
        registerCardMeta(docId, data);
      }
      return data;
    }
  } catch {
    // ignore snapshot read errors
  }
  return null;
}

// 從卡池、福袋、拼卡的變更資料中擷取關聯 cardId，於背景預熱名稱與市值快取，讓稽核日誌直接顯示「卡片名稱 ($市值)」
function collectReferencedCardIds(obj?: Record<string, any> | null): string[] {
  if (!obj || typeof obj !== 'object') return [];
  const ids: string[] = [];
  const pushId = (v: any) => {
    if (typeof v === 'string' && v.trim() && v.length <= 128 && !v.includes('/')) {
      ids.push(v.trim());
    }
  };

  if (typeof obj.lastPrizeCardId === 'string') pushId(obj.lastPrizeCardId);

  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('cardRarities.')) {
      pushId(k.slice('cardRarities.'.length));
    } else if (k.startsWith('prizes.') && typeof v === 'string') {
      pushId(v);
    }
  }

  if (obj.prizes && typeof obj.prizes === 'object') {
    pushId(obj.prizes.first);
    pushId(obj.prizes.second);
    pushId(obj.prizes.third);
  }

  if (Array.isArray(obj.otherPrizes)) {
    for (const p of obj.otherPrizes) {
      if (p?.cardId) pushId(p.cardId);
    }
  }

  if (Array.isArray(obj.cards)) {
    for (const c of obj.cards) {
      if (c?.cardId) pushId(c.cardId);
    }
  } else if (obj.cards && Array.isArray(obj.cards._elements)) {
    for (const el of obj.cards._elements) {
      if (el?.cardId) pushId(el.cardId);
    }
  }

  for (const listKey of ['allCardIds', 'soldCardIds'] as const) {
    const fieldVal = obj[listKey];
    if (Array.isArray(fieldVal)) {
      fieldVal.slice(0, 20).forEach(pushId);
    } else if (fieldVal && Array.isArray(fieldVal._elements)) {
      fieldVal._elements.forEach(pushId);
    }
  }

  if (obj.cardRarities && typeof obj.cardRarities === 'object' && !obj.cardRarities._methodName) {
    Object.keys(obj.cardRarities).slice(0, 20).forEach(pushId);
  }

  return ids;
}

async function warmCardMetaForAudit(
  firestore: Firestore,
  collectionName: string,
  beforeData?: Record<string, any> | null,
  afterData?: Record<string, any> | null
): Promise<void> {
  if (
    collectionName !== 'cardPools' &&
    collectionName !== 'luckBags' &&
    collectionName !== 'betting-items'
  ) {
    return;
  }

  try {
    // 優先解析本次寫入 (afterData) 的卡片 ID，再補充變更前 (beforeData) 的卡片 ID
    const candidates = [
      ...collectReferencedCardIds(afterData),
      ...collectReferencedCardIds(beforeData),
    ];
    const uncached = Array.from(new Set(candidates))
      .filter((id) => !hasCachedCardMeta(id))
      .slice(0, 16);

    if (uncached.length === 0) return;

    await Promise.race([
      Promise.all(
        uncached.map(async (cardId) => {
          try {
            const snap = await fbGetDoc(fbDoc(firestore, 'allCards', cardId));
            if (snap.exists()) {
              registerCardMeta(cardId, snap.data() as Record<string, any>);
            }
          } catch {
            // ignore single card lookup failure
          }
        })
      ),
      new Promise<void>((resolve) => setTimeout(() => resolve(), 900)),
    ]);
  } catch {
    // ignore cache warm errors
  }
}

export const addDoc: typeof fbAddDoc = async <AppModelType, DbModelType extends DocumentData>(
  reference: CollectionReference<AppModelType, DbModelType>,
  data: any
): Promise<DocumentReference<AppModelType, DbModelType>> => {
  const parts = reference.path.split('/').filter(Boolean);
  const collectionName = parts[parts.length - 1] || reference.id;
  const enrichedData = attachOperatorAttribution(collectionName, 'create', data);

  const docRef = await fbAddDoc(reference, enrichedData);

  if (!shouldSkipAudit(collectionName)) {
    void (async () => {
      await warmCardMetaForAudit(reference.firestore, collectionName, null, enrichedData as Record<string, any>);
      const info = buildSemanticAuditInfo({
        collectionName,
        docId: docRef.id,
        op: 'create',
        beforeData: null,
        afterData: enrichedData as Record<string, any>,
      });

      await recordAdminActivityLog(reference.firestore, {
        module: info.module,
        moduleLabel: info.moduleLabel,
        operationType: info.operationType,
        severity: info.severity,
        riskTags: info.riskTags,
        action: info.action,
        targetCollection: collectionName,
        targetId: docRef.id,
        targetName: info.targetName,
        details: info.details,
        changes: info.changes,
      });
    })();
  }

  return docRef;
};

export async function setDoc<AppModelType, DbModelType extends DocumentData>(
  reference: DocumentReference<AppModelType, DbModelType>,
  data: any,
  options?: SetOptions
): Promise<void> {
  const { collectionName, docId } = getPathSegments(reference.path);
  const skip = shouldSkipAudit(collectionName);
  const beforeData = !skip ? await safeFetchBeforeSnapshot(reference) : null;
  const isUpdate = Boolean(beforeData);
  const enrichedData = !skip
    ? attachOperatorAttribution(collectionName, isUpdate ? 'update' : 'create', data)
    : data;

  if (options) {
    await fbSetDoc(reference, enrichedData, options);
  } else {
    await fbSetDoc(reference, enrichedData);
  }

  if (!skip) {
    void (async () => {
      await warmCardMetaForAudit(
        reference.firestore,
        collectionName,
        beforeData,
        enrichedData as Record<string, any>
      );
      const info = buildSemanticAuditInfo({
        collectionName,
        docId,
        op: isUpdate ? 'update' : 'create',
        beforeData,
        afterData: enrichedData as Record<string, any>,
      });

      await recordAdminActivityLog(reference.firestore, {
        module: info.module,
        moduleLabel: info.moduleLabel,
        operationType: info.operationType,
        severity: info.severity,
        riskTags: info.riskTags,
        action: info.action,
        targetCollection: collectionName,
        targetId: docId,
        targetName: info.targetName,
        details: info.details,
        changes: info.changes,
      });
    })();
  }
}

export async function updateDoc<AppModelType, DbModelType extends DocumentData>(
  reference: DocumentReference<AppModelType, DbModelType>,
  fieldOrData: any,
  ...moreFieldsAndValues: any[]
): Promise<void> {
  const { collectionName, docId } = getPathSegments(reference.path);
  const skip = shouldSkipAudit(collectionName);
  const beforeData = !skip ? await safeFetchBeforeSnapshot(reference) : null;

  let patchObj: Record<string, any> = {};
  if (typeof fieldOrData === 'string') {
    patchObj[fieldOrData] = moreFieldsAndValues[0];
    for (let i = 1; i < moreFieldsAndValues.length; i += 2) {
      const k = moreFieldsAndValues[i];
      if (typeof k === 'string') {
        patchObj[k] = moreFieldsAndValues[i + 1];
      }
    }
    await (fbUpdateDoc as any)(reference, fieldOrData, ...moreFieldsAndValues);
  } else {
    const enrichedFieldOrData = !skip
      ? attachOperatorAttribution(collectionName, 'update', fieldOrData || {})
      : fieldOrData || {};
    patchObj = enrichedFieldOrData as Record<string, any>;
    await fbUpdateDoc(reference, enrichedFieldOrData as UpdateData<DbModelType>);
  }

  if (!skip) {
    void (async () => {
      await warmCardMetaForAudit(reference.firestore, collectionName, beforeData, patchObj);
      const info = buildSemanticAuditInfo({
        collectionName,
        docId,
        op: 'update',
        beforeData,
        afterData: patchObj,
      });

      await recordAdminActivityLog(reference.firestore, {
        module: info.module,
        moduleLabel: info.moduleLabel,
        operationType: info.operationType,
        severity: info.severity,
        riskTags: info.riskTags,
        action: info.action,
        targetCollection: collectionName,
        targetId: docId,
        targetName: info.targetName,
        details: info.details,
        changes: info.changes,
      });
    })();
  }
}

export const deleteDoc: typeof fbDeleteDoc = async <AppModelType, DbModelType extends DocumentData>(
  reference: DocumentReference<AppModelType, DbModelType>
): Promise<void> => {
  const { collectionName, docId } = getPathSegments(reference.path);
  const skip = shouldSkipAudit(collectionName);
  const beforeData = !skip ? await safeFetchBeforeSnapshot(reference) : null;

  await fbDeleteDoc(reference);

  if (!skip) {
    void (async () => {
      await warmCardMetaForAudit(reference.firestore, collectionName, beforeData, null);
      const info = buildSemanticAuditInfo({
        collectionName,
        docId,
        op: 'delete',
        beforeData,
        afterData: null,
      });

      await recordAdminActivityLog(reference.firestore, {
        module: info.module,
        moduleLabel: info.moduleLabel,
        operationType: 'delete',
        severity: 'critical',
        riskTags: info.riskTags,
        action: info.action,
        targetCollection: collectionName,
        targetId: docId,
        targetName: info.targetName,
        details: info.details,
        changes: info.changes,
      });
    })();
  }
};

interface RecordedMutation {
  ref: DocumentReference<any, any>;
  collectionName: string;
  docId: string;
  op: 'create' | 'update' | 'delete';
  data?: Record<string, any>;
}

async function flushGroupedMutations(
  firestore: Firestore,
  mutations: RecordedMutation[],
  beforeMap: Map<string, Record<string, any> | null>
) {
  const valid = mutations.filter((m) => !shouldSkipAudit(m.collectionName));
  if (valid.length === 0) return;

  // 特例 0：福袋指定中獎號碼開獎與派發獎品 (同時異動 luckBags + userCards / transactions / users)
  const luckBagMut = valid.find((m) => m.collectionName === 'luckBags');
  if (luckBagMut && valid.length > 1) {
    const beforeBag = beforeMap.get(luckBagMut.ref.path) || null;
    await warmCardMetaForAudit(firestore, 'luckBags', beforeBag, luckBagMut.data);
    const info = buildSemanticAuditInfo({
      collectionName: 'luckBags',
      docId: luckBagMut.docId,
      op: luckBagMut.op,
      beforeData: beforeBag,
      afterData: luckBagMut.data,
    });
    const dispatchedCards = valid.filter((m) => m.collectionName === 'userCards').length;
    const dispatchedPoints = valid.filter((m) => m.collectionName === 'users').length;

    await recordAdminActivityLog(firestore, {
      module: 'lucky-bags',
      moduleLabel: '福袋與轉盤',
      operationType: 'probability_change',
      severity: 'critical',
      riskTags: ['prob_tamper'],
      action: '🎯 福袋手動指定號碼開獎與派獎',
      targetCollection: 'luckBags',
      targetId: luckBagMut.docId,
      targetName: info.targetName,
      details: `${info.details}（共派發 ${dispatchedCards} 張卡片獎項、${dispatchedPoints} 筆點數獎勵）`,
      changes: info.changes,
      batchCount: valid.length,
    });
    return;
  }

  // 特例 1：管理員調整點數 (users 更新 + transactions 建立) -> 合併為一筆精準的點數稽核紀錄
  const userMut = valid.find((m) => m.collectionName === 'users');
  const txMut = valid.find((m) => m.collectionName === 'transactions');
  if (userMut && txMut && valid.length <= 3) {
    const beforeUser = beforeMap.get(userMut.ref.path) || null;
    const info = buildSemanticAuditInfo({
      collectionName: 'users',
      docId: userMut.docId,
      op: 'update',
      beforeData: beforeUser,
      afterData: userMut.data,
    });
    const txReason = txMut.data?.details ? `（備註：${txMut.data.details}）` : '';

    await recordAdminActivityLog(firestore, {
      module: 'points',
      moduleLabel: '點數與帳務',
      operationType: 'points',
      severity: 'critical',
      action: info.action,
      targetCollection: 'users',
      targetId: userMut.docId,
      targetName: info.targetName,
      details: `${info.details}${txReason}`,
      changes: info.changes,
    });
    return;
  }

  // 特例 2：管理員變更角色與模組權限 (同時寫入 users/{id} 與 admins/{id} / admins/{email})
  const hasAdminsWrite = valid.some((m) => m.collectionName === 'admins');
  if (hasAdminsWrite && valid.every((m) => m.collectionName === 'users' || m.collectionName === 'admins')) {
    const primary = userMut || valid[0];
    const beforeSnap = beforeMap.get(primary.ref.path) || null;
    const isRevoke = valid.some((m) => m.collectionName === 'admins' && m.op === 'delete');
    const info = buildSemanticAuditInfo({
      collectionName: primary.collectionName,
      docId: primary.docId,
      op: isRevoke ? 'delete' : primary.op,
      beforeData: beforeSnap,
      afterData: primary.data,
    });

    await recordAdminActivityLog(firestore, {
      module: 'permissions',
      moduleLabel: '管理員權限',
      operationType: 'permission',
      severity: 'critical',
      action: isRevoke ? '解除管理員角色與後台權限' : info.action,
      targetCollection: primary.collectionName,
      targetId: primary.docId,
      targetName: info.targetName,
      details: isRevoke
        ? `解除「${info.targetName || primary.docId}」的管理員後台權限`
        : info.details,
      changes: info.changes,
    });
    return;
  }

  // 特例 3：拼卡獎池新增/移除卡片並同步更新 allCards 狀態 (betting-items + allCards)
  const bettingMut = valid.find((m) => m.collectionName === 'betting-items');
  if (
    bettingMut &&
    valid.every((m) => m.collectionName === 'betting-items' || m.collectionName === 'allCards')
  ) {
    const beforeBetting = beforeMap.get(bettingMut.ref.path) || null;
    await warmCardMetaForAudit(firestore, 'betting-items', beforeBetting, bettingMut.data);
    const info = buildSemanticAuditInfo({
      collectionName: 'betting-items',
      docId: bettingMut.docId,
      op: bettingMut.op,
      beforeData: beforeBetting,
      afterData: bettingMut.data,
    });

    await recordAdminActivityLog(firestore, {
      module: info.module,
      moduleLabel: info.moduleLabel,
      operationType: info.operationType,
      severity: info.severity,
      riskTags: info.riskTags,
      action: info.action,
      targetCollection: 'betting-items',
      targetId: bettingMut.docId,
      targetName: info.targetName,
      details: info.details,
      changes: info.changes,
      batchCount: valid.length,
    });
    return;
  }

  // 單筆寫入直接走標準語意解析
  if (valid.length === 1) {
    const m = valid[0];
    const beforeSnap = beforeMap.get(m.ref.path) || null;
    await warmCardMetaForAudit(firestore, m.collectionName, beforeSnap, m.data);
    const info = buildSemanticAuditInfo({
      collectionName: m.collectionName,
      docId: m.docId,
      op: m.op,
      beforeData: beforeSnap,
      afterData: m.data,
    });

    await recordAdminActivityLog(firestore, {
      module: info.module,
      moduleLabel: info.moduleLabel,
      operationType: info.operationType,
      severity: info.severity,
      riskTags: info.riskTags,
      action: info.action,
      targetCollection: m.collectionName,
      targetId: m.docId,
      targetName: info.targetName,
      details: info.details,
      changes: info.changes,
    });
    return;
  }

  // 多筆批次寫入 (例如批次上傳卡片、批次修改價格、批次刪除、批次修改排序)
  const primaryCol = valid[0].collectionName;
  const meta = COLLECTION_META[primaryCol] || {
    module: 'system',
    moduleLabel: '後台批次維護',
    entityLabel: primaryCol,
    defaultSeverity: 'warning' as AuditSeverity,
  };

  const hasDelete = valid.some((m) => m.op === 'delete');
  const allCreate = valid.every((m) => m.op === 'create');
  const batchRiskTags = new Set<AuditRiskTag>();

  if (
    allCreate &&
    (primaryCol === 'allCards' || primaryCol === 'cardPools' || primaryCol === 'luckBags')
  ) {
    batchRiskTags.add('card_pool_create');
  }
  if (hasDelete && (primaryCol === 'allCards' || primaryCol === 'cardPools')) {
    batchRiskTags.add('stock_change');
  }

  const batchItems = valid.map((m) => {
    const beforeSnap = beforeMap.get(m.ref.path);
    const label = extractTargetName(m.data, '') || extractTargetName(beforeSnap, '') || m.docId;
    const priceSuffix =
      typeof m.data?.sellPrice === 'number'
        ? ` ($${m.data.sellPrice.toLocaleString()})`
        : typeof m.data?.price === 'number'
        ? ` ($${m.data.price.toLocaleString()})`
        : '';
    return `${m.op === 'delete' ? '🗑️' : m.op === 'create' ? '➕' : '✏️'} ${label}${priceSuffix}`;
  });

  // 彙整前 12 筆變更至對照表並收集風險標籤
  const aggregatedChanges: FieldChangeItem[] = [];
  let hasBatchCritical = hasDelete;

  for (const m of valid.slice(0, 12)) {
    const beforeSnap = beforeMap.get(m.ref.path) || null;
    const itemInfo = buildSemanticAuditInfo({
      collectionName: m.collectionName,
      docId: m.docId,
      op: m.op,
      beforeData: beforeSnap,
      afterData: m.data,
    });
    itemInfo.riskTags.forEach((t) => batchRiskTags.add(t));
    if (itemInfo.severity === 'critical') hasBatchCritical = true;

    for (const c of itemInfo.changes.slice(0, 2)) {
      aggregatedChanges.push({
        field: `${m.docId}.${c.field}`,
        fieldLabel: `[${itemInfo.targetName || m.docId.slice(0, 6)}] ${c.fieldLabel}`,
        before: c.before,
        after: c.after,
      });
    }
  }

  let opVerb = hasDelete ? '🗑️ 批次刪除/異動' : allCreate ? '➕ 批次新增' : '✏️ 批次更新';
  let finalOpType: 'batch' | 'price_change' | 'probability_change' = 'batch';
  if (batchRiskTags.has('price_tamper')) {
    opVerb = '💰 批次變更價格 / 市值 — ';
    finalOpType = 'price_change';
  } else if (batchRiskTags.has('prob_tamper')) {
    opVerb = '🎲 批次調整機率 / 獎項 — ';
    finalOpType = 'probability_change';
  }

  const action = `${opVerb}${meta.entityLabel} (${valid.length} 筆)`;
  const operator = resolveCurrentOperator();
  const batchCreatorPrefix =
    allCreate && CREATOR_TRACKED_COLLECTIONS.has(primaryCol) && operator.name
      ? `新增人員：${operator.name}${
          operator.email && operator.email !== '未知信箱' ? ` (${operator.email})` : ''
        } ｜ `
      : '';

  await recordAdminActivityLog(firestore, {
    module: meta.module,
    moduleLabel: meta.moduleLabel,
    operationType: finalOpType,
    severity: hasBatchCritical ? 'critical' : 'warning',
    riskTags: Array.from(batchRiskTags),
    action,
    targetCollection: primaryCol,
    targetId: `batch_${valid.length}`,
    targetName: `共 ${valid.length} 筆${meta.entityLabel}`,
    details: `${batchCreatorPrefix}${action}：${batchItems.slice(0, 5).join('、')}${
      valid.length > 5 ? ` ...等共 ${valid.length} 筆` : ''
    }`,
    changes: aggregatedChanges,
    batchCount: valid.length,
    batchItems,
  });
}

export function writeBatch(firestore: Firestore): WriteBatch {
  const rawBatch = fbWriteBatch(firestore);
  const mutations: RecordedMutation[] = [];

  const wrappedBatch: WriteBatch = {
    set(documentRef: DocumentReference<any, any>, data: any, options?: SetOptions) {
      const { collectionName, docId } = getPathSegments(documentRef.path);
      const opMode = options ? 'update' : 'create';
      const enrichedData = attachOperatorAttribution(collectionName, opMode, data);
      mutations.push({
        ref: documentRef,
        collectionName,
        docId,
        op: opMode,
        data: enrichedData as Record<string, any>,
      });
      if (options) {
        rawBatch.set(documentRef, enrichedData, options);
      } else {
        rawBatch.set(documentRef, enrichedData);
      }
      return wrappedBatch;
    },
    update(documentRef: DocumentReference<any, any>, dataOrField: any, ...moreFieldsAndValues: any[]) {
      const { collectionName, docId } = getPathSegments(documentRef.path);
      let patchObj: Record<string, any> = {};
      if (typeof dataOrField === 'string') {
        patchObj[dataOrField] = moreFieldsAndValues[0];
        for (let i = 1; i < moreFieldsAndValues.length; i += 2) {
          if (typeof moreFieldsAndValues[i] === 'string') {
            patchObj[moreFieldsAndValues[i]] = moreFieldsAndValues[i + 1];
          }
        }
        (rawBatch.update as any)(documentRef, dataOrField, ...moreFieldsAndValues);
      } else {
        const enriched = attachOperatorAttribution(collectionName, 'update', dataOrField || {});
        patchObj = enriched as Record<string, any>;
        rawBatch.update(documentRef, enriched);
      }
      mutations.push({
        ref: documentRef,
        collectionName,
        docId,
        op: 'update',
        data: patchObj,
      });
      return wrappedBatch;
    },
    delete(documentRef: DocumentReference<any, any>) {
      const { collectionName, docId } = getPathSegments(documentRef.path);
      mutations.push({
        ref: documentRef,
        collectionName,
        docId,
        op: 'delete',
      });
      rawBatch.delete(documentRef);
      return wrappedBatch;
    },
    async commit() {
      const beforeMap = new Map<string, Record<string, any> | null>();
      // 若筆數 <= 25 筆，預先擷取變更前快照以提供精準價格與機率前後比對
      if (mutations.length > 0 && mutations.length <= 25) {
        await Promise.all(
          mutations.map(async (m) => {
            if (!shouldSkipAudit(m.collectionName)) {
              const snap = await safeFetchBeforeSnapshot(m.ref);
              beforeMap.set(m.ref.path, snap);
            }
          })
        );
      }

      await rawBatch.commit();
      void flushGroupedMutations(firestore, mutations, beforeMap);
    },
  };

  return wrappedBatch;
}

export async function runTransaction<T>(
  firestore: Firestore,
  updateFunction: (transaction: Transaction) => Promise<T>,
  options?: TransactionOptions
): Promise<T> {
  let finalMutations: RecordedMutation[] = [];
  const beforeMap = new Map<string, Record<string, any> | null>();

  const result = await fbRunTransaction(
    firestore,
    async (rawTx) => {
      // 每次交易重試時重置該輪紀錄
      finalMutations = [];

      const wrappedTx: Transaction = {
        async get(documentRef: DocumentReference<any, any>) {
          const snap = await rawTx.get(documentRef);
          if (snap.exists()) {
            const data = snap.data() as Record<string, any>;
            const { collectionName, docId } = getPathSegments(documentRef.path);
            if (collectionName === 'allCards' && docId) {
              registerCardMeta(docId, data);
            }
            beforeMap.set(documentRef.path, data);
          }
          return snap;
        },
        set(documentRef: DocumentReference<any, any>, data: any, setOpts?: SetOptions) {
          const { collectionName, docId } = getPathSegments(documentRef.path);
          const opMode = setOpts ? 'update' : 'create';
          const enrichedData = attachOperatorAttribution(collectionName, opMode, data);
          finalMutations.push({
            ref: documentRef,
            collectionName,
            docId,
            op: opMode,
            data: enrichedData as Record<string, any>,
          });
          if (setOpts) {
            rawTx.set(documentRef, enrichedData, setOpts);
          } else {
            rawTx.set(documentRef, enrichedData);
          }
          return wrappedTx;
        },
        update(documentRef: DocumentReference<any, any>, dataOrField: any, ...moreFieldsAndValues: any[]) {
          const { collectionName, docId } = getPathSegments(documentRef.path);
          let patchObj: Record<string, any> = {};
          if (typeof dataOrField === 'string') {
            patchObj[dataOrField] = moreFieldsAndValues[0];
            for (let i = 1; i < moreFieldsAndValues.length; i += 2) {
              if (typeof moreFieldsAndValues[i] === 'string') {
                patchObj[moreFieldsAndValues[i]] = moreFieldsAndValues[i + 1];
              }
            }
            (rawTx.update as any)(documentRef, dataOrField, ...moreFieldsAndValues);
          } else {
            const enriched = attachOperatorAttribution(collectionName, 'update', dataOrField || {});
            patchObj = enriched as Record<string, any>;
            rawTx.update(documentRef, enriched);
          }
          finalMutations.push({
            ref: documentRef,
            collectionName,
            docId,
            op: 'update',
            data: patchObj,
          });
          return wrappedTx;
        },
        delete(documentRef: DocumentReference<any, any>) {
          const { collectionName, docId } = getPathSegments(documentRef.path);
          finalMutations.push({
            ref: documentRef,
            collectionName,
            docId,
            op: 'delete',
          });
          rawTx.delete(documentRef);
          return wrappedTx;
        },
      };

      return updateFunction(wrappedTx);
    },
    options
  );

  if (finalMutations.length > 0) {
    void flushGroupedMutations(firestore, finalMutations, beforeMap);
  }

  return result;
}
