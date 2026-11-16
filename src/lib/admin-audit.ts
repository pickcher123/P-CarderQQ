'use client';

import { getAuth } from 'firebase/auth';
import {
  collection,
  doc as rawDoc,
  addDoc as rawAddDoc,
  setDoc as rawSetDoc,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import { isSuperAdminEmail } from '@/hooks/use-is-admin';

export type AuditSeverity = 'info' | 'warning' | 'critical';
export type AuditOperationType =
  | 'create'
  | 'update'
  | 'delete'
  | 'batch'
  | 'points'
  | 'permission'
  | 'price_change'
  | 'probability_change'
  | 'api'
  | 'login'
  | 'system';

export type AuditRiskTag =
  | 'price_tamper'
  | 'prob_tamper'
  | 'card_pool_create'
  | 'stock_change';

export interface FieldChangeItem {
  field: string;
  fieldLabel: string;
  before: string;
  after: string;
}

export interface AdminActivityLogPayload {
  adminUid: string;
  userEmail: string;
  userName: string;
  adminRole: 'superadmin' | 'admin';
  adminRoleLabel: string;
  ipAddress: string;
  userAgent: string;
  routePath: string;
  module: string;
  moduleLabel: string;
  operationType: AuditOperationType;
  severity: AuditSeverity;
  riskTags?: AuditRiskTag[];
  action: string;
  targetCollection?: string;
  targetId?: string;
  targetName?: string;
  details: string;
  changes?: FieldChangeItem[];
  batchCount?: number;
  batchItems?: string[];
  createdAt?: any;
}

interface AdminOperatorContext {
  uid: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  ipAddress: string;
  userAgent: string;
  routePath: string;
}

interface CachedCardMeta {
  name: string;
  sellPrice?: number;
  category?: string;
}

let currentOperator: AdminOperatorContext = {
  uid: '',
  email: '',
  name: '',
  isSuperAdmin: false,
  ipAddress: '',
  userAgent: '',
  routePath: '',
};

let clientInfoPromise: Promise<{ ip: string; userAgent: string }> | null = null;
let activeAuditFirestore: Firestore | null = null;
const loggedApiResponses = typeof WeakSet !== 'undefined' ? new WeakSet<Response>() : null;
const cardMetaCache = new Map<string, CachedCardMeta>();

export function registerCardMeta(cardId: string, data?: Record<string, any> | null) {
  if (!cardId || !data) return;
  const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : '';
  if (!name) return;
  cardMetaCache.set(cardId, {
    name,
    sellPrice: typeof data.sellPrice === 'number' ? data.sellPrice : undefined,
    category: typeof data.category === 'string' ? data.category : undefined,
  });
}

export function hasCachedCardMeta(cardId: string): boolean {
  return cardMetaCache.has(cardId);
}

export function formatCardRef(cardId?: string | null): string {
  if (!cardId) return '無';
  const meta = cardMetaCache.get(cardId);
  if (meta) {
    const priceTag =
      typeof meta.sellPrice === 'number' ? ` ($${meta.sellPrice.toLocaleString()})` : '';
    return `${meta.name}${priceTag}`;
  }
  return `#${String(cardId).slice(0, 8)}`;
}

export function setAdminAuditFirestore(fs: Firestore | null) {
  activeAuditFirestore = fs;
}

export function updateAdminAuditContext(partial: Partial<AdminOperatorContext>) {
  currentOperator = {
    ...currentOperator,
    ...partial,
  };
}

export async function ensureAdminClientInfo(): Promise<{ ip: string; userAgent: string }> {
  if (currentOperator.ipAddress) {
    return { ip: currentOperator.ipAddress, userAgent: currentOperator.userAgent };
  }
  if (typeof window === 'undefined') {
    return { ip: '', userAgent: '' };
  }
  if (!clientInfoPromise) {
    clientInfoPromise = fetch('/api/admin/client-info', { method: 'GET', cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        const ip = data.ip || '';
        const ua = data.userAgent || navigator.userAgent || '';
        currentOperator.ipAddress = ip;
        currentOperator.userAgent = ua;
        return { ip, userAgent: ua };
      })
      .catch(() => {
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
        currentOperator.userAgent = ua;
        return { ip: '', userAgent: ua };
      });
  }
  return clientInfoPromise;
}

export function resolveCurrentOperator(): AdminOperatorContext {
  let uid = currentOperator.uid;
  let email = currentOperator.email;
  let name = currentOperator.name;

  try {
    const authUser = getAuth().currentUser;
    if (authUser) {
      uid = uid || authUser.uid;
      email = email || authUser.email || '';
      name = name || authUser.displayName || '';
    }
  } catch {
    // ignore if auth not initialized
  }

  const superAdmin = currentOperator.isSuperAdmin || isSuperAdminEmail(email);
  const routePath =
    typeof window !== 'undefined' ? window.location.pathname : currentOperator.routePath || '/admin';
  const userAgent =
    currentOperator.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '');

  return {
    uid: uid || 'unknown',
    email: email || '未知信箱',
    name: name || (email ? email.split('@')[0] : '管理員'),
    isSuperAdmin: superAdmin,
    ipAddress: currentOperator.ipAddress || '',
    userAgent: userAgent.slice(0, 240),
    routePath,
  };
}

// 模組與資料表中文對照
export const COLLECTION_META: Record<
  string,
  { module: string; moduleLabel: string; entityLabel: string; defaultSeverity: AuditSeverity }
> = {
  users: { module: 'users', moduleLabel: '會員與權限', entityLabel: '會員資料', defaultSeverity: 'warning' },
  admins: { module: 'permissions', moduleLabel: '管理員權限', entityLabel: '管理員名單', defaultSeverity: 'critical' },
  transactions: { module: 'points', moduleLabel: '點數與帳務', entityLabel: '點數交易紀錄', defaultSeverity: 'critical' },
  cardPools: { module: 'card-pools', moduleLabel: '抽卡卡池', entityLabel: '抽卡卡池', defaultSeverity: 'warning' },
  drawCategories: { module: 'card-pools', moduleLabel: '抽卡卡池', entityLabel: '抽卡主題分類', defaultSeverity: 'warning' },
  allCards: { module: 'cards', moduleLabel: '卡片資產庫', entityLabel: '卡片資產', defaultSeverity: 'warning' },
  'betting-items': { module: 'betting', moduleLabel: '拼卡專區', entityLabel: '拼卡獎池配置', defaultSeverity: 'warning' },
  bettingCategories: { module: 'betting', moduleLabel: '拼卡專區', entityLabel: '拼卡主題分類', defaultSeverity: 'warning' },
  luckBags: { module: 'lucky-bags', moduleLabel: '福袋與轉盤', entityLabel: '一番福袋商品', defaultSeverity: 'warning' },
  lucky_wheels: { module: 'lucky-bags', moduleLabel: '福袋與轉盤', entityLabel: '命運大轉盤', defaultSeverity: 'warning' },
  group_breaks: { module: 'group-breaks', moduleLabel: '團拆管理', entityLabel: '團拆專案', defaultSeverity: 'warning' },
  group_break_orders: { module: 'group-breaks', moduleLabel: '團拆管理', entityLabel: '團拆訂單', defaultSeverity: 'warning' },
  shippingOrders: { module: 'shipping', moduleLabel: '出貨物流', entityLabel: '出貨訂單', defaultSeverity: 'warning' },
  redemptionItems: { module: 'rewards', moduleLabel: '優惠與回饋', entityLabel: '兌換獎品', defaultSeverity: 'warning' },
  dailyMissions: { module: 'rewards', moduleLabel: '優惠與回饋', entityLabel: '每日任務', defaultSeverity: 'info' },
  coupons: { module: 'coupons', moduleLabel: '優惠與回饋', entityLabel: '優惠兌換碼', defaultSeverity: 'warning' },
  referralCodes: { module: 'coupons', moduleLabel: '優惠與回饋', entityLabel: '推薦推廣碼', defaultSeverity: 'warning' },
  eventTicketDispatches: { module: 'coupons', moduleLabel: '優惠與回饋', entityLabel: '活動抽卡券派發', defaultSeverity: 'critical' },
  news: { module: 'marketing', moduleLabel: '行銷與公告', entityLabel: '最新消息', defaultSeverity: 'info' },
  announcements: { module: 'marketing', moduleLabel: '行銷與公告', entityLabel: '站內公告', defaultSeverity: 'info' },
  card_exhibitions: { module: 'marketing', moduleLabel: '行銷與公告', entityLabel: '卡展行事曆', defaultSeverity: 'info' },
  advertisements: { module: 'marketing', moduleLabel: '行銷與公告', entityLabel: '首頁輪播廣告', defaultSeverity: 'info' },
  partners: { module: 'marketing', moduleLabel: '行銷與公告', entityLabel: '合作夥伴', defaultSeverity: 'info' },
  marketingEmailLogs: { module: 'marketing', moduleLabel: '行銷與公告', entityLabel: '行銷郵件紀錄', defaultSeverity: 'warning' },
  agents: { module: 'agents', moduleLabel: '代理業務', entityLabel: '代理業務帳號', defaultSeverity: 'warning' },
  systemConfig: { module: 'system', moduleLabel: '系統與安全設定', entityLabel: '全站核心設定', defaultSeverity: 'critical' },
  systemSettings: { module: 'system', moduleLabel: '系統與安全設定', entityLabel: '系統參數設定', defaultSeverity: 'critical' },
  alerts: { module: 'system', moduleLabel: '系統與安全設定', entityLabel: '異常預警紀錄', defaultSeverity: 'info' },
  predictionEvents: { module: 'marketing', moduleLabel: '行銷與公告', entityLabel: '預測活動', defaultSeverity: 'warning' },
};

const RARITY_LABELS: Record<string, string> = {
  legendary: '傳奇 (Legendary)',
  rare: '稀有 (Rare)',
  common: '普通 (Common)',
};

const CURRENCY_LABELS: Record<string, string> = {
  diamond: '💎 鑽石計價',
  'p-point': 'P+ 紅利點數計價',
};

const SOURCE_AREA_LABELS: Record<string, string> = {
  draw: '抽卡區',
  betting: '拼卡區',
  'lucky-bag': '福袋區',
  'group-break': '團拆區',
};

// 常見欄位中文名稱對照
const FIELD_LABELS: Record<string, string> = {
  _computed_probability: '🎲 卡池整體中獎機率配比',
  name: '名稱',
  title: '標題',
  username: '會員名稱',
  realName: '真實姓名',
  email: '電子信箱',
  phone: '聯絡電話',
  address: '收件地址',
  points: '鑽石餘額',
  bonusPoints: '紅利 P+ 點數',
  freeDrawTickets: '免費抽卡券',
  eventPoolTickets: '活動專屬抽卡券',
  totalSpent: '累計消費額',
  userLevel: 'VIP 等級',
  role: '系統角色',
  isAdmin: '管理員標記',
  permissions: '後台模組權限',
  agentId: '綁定業務 ID',
  agentName: '綁定業務名稱',
  tags: '會員標籤',
  status: '狀態',
  trackingNumber: '物流單號',
  shippingMethod: '寄送方式',
  fee: '運費',
  cardCount: '卡片張數',
  redemptionItem: '兌換禮品項目',
  price: '單抽 / 購買價格',
  price3Draws: '三連抽價格',
  price10Draws: '十連抽價格',
  pricePerDraw: '單抽價格',
  pricePerPack: '每包價格',
  sellPrice: '卡片回收市值 (sellPrice)',
  currency: '計價幣別',
  pointMultiplier: '紅利點數倍率',
  pointMultiplierExpiresAt: '倍率到期時間',
  totalPacks: '總包數上限',
  remainingPacks: '剩餘包數',
  totalParticipants: '福袋總籤數 (決定中獎率)',
  isActive: '卡池上架開關',
  enabled: '啟用狀態',
  isPublished: '發布狀態',
  isFeatured: '首頁熱門推薦',
  isSold: '已售出標記',
  isRecycled: '已回收標記',
  source: '所屬業務分區',
  rarity: '稀有度等級',
  cardRarities: '卡池卡片稀有度配比',
  cards: '卡池內含卡片與包數',
  pointPrizes: '卡池點數獎項配置',
  lastPrizeCardId: '最後賞 (Last One) 壓軸卡',
  enablePickNumber: '一番賞選號模式',
  totalTicketsCount: '一番賞總籤數',
  kujiTickets: '一番賞籤位盤面',
  hasProtection: '保底機制開關',
  allowFreeDraw: '允許使用免費抽卡券',
  isEventPool: '限定活動卡池模式',
  exclusiveTicketOnly: '僅限活動專屬券抽取',
  eventTicketName: '活動專屬券名稱',
  eventMaxDrawsPerUser: '每人活動抽取上限',
  dailyLimit: '每日抽取上限',
  minLevel: '最低 VIP 等級限制',
  startsAt: '預定開賣時間',
  expiresAt: '預定下架時間',
  isAdult: '成人專區標記',
  categoryId: '所屬分類 ID',
  category: '卡片分類',
  grade: '評級分數',
  certNumber: '認證編號',
  code: '優惠/推薦代碼',
  rewardPoints: '獎勵點數',
  discountAmount: '折抵金額',
  maxUses: '使用上限',
  usedCount: '已使用次數',
  order: '排序權重',
  description: '說明內容',
  content: '文章內容',
  imageUrl: '正面 / 封面圖片',
  backImageUrl: '背面圖片',
  maintenance: '全站維護模式',
  featureFlags: '全站功能開關',
  bonusEvent: '紅利加倍活動',
  allCardIds: '拼卡獎池卡片清單',
  soldCardIds: '拼卡已抽出卡片清單',
  prizes: '福袋頭/二/三獎配置',
  'prizes.first': '福袋頭獎卡片',
  'prizes.second': '福袋二獎卡片',
  'prizes.third': '福袋三獎卡片',
  otherPrizes: '福袋其他獎項配置',
  revealLottery: '公開開獎結果',
  winners: '開獎中獎號碼設定',
  items: '轉盤 / 專案項目配置',
  createdByName: '新增管理員',
  createdByEmail: '新增管理員信箱',
};

const PERMISSION_LABELS: Record<string, string> = {
  reports: '營業報表',
  orders: '交易紀錄',
  deposits: '儲值管理',
  conversions: '轉點紀錄',
  agents: '業務專區',
  cards: '卡片總管',
  'card-pools': '抽卡管理',
  betting: '拼卡管理',
  'lucky-bags': '福袋管理',
  'group-breaks': '團拆管理',
  referrals: '推薦碼管理',
  users: '會員資訊',
  'login-logs': '登入紀錄',
  rewards: '會員回饋',
  'marketing-emails': '行銷郵件',
  news: '消息管理',
  announcements: '站內公告',
  coupons: '優惠券管理',
  'card-exhibitions': '卡展行事曆',
  shipping: '出貨管理',
  partners: '合作夥伴',
  materials: '品牌與背景',
  alerts: '異常預警',
  'activity-logs': '操作日誌',
};

const IGNORED_DIFF_KEYS = new Set([
  'updatedAt',
  'createdAt',
  'lastModified',
  'timestamp',
  'transactionDate',
  'lockedBy',
  'lockedAt',
  'createdByUid',
  'createdByRole',
  'updatedByUid',
  'updatedByEmail',
  'updatedByName',
]);

// 價格與金額敏感欄位：比對時自動附加漲跌差額與百分比
const NUMERIC_PRICE_FIELDS = new Set([
  'sellPrice',
  'price',
  'price3Draws',
  'price10Draws',
  'pricePerDraw',
  'pricePerPack',
  'pointMultiplier',
  'fee',
  'rewardPoints',
  'discountAmount',
]);

export function getFieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  if (key.startsWith('eventPoolTickets.')) {
    return `活動專屬券 (${key.replace('eventPoolTickets.', '')})`;
  }
  if (key.startsWith('cardRarities.')) {
    const cardId = key.replace('cardRarities.', '');
    return `單卡稀有度 (${formatCardRef(cardId)})`;
  }
  if (key.startsWith('prizes.')) {
    const lv = key.replace('prizes.', '');
    const lvMap: Record<string, string> = { first: '頭獎', second: '二獎', third: '三獎' };
    return `福袋${lvMap[lv] || lv}卡片`;
  }
  return key;
}

// 輔助：計算卡池整體機率與包數分佈
export function reconstructPoolState(
  baseData?: Record<string, any> | null,
  patchData?: Record<string, any> | null
): {
  cards: Array<{ cardId: string; quantity: number }>;
  pointPrizes: Array<{ prizeId: string; points: number; quantity: number; rarity?: string; name?: string }>;
  cardRarities: Record<string, string>;
} {
  let cards: Array<{ cardId: string; quantity: number }> = Array.isArray(baseData?.cards)
    ? baseData!.cards.map((c: any) => ({ cardId: String(c?.cardId || ''), quantity: Number(c?.quantity || 0) }))
    : [];
  let pointPrizes: Array<{ prizeId: string; points: number; quantity: number; rarity?: string; name?: string }> =
    Array.isArray(baseData?.pointPrizes)
      ? baseData!.pointPrizes.map((p: any) => ({
          prizeId: String(p?.prizeId || ''),
          points: Number(p?.points || 0),
          quantity: Number(p?.quantity || 0),
          rarity: p?.rarity || 'common',
          name: p?.name,
        }))
      : [];
  let cardRarities: Record<string, string> =
    baseData?.cardRarities && typeof baseData.cardRarities === 'object' && !baseData.cardRarities._methodName
      ? { ...baseData.cardRarities }
      : {};

  if (!patchData) {
    return { cards, pointPrizes, cardRarities };
  }

  // 套用 cards 異動
  if (patchData.cards !== undefined) {
    if (Array.isArray(patchData.cards)) {
      cards = patchData.cards.map((c: any) => ({
        cardId: String(c?.cardId || ''),
        quantity: Number(c?.quantity || 0),
      }));
    } else if (patchData.cards && typeof patchData.cards === 'object') {
      const mName = String(patchData.cards._methodName || '');
      const elems = Array.isArray(patchData.cards._elements) ? patchData.cards._elements : [];
      if (mName.endsWith('arrayUnion')) {
        for (const el of elems) {
          if (el && el.cardId) {
            cards.push({ cardId: String(el.cardId), quantity: Number(el.quantity || 1) });
          }
        }
      } else if (mName.endsWith('arrayRemove')) {
        const removeIds = new Set(elems.map((el: any) => String(el?.cardId || el)));
        cards = cards.filter((c) => !removeIds.has(c.cardId));
      }
    }
  }

  // 套用 pointPrizes 異動
  if (patchData.pointPrizes !== undefined) {
    if (Array.isArray(patchData.pointPrizes)) {
      pointPrizes = patchData.pointPrizes.map((p: any) => ({
        prizeId: String(p?.prizeId || ''),
        points: Number(p?.points || 0),
        quantity: Number(p?.quantity || 0),
        rarity: p?.rarity || 'common',
        name: p?.name,
      }));
    } else if (patchData.pointPrizes && typeof patchData.pointPrizes === 'object') {
      const mName = String(patchData.pointPrizes._methodName || '');
      const elems = Array.isArray(patchData.pointPrizes._elements) ? patchData.pointPrizes._elements : [];
      if (mName.endsWith('arrayUnion')) {
        for (const el of elems) {
          if (el) {
            pointPrizes.push({
              prizeId: String(el.prizeId || ''),
              points: Number(el.points || 0),
              quantity: Number(el.quantity || 1),
              rarity: el.rarity || 'common',
              name: el.name,
            });
          }
        }
      } else if (mName.endsWith('arrayRemove')) {
        const removeIds = new Set(elems.map((el: any) => String(el?.prizeId || '')));
        pointPrizes = pointPrizes.filter((p) => !removeIds.has(p.prizeId));
      }
    }
  }

  // 套用整包 cardRarities
  if (
    patchData.cardRarities &&
    typeof patchData.cardRarities === 'object' &&
    !patchData.cardRarities._methodName
  ) {
    cardRarities = { ...patchData.cardRarities };
  }

  // 套用點號路徑 cardRarities.<cardId>
  for (const [k, v] of Object.entries(patchData)) {
    if (k.startsWith('cardRarities.')) {
      const cId = k.slice('cardRarities.'.length);
      if (v && typeof v === 'object' && String((v as any)._methodName || '').includes('deleteField')) {
        delete cardRarities[cId];
      } else if (typeof v === 'string') {
        cardRarities[cId] = v;
      }
    }
  }

  return { cards, pointPrizes, cardRarities };
}

export function computePoolProbabilitySummary(state: {
  cards: Array<{ cardId: string; quantity: number }>;
  pointPrizes: Array<{ prizeId: string; points: number; quantity: number; rarity?: string }>;
  cardRarities: Record<string, string>;
}): {
  totalDraws: number;
  legendary: number;
  rare: number;
  common: number;
  summary: string;
} {
  let legendary = 0;
  let rare = 0;
  let common = 0;

  for (const item of state.cards) {
    const qty = Math.max(0, Number(item.quantity) || 0);
    if (qty === 0) continue;
    const r = state.cardRarities[item.cardId] || 'common';
    if (r === 'legendary') legendary += qty;
    else if (r === 'rare') rare += qty;
    else common += qty;
  }

  for (const prize of state.pointPrizes) {
    const qty = Math.max(0, Number(prize.quantity) || 0);
    if (qty === 0) continue;
    const r = prize.rarity || 'common';
    if (r === 'legendary') legendary += qty;
    else if (r === 'rare') rare += qty;
    else common += qty;
  }

  const totalDraws = legendary + rare + common;
  if (totalDraws === 0) {
    return {
      totalDraws: 0,
      legendary: 0,
      rare: 0,
      common: 0,
      summary: '尚未配置獎項 (共 0 抽)',
    };
  }

  const pct = (n: number) => ((n / totalDraws) * 100).toFixed(2);
  return {
    totalDraws,
    legendary,
    rare,
    common,
    summary: `傳奇 ${pct(legendary)}% (${legendary}包) · 稀有 ${pct(rare)}% (${rare}包) · 普通 ${pct(common)}% (${common}包) [總計 ${totalDraws} 抽]`,
  };
}

// 將欄位值安全轉為人類可讀字串 (支援 Firestore FieldValue: increment / arrayUnion / arrayRemove / Timestamp)
export function formatAuditValue(val: any, key?: string, beforeRaw?: any): string {
  if (val === undefined) return '（未設定）';
  if (val === null) return '無';

  if (typeof val === 'boolean') return val ? '是 (開啟)' : '否 (關閉)';

  if (typeof val === 'number') {
    if (
      key &&
      NUMERIC_PRICE_FIELDS.has(key) &&
      typeof beforeRaw === 'number' &&
      beforeRaw !== val
    ) {
      const delta = val - beforeRaw;
      const arrow = delta > 0 ? '▲ +' : '▼ -';
      const pct =
        beforeRaw > 0
          ? ` / ${delta > 0 ? '+' : ''}${((delta / beforeRaw) * 100).toFixed(1)}%`
          : '';
      return `${val.toLocaleString()} (${arrow}${Math.abs(delta).toLocaleString()}${pct})`;
    }
    return val.toLocaleString();
  }

  if (typeof val === 'string') {
    if (key === 'status') {
      const statusMap: Record<string, string> = {
        pending: '待處理 (pending)',
        processing: '處理中 (processing)',
        shipped: '已出貨 (shipped)',
        cancelled: '已取消 (cancelled)',
        active: '進行中 (active)',
        closed: '已結束 (closed)',
        completed: '已完成 (completed)',
        draft: '草稿未公開 (draft)',
        published: '已上架公開 (published)',
      };
      if (statusMap[val]) return statusMap[val];
    }
    if (key === 'currency' && CURRENCY_LABELS[val]) return CURRENCY_LABELS[val];
    if ((key === 'rarity' || key?.startsWith('cardRarities.')) && RARITY_LABELS[val]) {
      return RARITY_LABELS[val];
    }
    if (key === 'source' && SOURCE_AREA_LABELS[val]) return SOURCE_AREA_LABELS[val];
    if (
      (key === 'lastPrizeCardId' || key?.startsWith('prizes.')) &&
      val.trim()
    ) {
      return formatCardRef(val);
    }
    if (val.startsWith('data:image/')) return '[圖片資料 Base64]';
    return val.length > 140 ? `${val.slice(0, 140)}...` : val;
  }

  // Firestore FieldValue 特殊物件解析
  if (typeof val === 'object') {
    const methodName = (val as any)._methodName as string | undefined;
    if (methodName) {
      if (methodName === 'increment' || methodName.endsWith('increment')) {
        const delta = Number((val as any)._operand ?? 0);
        const sign = delta >= 0 ? `+${delta.toLocaleString()}` : delta.toLocaleString();
        if (typeof beforeRaw === 'number') {
          const nextVal = beforeRaw + delta;
          return `${nextVal.toLocaleString()} (${sign})`;
        }
        return `變動 ${sign}`;
      }
      if (methodName === 'arrayUnion' || methodName.endsWith('arrayUnion')) {
        const elems = Array.isArray((val as any)._elements) ? (val as any)._elements : [];
        const formattedElems = elems.slice(0, 6).map((x: any) => {
          if (x && typeof x === 'object' && x.cardId) {
            return `${formatCardRef(x.cardId)} ×${x.quantity ?? 1}包`;
          }
          if (typeof x === 'string' && (key === 'allCardIds' || key === 'soldCardIds')) {
            return formatCardRef(x);
          }
          return typeof x === 'object' ? JSON.stringify(x).slice(0, 50) : String(x);
        });
        return `➕ 新增項目 (${elems.length} 筆): ${formattedElems.join('、')}`;
      }
      if (methodName === 'arrayRemove' || methodName.endsWith('arrayRemove')) {
        const elems = Array.isArray((val as any)._elements) ? (val as any)._elements : [];
        const formattedElems = elems.slice(0, 6).map((x: any) => {
          if (x && typeof x === 'object' && x.cardId) {
            return `${formatCardRef(x.cardId)} ×${x.quantity ?? 1}包`;
          }
          if (typeof x === 'string' && (key === 'allCardIds' || key === 'soldCardIds')) {
            return formatCardRef(x);
          }
          return typeof x === 'object' ? JSON.stringify(x).slice(0, 50) : String(x);
        });
        return `➖ 移除項目 (${elems.length} 筆): ${formattedElems.join('、')}`;
      }
      if (methodName.includes('serverTimestamp')) {
        return '[系統時間]';
      }
      if (methodName.includes('deleteField')) {
        return '（清除欄位）';
      }
    }

    // Firestore Timestamp
    if (typeof (val as any).seconds === 'number') {
      try {
        return new Date((val as any).seconds * 1000).toLocaleString('zh-TW', { hour12: false });
      } catch {
        return String((val as any).seconds);
      }
    }
    if (val instanceof Date) {
      return val.toLocaleString('zh-TW', { hour12: false });
    }

    // 陣列特化解析
    if (Array.isArray(val)) {
      if (key === 'permissions') {
        if (val.length === 0) return '無任何模組權限 (0 項)';
        const labels = val.map((p) => PERMISSION_LABELS[String(p)] || String(p));
        return `共 ${val.length} 項：${labels.join('、')}`;
      }
      if (key === 'cards') {
        if (val.length === 0) return '空卡池 (0 款 / 0 包)';
        const totalQty = val.reduce((acc, c) => acc + (Number(c?.quantity) || 0), 0);
        const preview = val
          .slice(0, 5)
          .map((c: any) => `${formatCardRef(c?.cardId)} ×${c?.quantity ?? 0}包`)
          .join('、');
        return `共 ${val.length} 款卡 (${totalQty} 包)：${preview}${val.length > 5 ? ` ...等` : ''}`;
      }
      if (key === 'pointPrizes') {
        if (val.length === 0) return '無點數獎項 (0 筆)';
        const totalQty = val.reduce((acc, p) => acc + (Number(p?.quantity) || 0), 0);
        const preview = val
          .slice(0, 5)
          .map(
            (p: any) =>
              `${p?.name || `${Number(p?.points || 0).toLocaleString()}點`} ×${p?.quantity ?? 0}包 (${
                RARITY_LABELS[p?.rarity] || p?.rarity || '普通'
              })`
          )
          .join('、');
        return `共 ${val.length} 項 (${totalQty} 包)：${preview}${val.length > 5 ? ' ...等' : ''}`;
      }
      if (key === 'kujiTickets') {
        if (val.length === 0) return '未產生籤位 (0 籤)';
        const drawnCount = val.filter((t: any) => Boolean(t?.isDrawn)).length;
        return `共 ${val.length} 籤（已抽 ${drawnCount} 籤 / 剩餘 ${val.length - drawnCount} 籤）`;
      }
      if (key === 'otherPrizes') {
        if (val.length === 0) return '無其他獎項 (0 筆)';
        const preview = val
          .slice(0, 5)
          .map((p: any) =>
            p?.type === 'points'
              ? `紅利 ${Number(p?.points || 0).toLocaleString()} 點`
              : `卡片 ${formatCardRef(p?.cardId)}`
          )
          .join('、');
        return `共 ${val.length} 項：${preview}${val.length > 5 ? ' ...等' : ''}`;
      }
      if (key === 'allCardIds' || key === 'soldCardIds') {
        if (val.length === 0) return '空清單 (0 張)';
        const preview = val.slice(0, 5).map((id: any) => formatCardRef(String(id))).join('、');
        return `共 ${val.length} 張：${preview}${val.length > 5 ? ' ...等' : ''}`;
      }
      if (val.length === 0) return '空清單 (0 筆)';
      if (typeof val[0] === 'string' || typeof val[0] === 'number') {
        const preview = val.slice(0, 6).join(', ');
        return val.length > 6 ? `[${preview} ... 共 ${val.length} 項]` : `[${preview}]`;
      }
      const objPreview = val
        .slice(0, 3)
        .map((item: any) => {
          const label = item?.name || item?.title || item?.label || item?.id || '';
          const w = item?.weight ?? item?.probability ?? item?.quantity ?? item?.price;
          if (label && w !== undefined) return `${label}(${w})`;
          if (label) return String(label);
          return JSON.stringify(item).slice(0, 36);
        })
        .join('、');
      return `共 ${val.length} 筆：${objPreview}${val.length > 3 ? ' ...' : ''}`;
    }

    // 物件特化：cardRarities
    if (key === 'cardRarities') {
      const entries = Object.entries(val);
      if (entries.length === 0) return '尚未設定稀有度 (預設普通)';
      let leg = 0;
      let rare = 0;
      let com = 0;
      for (const [, r] of entries) {
        if (r === 'legendary') leg += 1;
        else if (r === 'rare') rare += 1;
        else com += 1;
      }
      return `共 ${entries.length} 款設定（傳奇 ${leg} 款 · 稀有 ${rare} 款 · 普通 ${com} 款）`;
    }

    // 物件特化：福袋頭二三獎 prizes
    if (key === 'prizes') {
      const parts: string[] = [];
      if ((val as any).first) parts.push(`頭獎: ${formatCardRef((val as any).first)}`);
      if ((val as any).second) parts.push(`二獎: ${formatCardRef((val as any).second)}`);
      if ((val as any).third) parts.push(`三獎: ${formatCardRef((val as any).third)}`);
      return parts.length > 0 ? parts.join(' ｜ ') : '尚未配置頭二三獎';
    }

    // 物件特化：福袋 winners
    if (key === 'winners') {
      const parts: string[] = [];
      if ((val as any).first !== undefined) parts.push(`頭獎號碼 #${(val as any).first}`);
      if ((val as any).second !== undefined) parts.push(`二獎號碼 #${(val as any).second}`);
      if ((val as any).third !== undefined) parts.push(`三獎號碼 #${(val as any).third}`);
      if (Array.isArray((val as any).other) && (val as any).other.length > 0) {
        parts.push(`其他獎共 ${(val as any).other.length} 個號碼`);
      }
      return parts.length > 0 ? parts.join(' ｜ ') : '尚未開獎';
    }

    // 一般物件 (例如 maintenance, featureFlags, bonusEvent)
    try {
      const entries = Object.entries(val)
        .filter(([k]) => !IGNORED_DIFF_KEYS.has(k))
        .slice(0, 8)
        .map(([k, v]) => `${getFieldLabel(k)}: ${formatAuditValue(v, k)}`);
      return entries.length > 0 ? entries.join('；') : '{}';
    } catch {
      return '[複雜物件]';
    }
  }

  return String(val);
}

export function extractTargetName(data?: Record<string, any> | null, fallbackId?: string): string {
  if (!data) return fallbackId || '';
  const candidate =
    data.name ||
    data.title ||
    data.username ||
    data.realName ||
    data.code ||
    data.matchName ||
    data.email ||
    data.redemptionItem ||
    '';
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim().slice(0, 80);
  }
  return fallbackId || '';
}

// 精準深層比對特殊陣列/物件，絕不因陣列筆數相同或超過 6 筆而漏記竄改！
function diffComplexPoolField(
  key: string,
  oldVal: any,
  newVal: any
): { changed: boolean; beforeStr: string; afterStr: string } | null {
  // 1. 卡池卡片與包數陣列 cards
  if (key === 'cards' && Array.isArray(newVal)) {
    const oldArr = Array.isArray(oldVal) ? oldVal : [];
    const oldMap = new Map<string, number>();
    for (const c of oldArr) {
      if (c?.cardId) {
        oldMap.set(String(c.cardId), (oldMap.get(String(c.cardId)) || 0) + (Number(c.quantity) || 0));
      }
    }
    const newMap = new Map<string, number>();
    for (const c of newVal) {
      if (c?.cardId) {
        newMap.set(String(c.cardId), (newMap.get(String(c.cardId)) || 0) + (Number(c.quantity) || 0));
      }
    }

    const diffs: string[] = [];
    const beforeParts: string[] = [];
    const allIds = new Set([...Array.from(oldMap.keys()), ...Array.from(newMap.keys())]);
    for (const id of Array.from(allIds)) {
      const oq = oldMap.get(id) ?? 0;
      const nq = newMap.get(id) ?? 0;
      if (oq !== nq) {
        const refLabel = formatCardRef(id);
        if (oq === 0) {
          diffs.push(`➕ 新增 ${refLabel} ×${nq}包`);
        } else if (nq === 0) {
          beforeParts.push(`${refLabel} ×${oq}包`);
          diffs.push(`➖ 移除 ${refLabel} (原 ${oq}包)`);
        } else {
          beforeParts.push(`${refLabel} ×${oq}包`);
          diffs.push(`✏️ ${refLabel}: ${oq}包 → ${nq}包`);
        }
      }
    }

    if (diffs.length === 0 && oldArr.length === newVal.length) {
      return { changed: false, beforeStr: '', afterStr: '' };
    }
    if (diffs.length === 0) {
      // 僅調整順序或重複合併
      return { changed: false, beforeStr: '', afterStr: '' };
    }

    const oldTotal = Array.from(oldMap.values()).reduce((a, b) => a + b, 0);
    const newTotal = Array.from(newMap.values()).reduce((a, b) => a + b, 0);
    const beforeSummary =
      beforeParts.length > 0
        ? `共 ${oldMap.size} 款 (${oldTotal}包)｜原值: ${beforeParts.slice(0, 5).join('、')}${
            beforeParts.length > 5 ? ` ...等 ${beforeParts.length} 款` : ''
          }`
        : `共 ${oldMap.size} 款 (${oldTotal}包)`;
    const afterSummary = `共 ${newMap.size} 款 (${newTotal}包)｜${diffs.slice(0, 6).join('；')}${
      diffs.length > 6 ? ` ...等共 ${diffs.length} 項異動` : ''
    }`;
    return { changed: true, beforeStr: beforeSummary, afterStr: afterSummary };
  }

  // 2. 卡池卡片稀有度對照表 cardRarities (檢查全部卡片，不截斷前 6 筆)
  if (
    key === 'cardRarities' &&
    newVal &&
    typeof newVal === 'object' &&
    !Array.isArray(newVal) &&
    !(newVal as any)._methodName
  ) {
    const oldObj = oldVal && typeof oldVal === 'object' ? oldVal : {};
    const allIds = new Set([...Object.keys(oldObj), ...Object.keys(newVal)]);
    const beforeDiffs: string[] = [];
    const afterDiffs: string[] = [];

    for (const id of Array.from(allIds)) {
      const or = oldObj[id] || 'common';
      const nr = newVal[id] || 'common';
      if (or !== nr) {
        const cardLabel = formatCardRef(id);
        beforeDiffs.push(`${cardLabel}: ${RARITY_LABELS[or] || or}`);
        afterDiffs.push(`${cardLabel}: ${RARITY_LABELS[nr] || nr}`);
      }
    }

    if (afterDiffs.length === 0) {
      return { changed: false, beforeStr: '', afterStr: '' };
    }

    return {
      changed: true,
      beforeStr:
        beforeDiffs.slice(0, 6).join('；') +
        (beforeDiffs.length > 6 ? ` ...等 ${beforeDiffs.length} 款` : ''),
      afterStr:
        afterDiffs.slice(0, 6).join('；') +
        (afterDiffs.length > 6 ? ` ...等 ${afterDiffs.length} 款` : ''),
    };
  }

  // 3. 卡池點數獎項陣列 pointPrizes
  if (key === 'pointPrizes' && Array.isArray(newVal)) {
    const oldArr = Array.isArray(oldVal) ? oldVal : [];
    const oldMap = new Map<string, any>();
    oldArr.forEach((p: any, idx: number) => oldMap.set(String(p?.prizeId || `idx_${idx}`), p));
    const newMap = new Map<string, any>();
    newVal.forEach((p: any, idx: number) => newMap.set(String(p?.prizeId || `idx_${idx}`), p));

    const diffs: string[] = [];
    const allIds = new Set([...Array.from(oldMap.keys()), ...Array.from(newMap.keys())]);
    for (const id of Array.from(allIds)) {
      const op = oldMap.get(id);
      const np = newMap.get(id);
      if (!op && np) {
        diffs.push(
          `➕ 新增 ${np.name || `${Number(np.points || 0).toLocaleString()}點`} ×${np.quantity ?? 0}包 (${
            RARITY_LABELS[np.rarity] || np.rarity || '普通'
          })`
        );
      } else if (op && !np) {
        diffs.push(
          `➖ 移除 ${op.name || `${Number(op.points || 0).toLocaleString()}點`} ×${op.quantity ?? 0}包`
        );
      } else if (op && np) {
        const oPts = Number(op.points || 0);
        const nPts = Number(np.points || 0);
        const oQty = Number(op.quantity || 0);
        const nQty = Number(np.quantity || 0);
        const oRar = op.rarity || 'common';
        const nRar = np.rarity || 'common';
        if (oPts !== nPts || oQty !== nQty || oRar !== nRar || (op.name || '') !== (np.name || '')) {
          diffs.push(
            `✏️ ${op.name || `${oPts.toLocaleString()}點`}: ${oPts.toLocaleString()}點×${oQty}包(${
              RARITY_LABELS[oRar] || oRar
            }) → ${nPts.toLocaleString()}點×${nQty}包(${RARITY_LABELS[nRar] || nRar})`
          );
        }
      }
    }

    if (diffs.length === 0) {
      return { changed: false, beforeStr: '', afterStr: '' };
    }

    return {
      changed: true,
      beforeStr: formatAuditValue(oldArr, 'pointPrizes'),
      afterStr: `${diffs.slice(0, 5).join('；')}${diffs.length > 5 ? ` ...等 ${diffs.length} 項` : ''}`,
    };
  }

  // 4. 一番賞籤位盤面 kujiTickets (偵測重置、重洗或籤數異動)
  if (key === 'kujiTickets' && Array.isArray(newVal)) {
    const oldArr = Array.isArray(oldVal) ? oldVal : [];
    const sig = (arr: any[]) =>
      arr
        .map(
          (t) =>
            `${t?.number ?? ''}:${t?.prizeType ?? ''}:${t?.cardId ?? t?.points ?? ''}:${
              t?.isDrawn ? 1 : 0
            }`
        )
        .join('|');

    if (sig(oldArr) === sig(newVal)) {
      return { changed: false, beforeStr: '', afterStr: '' };
    }

    const oldDrawn = oldArr.filter((t) => Boolean(t?.isDrawn)).length;
    const newDrawn = newVal.filter((t) => Boolean(t?.isDrawn)).length;
    const note =
      oldArr.length === newVal.length && oldDrawn === 0 && newDrawn === 0
        ? '（重新洗牌籤位順序）'
        : oldDrawn > 0 && newDrawn === 0
        ? '（重置已抽籤位為全新盤面）'
        : '';

    return {
      changed: true,
      beforeStr: formatAuditValue(oldArr, 'kujiTickets'),
      afterStr: `${formatAuditValue(newVal, 'kujiTickets')}${note}`,
    };
  }

  // 5. 拼卡卡池清單 allCardIds / soldCardIds
  if ((key === 'allCardIds' || key === 'soldCardIds') && Array.isArray(newVal)) {
    const oldArr = Array.isArray(oldVal) ? oldVal.map(String) : [];
    const newStrArr = newVal.map(String);
    const oldSet = new Set(oldArr);
    const newSet = new Set(newStrArr);
    const added = newStrArr.filter((x) => !oldSet.has(x));
    const removed = oldArr.filter((x) => !newSet.has(x));

    if (added.length === 0 && removed.length === 0 && oldArr.length === newStrArr.length) {
      return { changed: false, beforeStr: '', afterStr: '' };
    }

    const parts: string[] = [];
    if (added.length > 0) {
      parts.push(
        `➕ 新增 ${added.length} 張 (${added
          .slice(0, 4)
          .map((id) => formatCardRef(id))
          .join('、')}${added.length > 4 ? '...' : ''})`
      );
    }
    if (removed.length > 0) {
      parts.push(
        `➖ 移除 ${removed.length} 張 (${removed
          .slice(0, 4)
          .map((id) => formatCardRef(id))
          .join('、')}${removed.length > 4 ? '...' : ''})`
      );
    }

    return {
      changed: true,
      beforeStr: `共 ${oldArr.length} 張卡片`,
      afterStr: `共 ${newStrArr.length} 張卡片｜${parts.join('；') || '調整排序'}`,
    };
  }

  // 6. 福袋其他獎項 otherPrizes
  if (key === 'otherPrizes' && Array.isArray(newVal)) {
    const oldArr = Array.isArray(oldVal) ? oldVal : [];
    if (JSON.stringify(oldArr) === JSON.stringify(newVal)) {
      return { changed: false, beforeStr: '', afterStr: '' };
    }
    return {
      changed: true,
      beforeStr: formatAuditValue(oldArr, 'otherPrizes'),
      afterStr: formatAuditValue(newVal, 'otherPrizes'),
    };
  }

  // 7. 一般物件陣列或深層物件 (如大轉盤 items / prizes / winners)
  if (
    typeof newVal === 'object' &&
    newVal !== null &&
    !(newVal as any)._methodName &&
    typeof (newVal as any).seconds !== 'number' &&
    !(newVal instanceof Date)
  ) {
    try {
      if (JSON.stringify(oldVal ?? null) === JSON.stringify(newVal)) {
        return { changed: false, beforeStr: '', afterStr: '' };
      }
      return {
        changed: true,
        beforeStr: formatAuditValue(oldVal, key),
        afterStr: formatAuditValue(newVal, key, oldVal),
      };
    } catch {
      // fallback to default formatting
    }
  }

  return null;
}

export function computeFieldChanges(
  beforeData: Record<string, any> | null | undefined,
  afterPatch: Record<string, any> | null | undefined,
  mode: 'create' | 'update' | 'delete',
  collectionName?: string
): FieldChangeItem[] {
  const changes: FieldChangeItem[] = [];

  if (mode === 'delete') {
    if (!beforeData) return [];
    // 若刪除卡池，優先附上刪除前的整體機率配比
    if (collectionName === 'cardPools') {
      const prob = computePoolProbabilitySummary(reconstructPoolState(beforeData, null));
      if (prob.totalDraws > 0) {
        changes.push({
          field: '_computed_probability',
          fieldLabel: '🎲 刪除前卡池機率配比',
          before: prob.summary,
          after: '（已刪除卡池）',
        });
      }
    }
    for (const [k, v] of Object.entries(beforeData)) {
      if (IGNORED_DIFF_KEYS.has(k)) continue;
      changes.push({
        field: k,
        fieldLabel: getFieldLabel(k),
        before: formatAuditValue(v, k),
        after: '（已刪除）',
      });
      if (changes.length >= 18) break;
    }
    return changes;
  }

  if (!afterPatch) return [];

  for (const [k, newVal] of Object.entries(afterPatch)) {
    if (IGNORED_DIFF_KEYS.has(k)) continue;

    // 支援巢狀路徑如 'eventPoolTickets.pool123' 或 'cardRarities.card123'
    const oldVal =
      beforeData && k.includes('.')
        ? k.split('.').reduce((acc: any, part) => (acc ? acc[part] : undefined), beforeData)
        : beforeData?.[k];

    const methodName = newVal && typeof newVal === 'object' ? (newVal as any)._methodName : undefined;
    if (methodName && String(methodName).includes('serverTimestamp')) continue;

    if (mode === 'update' && beforeData && !methodName) {
      const complexDiff = diffComplexPoolField(k, oldVal, newVal);
      if (complexDiff) {
        if (!complexDiff.changed) continue;
        changes.push({
          field: k,
          fieldLabel: getFieldLabel(k),
          before: complexDiff.beforeStr,
          after: complexDiff.afterStr,
        });
        if (changes.length >= 24) break;
        continue;
      }
    }

    const beforeStr =
      mode === 'create'
        ? '（新增）'
        : k.startsWith('cardRarities.') && oldVal === undefined
        ? RARITY_LABELS.common
        : formatAuditValue(oldVal, k);
    const afterStr = formatAuditValue(newVal, k, mode === 'update' ? oldVal : undefined);

    if (mode === 'update' && beforeData && beforeStr === afterStr && !methodName) {
      continue;
    }

    changes.push({
      field: k,
      fieldLabel: getFieldLabel(k),
      before: beforeStr,
      after: afterStr,
    });
    if (changes.length >= 24) break;
  }

  // 若為抽卡卡池 (cardPools)，自動計算並置頂「整體中獎機率配比」前後變化
  if (collectionName === 'cardPools') {
    if (mode === 'create') {
      const initProb = computePoolProbabilitySummary(reconstructPoolState(null, afterPatch));
      if (initProb.totalDraws > 0) {
        changes.unshift({
          field: '_computed_probability',
          fieldLabel: '🎲 初始中獎機率配比',
          before: '（新建卡池）',
          after: initProb.summary,
        });
      }
    } else if (mode === 'update') {
      const touchedProbField = changes.some(
        (c) =>
          c.field === 'cards' ||
          c.field === 'cardRarities' ||
          c.field.startsWith('cardRarities.') ||
          c.field === 'pointPrizes'
      );
      if (touchedProbField && beforeData) {
        const beforeProb = computePoolProbabilitySummary(reconstructPoolState(beforeData, null));
        const afterProb = computePoolProbabilitySummary(reconstructPoolState(beforeData, afterPatch));
        changes.unshift({
          field: '_computed_probability',
          fieldLabel: '🎲 卡池整體中獎機率配比',
          before: beforeProb.summary,
          after: afterProb.summary,
        });
      }
    }
  }

  return changes;
}

// 依據資料表、欄位與變更內容自動推導精準中文動作、風險等級、防竄改標籤與摘要
export function buildSemanticAuditInfo(params: {
  collectionName: string;
  docId: string;
  op: 'create' | 'update' | 'delete';
  beforeData?: Record<string, any> | null;
  afterData?: Record<string, any> | null;
}): {
  module: string;
  moduleLabel: string;
  operationType: AuditOperationType;
  severity: AuditSeverity;
  riskTags: AuditRiskTag[];
  action: string;
  targetName: string;
  details: string;
  changes: FieldChangeItem[];
} {
  const { collectionName, docId, op, beforeData, afterData } = params;
  const meta = COLLECTION_META[collectionName] || {
    module: 'system',
    moduleLabel: '後台資料維護',
    entityLabel: collectionName,
    defaultSeverity: 'info' as AuditSeverity,
  };

  if (collectionName === 'allCards') {
    if (beforeData) registerCardMeta(docId, beforeData);
    if (afterData) registerCardMeta(docId, { ...(beforeData || {}), ...afterData });
  }

  const targetName =
    extractTargetName(afterData, '') || extractTargetName(beforeData, '') || docId;
  const changes = computeFieldChanges(beforeData, afterData, op, collectionName);

  // 關鍵防誤判：更新時僅以「實際產生差異的欄位」判定，避免全量儲存 (handleSaveAllChanges) 誤觸假警報
  const changedKeys =
    op === 'update' && beforeData
      ? changes.map((c) => c.field).filter((f) => f !== '_computed_probability')
      : Object.keys(afterData || {});

  let moduleKey = meta.module;
  let moduleLabel = meta.moduleLabel;
  let operationType: AuditOperationType = op;
  let severity: AuditSeverity = op === 'delete' ? 'critical' : meta.defaultSeverity;
  const riskTagSet = new Set<AuditRiskTag>();
  let action = `${op === 'create' ? '新增' : op === 'delete' ? '刪除' : '修改'}${meta.entityLabel}`;

  // 1. 卡片資產庫 (allCards) — 嚴密監控新增卡片與竄改回收市值 (sellPrice)
  if (collectionName === 'allCards') {
    if (op === 'create') {
      riskTagSet.add('card_pool_create');
      const sp = Number(afterData?.sellPrice ?? 0);
      const areaLabel = SOURCE_AREA_LABELS[String(afterData?.source || '')] || '卡片庫';
      action = `➕ 新增卡片資產（${areaLabel}）`;
      severity = sp >= 3000 || sp <= 0 ? 'warning' : 'info';
    } else if (op === 'delete') {
      severity = 'critical';
      riskTagSet.add('stock_change');
      action = '🗑️ 刪除卡片資產';
    } else if (op === 'update') {
      const hasPriceChange = changedKeys.includes('sellPrice');
      const hasSoldOrRecycleChange =
        changedKeys.includes('isSold') || changedKeys.includes('isRecycled');

      if (hasPriceChange) {
        operationType = 'price_change';
        severity = 'critical';
        riskTagSet.add('price_tamper');
        action = '💰 變更卡片價格 / 回收市值';
      } else if (hasSoldOrRecycleChange) {
        severity = 'warning';
        riskTagSet.add('stock_change');
        action = '📦 手動變更卡片售出 / 回收狀態';
      } else if (changedKeys.length === 0 && beforeData) {
        severity = 'info';
        action = '儲存卡片資料（無欄位異動）';
      } else {
        severity = 'info';
        action = '編輯卡片基本資料';
      }
    }
  }

  // 2. 抽卡卡池與主題分類 (cardPools / drawCategories) — 嚴密防範竄改抽價與亂調機率配比
  if (collectionName === 'cardPools') {
    if (op === 'create') {
      riskTagSet.add('card_pool_create');
      severity = 'warning';
      action = '➕ 新建抽卡卡池';
    } else if (op === 'delete') {
      severity = 'critical';
      riskTagSet.add('stock_change');
      action = '🗑️ 刪除抽卡卡池';
    } else if (op === 'update') {
      const PRICE_KEYS = new Set([
        'price',
        'price3Draws',
        'price10Draws',
        'currency',
        'pointMultiplier',
        'allowFreeDraw',
        'exclusiveTicketOnly',
      ]);
      const PROB_KEYS = new Set([
        'cards',
        'cardRarities',
        'pointPrizes',
        'lastPrizeCardId',
        'totalPacks',
        'remainingPacks',
        'kujiTickets',
        'totalTicketsCount',
        'enablePickNumber',
        'hasProtection',
      ]);

      const hasPriceChange = changedKeys.some((k) => PRICE_KEYS.has(k));
      const hasProbChange = changedKeys.some(
        (k) => PROB_KEYS.has(k) || k.startsWith('cardRarities.')
      );
      const hasActiveToggle = changedKeys.includes('isActive');

      if (hasPriceChange) riskTagSet.add('price_tamper');
      if (hasProbChange) riskTagSet.add('prob_tamper');

      if (hasPriceChange && hasProbChange) {
        operationType = 'price_change';
        severity = 'critical';
        action = '🚨 同時變更卡池價格與中獎機率配置';
      } else if (hasPriceChange) {
        operationType = 'price_change';
        severity = 'critical';
        if (changedKeys.includes('pointMultiplier')) {
          action = '💰 變更卡池抽獎價格 / 紅利倍率';
        } else if (changedKeys.includes('currency')) {
          action = '💰 變更卡池計價幣別 / 價格';
        } else {
          action = '💰 變更卡池抽獎價格';
        }
      } else if (hasProbChange) {
        operationType = 'probability_change';
        severity = 'critical';
        if (
          changedKeys.includes('cardRarities') ||
          changedKeys.some((k) => k.startsWith('cardRarities.'))
        ) {
          action = '🎲 調整卡池卡片稀有度與中獎機率';
        } else if (changedKeys.includes('kujiTickets')) {
          action = '🎟️ 重置或重洗一番賞籤位盤面';
        } else if (changedKeys.includes('lastPrizeCardId')) {
          action = '🏆 變更卡池壓軸最後賞卡片';
        } else if (changedKeys.includes('cards') || changedKeys.includes('pointPrizes')) {
          action = '🎲 變更卡池獎項內容與包數配比';
        } else {
          action = '🎲 調整卡池總包數 / 保底機制';
        }
      } else if (hasActiveToggle) {
        severity = 'warning';
        action = afterData?.isActive ? '📢 上架公開抽卡卡池' : '🔒 下架關閉抽卡卡池';
      } else if (changedKeys.length === 0 && beforeData) {
        severity = 'info';
        action = '儲存卡池設定（無欄位異動）';
      } else {
        severity = 'warning';
        action = '修改抽卡卡池外觀 / 規則設定';
      }
    }
  }

  if (collectionName === 'drawCategories' || collectionName === 'bettingCategories') {
    if (op === 'create') {
      riskTagSet.add('card_pool_create');
      severity = 'warning';
      action = `➕ 新增${meta.entityLabel}`;
    } else if (op === 'delete') {
      severity = 'critical';
      action = `🗑️ 刪除${meta.entityLabel}`;
    }
  }

  // 3. 拼卡專區 (betting-items) — 獎池卡片增減與已抽出狀態重置
  if (collectionName === 'betting-items') {
    if (op === 'create') {
      riskTagSet.add('card_pool_create');
      severity = 'warning';
      action = '➕ 初始化拼卡獎池配置';
    } else if (op === 'update') {
      const hasPoolEdit =
        changedKeys.includes('allCardIds') || changedKeys.includes('soldCardIds');
      if (hasPoolEdit) {
        operationType = 'probability_change';
        severity = 'critical';
        riskTagSet.add('prob_tamper');
        action = changedKeys.includes('soldCardIds')
          ? '🎲 變更拼卡獎池已抽出狀態 / 重置卡池'
          : '🎲 增減拼卡獎池目標卡片清單';
      }
    }
  }

  // 4. 一番福袋與大轉盤 (luckBags / lucky_wheels / group_breaks)
  if (
    collectionName === 'luckBags' ||
    collectionName === 'lucky_wheels' ||
    collectionName === 'group_breaks'
  ) {
    if (op === 'create') {
      riskTagSet.add('card_pool_create');
      severity = 'warning';
      action = `➕ 新建${meta.entityLabel}`;
    } else if (op === 'update') {
      const hasPrice =
        changedKeys.includes('price') ||
        changedKeys.includes('pricePerSpot') ||
        changedKeys.includes('currency');
      const hasProbOrPrize = changedKeys.some(
        (k) =>
          k === 'prizes' ||
          k.startsWith('prizes.') ||
          k === 'otherPrizes' ||
          k === 'totalParticipants' ||
          k === 'winners' ||
          k === 'items' ||
          k === 'segments' ||
          k === 'options'
      );

      if (hasPrice) riskTagSet.add('price_tamper');
      if (hasProbOrPrize) riskTagSet.add('prob_tamper');

      if (hasPrice && hasProbOrPrize) {
        operationType = 'price_change';
        severity = 'critical';
        action = `🚨 同時變更${meta.entityLabel}價格與獎項機率`;
      } else if (hasPrice) {
        operationType = 'price_change';
        severity = 'critical';
        action = `💰 變更${meta.entityLabel}價格`;
      } else if (hasProbOrPrize) {
        operationType = 'probability_change';
        severity = 'critical';
        action = changedKeys.includes('winners')
          ? `🎯 設定${meta.entityLabel}中獎號碼`
          : `🎲 變更${meta.entityLabel}獎項配置 / 總籤數`;
      }
    }
  }

  // 5. 兌換商城獎品價格異動 (redemptionItems)
  if (collectionName === 'redemptionItems' && op === 'update') {
    if (changedKeys.includes('points') || changedKeys.includes('price')) {
      operationType = 'price_change';
      severity = 'critical';
      riskTagSet.add('price_tamper');
      action = '💰 變更兌換商城獎品所需點數';
    }
  }

  // 6. 會員資料與權限 / 點數特化判斷
  if (collectionName === 'users') {
    const hasPermChange =
      changedKeys.includes('permissions') ||
      changedKeys.includes('role') ||
      changedKeys.includes('isAdmin');
    const hasPointChange =
      changedKeys.includes('points') ||
      changedKeys.includes('bonusPoints') ||
      changedKeys.includes('freeDrawTickets') ||
      changedKeys.some((k) => k.startsWith('eventPoolTickets'));
    const hasAgentChange = changedKeys.includes('agentId') || changedKeys.includes('agentName');

    if (hasPermChange) {
      moduleKey = 'permissions';
      moduleLabel = '管理員權限';
      operationType = 'permission';
      severity = 'critical';
      if (afterData?.role === 'user' || afterData?.isAdmin === false) {
        action = '解除管理員身分';
      } else if (changedKeys.includes('permissions')) {
        action = '變更管理員模組授權';
      } else {
        action = '指派管理員角色';
      }
    } else if (hasPointChange) {
      moduleKey = 'points';
      moduleLabel = '點數與帳務';
      operationType = 'points';
      severity = 'critical';
      action = '調整會員點數 / 票券';
    } else if (hasAgentChange) {
      action = '綁定 / 變更會員所屬業務';
      severity = 'warning';
    } else if (changedKeys.includes('tags')) {
      action = '編輯會員標籤';
      severity = 'info';
    }
  }

  // 7. 管理員白名單集合
  if (collectionName === 'admins') {
    moduleKey = 'permissions';
    moduleLabel = '管理員權限';
    operationType = 'permission';
    severity = 'critical';
    action =
      op === 'delete'
        ? '移除管理員權限名單'
        : op === 'create'
        ? '新增管理員權限名單'
        : '更新管理員權限設定';
  }

  // 8. 出貨管理
  if (collectionName === 'shippingOrders') {
    if (changedKeys.includes('status') || changedKeys.includes('trackingNumber')) {
      const nextStatus = afterData?.status;
      if (nextStatus === 'shipped') action = '標記訂單已出貨';
      else if (nextStatus === 'processing') action = '標記訂單處理中';
      else if (nextStatus === 'cancelled') {
        action = '取消出貨訂單';
        severity = 'critical';
      } else {
        action = '更新出貨單號 / 狀態';
      }
    }
  }

  // 9. 全站系統設定
  if (collectionName === 'systemConfig' || collectionName === 'systemSettings') {
    operationType = 'system';
    severity = 'critical';
    if (changedKeys.some((k) => k.includes('maintenance'))) {
      action = '切換全站維護模式';
    } else if (changedKeys.some((k) => k.includes('featureFlags'))) {
      action = '調整全站功能開關';
    } else if (changedKeys.some((k) => k.includes('bonusEvent'))) {
      action = '變更全站紅利加倍活動';
    } else {
      action = '更新系統核心設定';
    }
  }

  // 組合簡潔清楚的中文摘要（優先呈現機率與價格欄位）
  const prioritizedChanges = [...changes].sort((a, b) => {
    const score = (f: string) => {
      if (f === '_computed_probability') return 0;
      if (NUMERIC_PRICE_FIELDS.has(f) || f === 'currency') return 1;
      if (
        f === 'cards' ||
        f === 'cardRarities' ||
        f.startsWith('cardRarities.') ||
        f === 'pointPrizes' ||
        f === 'kujiTickets' ||
        f === 'lastPrizeCardId' ||
        f === 'prizes' ||
        f.startsWith('prizes.') ||
        f === 'otherPrizes' ||
        f === 'winners' ||
        f === 'allCardIds' ||
        f === 'soldCardIds'
      ) {
        return 2;
      }
      return 5;
    };
    return score(a.field) - score(b.field);
  });

  const targetDesc = targetName && targetName !== docId ? `「${targetName}」` : `(#${docId.slice(0, 8)})`;
  const changeSummary = prioritizedChanges
    .slice(0, 4)
    .map((c) =>
      op === 'create'
        ? `${c.fieldLabel}: ${c.after}`
        : op === 'delete'
        ? `${c.fieldLabel}: ${c.before}`
        : `${c.fieldLabel}: ${c.before} → ${c.after}`
    )
    .join(' ｜ ');

  const operator = resolveCurrentOperator();
  const creatorName =
    (typeof afterData?.createdByName === 'string' && afterData.createdByName.trim()) ||
    operator.name ||
    '';
  const creatorEmail =
    (typeof afterData?.createdByEmail === 'string' && afterData.createdByEmail.trim()) ||
    (operator.email && operator.email !== '未知信箱' ? operator.email : '');
  const showCreatorPrefix =
    op === 'create' &&
    Boolean(creatorName) &&
    (collectionName === 'allCards' ||
      collectionName === 'cardPools' ||
      collectionName === 'luckBags' ||
      collectionName === 'betting-items' ||
      collectionName === 'group_breaks');
  const creatorPrefix = showCreatorPrefix
    ? `新增人員：${creatorName}${creatorEmail ? ` (${creatorEmail})` : ''} ｜ `
    : '';

  const details = changeSummary
    ? `${creatorPrefix}${action} ${targetDesc} — ${changeSummary}`
    : `${creatorPrefix}${action} ${targetDesc}`;

  return {
    module: moduleKey,
    moduleLabel,
    operationType,
    severity,
    riskTags: Array.from(riskTagSet),
    action,
    targetName,
    details,
    changes: prioritizedChanges,
  };
}

export function parseUserAgentDetails(ua?: string): {
  device: 'mobile' | 'tablet' | 'desktop';
  os: string;
  browser: string;
} {
  const safeUa = ua || '';
  const lower = safeUa.toLowerCase();

  let device: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  if (/ipad|tablet|playbook|silk/i.test(safeUa) || (/android/i.test(safeUa) && !/mobile/i.test(safeUa))) {
    device = 'tablet';
  } else if (/iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|iemobile/i.test(lower)) {
    device = 'mobile';
  }

  let os = '桌面系統';
  if (safeUa.includes('Windows')) os = 'Windows';
  else if (safeUa.includes('iPhone') || safeUa.includes('iPad')) os = 'iOS';
  else if (safeUa.includes('Android')) os = 'Android';
  else if (safeUa.includes('Mac OS')) os = 'macOS';
  else if (safeUa.includes('CrOS')) os = 'ChromeOS';
  else if (safeUa.includes('Linux')) os = 'Linux';

  let browser = '標準瀏覽器';
  if (safeUa.includes('Line/')) browser = 'LINE 瀏覽器';
  else if (safeUa.includes('FBAN') || safeUa.includes('FBAV')) browser = 'Facebook 瀏覽器';
  else if (safeUa.includes('Instagram')) browser = 'Instagram 瀏覽器';
  else if (safeUa.includes('Edg/')) browser = 'Edge';
  else if (safeUa.includes('Chrome/') && !safeUa.includes('Edg/')) browser = 'Chrome';
  else if (safeUa.includes('Safari/') && !safeUa.includes('Chrome/')) browser = 'Safari';
  else if (safeUa.includes('Firefox/')) browser = 'Firefox';

  return { device, os, browser };
}

const ADMIN_LOGIN_SESSION_PREFIX = 'admin_backend_login_v2_';
const ADMIN_LOGIN_RELOG_INTERVAL_MS = 2 * 60 * 60 * 1000; // 超過 2 小時或跨日重新記錄一次後台登入
const inFlightAdminLoginUids = new Set<string>();

export function clearAdminBackendLoginSessionFlag(uid?: string) {
  if (typeof window === 'undefined') return;
  try {
    if (uid) {
      sessionStorage.removeItem(`${ADMIN_LOGIN_SESSION_PREFIX}${uid}`);
      return;
    }
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && (k.startsWith(ADMIN_LOGIN_SESSION_PREFIX) || k.startsWith('admin_audit_session_logged_'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore sessionStorage errors
  }
}

// 完整記錄管理員登入後台：同步寫入 activityLogs (操作日誌)、userLoginLogs (登入紀錄)、users/{uid} 與 admins/{uid}
export async function recordAdminBackendLogin(
  firestore: Firestore,
  params: {
    uid: string;
    email: string;
    name: string;
    photoURL?: string | null;
    isSuperAdmin: boolean;
    routePath?: string;
    force?: boolean;
  }
): Promise<boolean> {
  if (typeof window === 'undefined' || !params.uid) return false;

  const sessionKey = `${ADMIN_LOGIN_SESSION_PREFIX}${params.uid}`;
  const nowMs = Date.now();
  const todayKey = new Date(nowMs).toISOString().slice(0, 10);

  if (!params.force) {
    try {
      const raw = sessionStorage.getItem(sessionKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { ts?: number; date?: string };
        if (
          parsed?.date === todayKey &&
          typeof parsed?.ts === 'number' &&
          nowMs - parsed.ts < ADMIN_LOGIN_RELOG_INTERVAL_MS
        ) {
          return true;
        }
      }
    } catch {
      // ignore corrupted session value
    }
  }

  if (inFlightAdminLoginUids.has(params.uid)) {
    return true;
  }
  inFlightAdminLoginUids.add(params.uid);

  try {
    const clientInfo = await ensureAdminClientInfo();
    const ua = clientInfo.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '');
    const ip = clientInfo.ip || '未知 IP';
    const { device, os, browser } = parseUserAgentDetails(ua);
    const cleanEmail = (params.email || '').trim();
    const roleCode = params.isSuperAdmin ? 'superadmin' : 'admin';
    const roleLabel = params.isSuperAdmin ? '最高主管' : '一般管理員';
    const routePath = params.routePath || window.location.pathname || '/admin';
    const nowIso = new Date().toISOString();

    // 1. 寫入操作日誌 activityLogs
    let activityLogged = false;
    try {
      await rawAddDoc(collection(firestore, 'activityLogs'), {
        adminUid: params.uid,
        userEmail: cleanEmail || '未知信箱',
        userName: params.name || (cleanEmail ? cleanEmail.split('@')[0] : '管理員'),
        adminRole: roleCode,
        adminRoleLabel: roleLabel,
        ipAddress: ip,
        userAgent: ua.slice(0, 240),
        routePath,
        module: 'auth',
        moduleLabel: '後台登入存取',
        operationType: 'login',
        severity: params.isSuperAdmin ? 'info' : 'warning',
        riskTags: [],
        action: '🔑 管理員登入進入後台',
        targetCollection: 'admins',
        targetId: params.uid,
        targetName: params.name,
        details: `${roleLabel}「${params.name}」(${cleanEmail || params.uid}) 登入進入管理後台｜來源 IP: ${ip}｜裝置: ${os} · ${browser}｜入口: ${routePath}`,
        changes: [
          {
            field: 'routePath',
            fieldLabel: '進入後台頁面',
            before: '外部 / 前台',
            after: routePath,
          },
          {
            field: 'clientEnv',
            fieldLabel: '連線 IP 與裝置',
            before: '-',
            after: `${ip} (${os} · ${browser})`,
          },
        ],
        createdAt: serverTimestamp(),
      });
      activityLogged = true;
    } catch (err) {
      console.warn('[AdminAudit] activityLogs login write failed (will retry if rules syncing):', err);
    }

    // 2. 同步寫入登入紀錄 userLoginLogs（讓「登入紀錄」頁面完整呈現所有管理員後台登入軌跡）
    let userLoginLogged = false;
    try {
      await rawAddDoc(collection(firestore, 'userLoginLogs'), {
        userId: params.uid,
        email: cleanEmail,
        username: params.name || (cleanEmail ? cleanEmail.split('@')[0] : '管理員'),
        photoURL: params.photoURL || null,
        loginMethod: 'admin-backend',
        loginMethodName: '管理員進入後台',
        isAdminBackendLogin: true,
        adminRole: roleCode,
        adminRoleLabel: roleLabel,
        routePath,
        ip,
        device,
        browser,
        os,
        userAgent: ua.slice(0, 240),
        status: 'success',
        createdAt: serverTimestamp(),
        loginTime: nowIso,
      });
      userLoginLogged = true;
    } catch (err) {
      console.warn('[AdminAudit] userLoginLogs write failed:', err);
    }

    // 3. 同步更新 users/{uid} 與 admins/{uid} 最近登入時間與 IP，讓「會員資訊」與「管理員狀態」皆顯示最新登入紀錄
    if (activityLogged || userLoginLogged) {
      void rawSetDoc(
        rawDoc(firestore, 'users', params.uid),
        {
          lastLoginAt: serverTimestamp(),
          lastLoginTime: nowIso,
          lastLoginMethod: 'admin-backend',
        },
        { merge: true }
      ).catch(() => {});

      void rawSetDoc(
        rawDoc(firestore, 'admins', params.uid),
        {
          uid: params.uid,
          email: cleanEmail.toLowerCase(),
          username: params.name,
          isAdmin: true,
          lastLoginAt: serverTimestamp(),
          lastLoginTime: nowIso,
          lastLoginIp: ip,
          lastLoginDevice: `${os} · ${browser}`,
        },
        { merge: true }
      ).catch(() => {});
    }

    // 只有當 activityLogs 成功寫入時才標記 session，確保新指派管理員首次同步權限期間不會漏記！
    if (activityLogged) {
      try {
        sessionStorage.setItem(sessionKey, JSON.stringify({ ts: nowMs, date: todayKey }));
      } catch {
        // ignore storage quota errors
      }
      return true;
    }

    return false;
  } finally {
    inFlightAdminLoginUids.delete(params.uid);
  }
}

// 寫入單筆管理員操作稽核紀錄至 Firestore `activityLogs`
export async function recordAdminActivityLog(
  firestore: Firestore,
  entry: Omit<
    AdminActivityLogPayload,
    | 'adminUid'
    | 'userEmail'
    | 'userName'
    | 'adminRole'
    | 'adminRoleLabel'
    | 'ipAddress'
    | 'userAgent'
    | 'routePath'
    | 'createdAt'
  > & { routePath?: string }
): Promise<boolean> {
  try {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      const isAllowedAdminAction =
        p.startsWith('/admin') ||
        entry.targetCollection === 'lucky_wheels' ||
        entry.operationType === 'login';
      if (!isAllowedAdminAction) {
        return false;
      }
    }

    await ensureAdminClientInfo();
    const operator = resolveCurrentOperator();
    if (!operator.uid || operator.uid === 'unknown') return false;

    const payload: Record<string, any> = {
      adminUid: operator.uid,
      userEmail: operator.email,
      userName: operator.name,
      adminRole: operator.isSuperAdmin ? 'superadmin' : 'admin',
      adminRoleLabel: operator.isSuperAdmin ? '最高主管' : '一般管理員',
      ipAddress: operator.ipAddress || '未知 IP',
      userAgent: operator.userAgent || '',
      routePath: entry.routePath || operator.routePath || '/admin',
      module: entry.module,
      moduleLabel: entry.moduleLabel,
      operationType: entry.operationType,
      severity: entry.severity,
      riskTags: entry.riskTags || [],
      action: entry.action,
      targetCollection: entry.targetCollection || '',
      targetId: entry.targetId || '',
      targetName: entry.targetName || '',
      details: entry.details,
      changes: entry.changes || [],
      createdAt: serverTimestamp(),
    };

    if (entry.batchCount !== undefined) payload.batchCount = entry.batchCount;
    if (entry.batchItems !== undefined) payload.batchItems = entry.batchItems.slice(0, 30);

    await rawAddDoc(collection(firestore, 'activityLogs'), payload);
    return true;
  } catch (err) {
    console.warn('[AdminAudit] Failed to write activity log:', err);
    return false;
  }
}

const ADMIN_API_ACTION_MAP: Record<
  string,
  { module: string; moduleLabel: string; action: string; severity: AuditSeverity }
> = {
  '/api/admin/send-marketing-email': {
    module: 'marketing',
    moduleLabel: '行銷與公告',
    action: '發送行銷通知郵件',
    severity: 'warning',
  },
  '/api/admin/referral/config': {
    module: 'coupons',
    moduleLabel: '優惠與回饋',
    action: '變更推薦獎勵全域設定',
    severity: 'warning',
  },
  '/api/admin/referral': {
    module: 'coupons',
    moduleLabel: '優惠與回饋',
    action: '建立或更新專屬推薦碼',
    severity: 'warning',
  },
  '/api/admin/predictions/settle': {
    module: 'marketing',
    moduleLabel: '行銷與公告',
    action: '結算預測活動獎勵',
    severity: 'critical',
  },
  '/api/admin/fetch-exhibitions': {
    module: 'marketing',
    moduleLabel: '行銷與公告',
    action: '同步卡展行事曆活動',
    severity: 'info',
  },
  '/api/admin/verify-smtp': {
    module: 'system',
    moduleLabel: '系統與安全設定',
    action: '測試驗證 SMTP 郵件伺服器',
    severity: 'info',
  },
  '/api/admin/generate-image': {
    module: 'materials',
    moduleLabel: '行銷與公告',
    action: '使用 AI 產生視覺圖片素材',
    severity: 'info',
  },
};

export function logAdminApiCall(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  response: Response,
  firestoreOverride?: Firestore | null
) {
  const targetFirestore = firestoreOverride || activeAuditFirestore;
  if (!targetFirestore || !response?.ok) return;

  if (loggedApiResponses) {
    if (loggedApiResponses.has(response)) return;
    loggedApiResponses.add(response);
  }

  const urlStr =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.pathname
      : input.url;
  const method = (init?.method || 'GET').toUpperCase();

  if (
    !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ||
    !urlStr.includes('/api/admin/') ||
    urlStr.includes('/api/admin/client-info') ||
    urlStr.includes('/api/admin/scan-cards')
  ) {
    return;
  }

  const cleanPath = urlStr.split('?')[0];
  const matchedKey = Object.keys(ADMIN_API_ACTION_MAP).find((k) => cleanPath.endsWith(k));
  const meta = matchedKey
    ? ADMIN_API_ACTION_MAP[matchedKey]
    : {
        module: 'system',
        moduleLabel: '系統 API 操作',
        action: `執行後台 API (${cleanPath})`,
        severity: 'warning' as AuditSeverity,
      };

  let bodyPreview = '';
  if (typeof init?.body === 'string' && init.body.length < 2000) {
    try {
      const parsed = JSON.parse(init.body);
      const summaryParts = Object.entries(parsed)
        .filter(([k]) => !['password', 'pass', 'smtpPass', 'smtpConfig', 'html', 'contentHtml', 'imageBase64', 'recipients'].includes(k))
        .slice(0, 4)
        .map(
          ([k, v]) =>
            `${k}: ${typeof v === 'object' ? JSON.stringify(v).slice(0, 40) : String(v).slice(0, 40)}`
        );
      if (summaryParts.length > 0) bodyPreview = ` — ${summaryParts.join(' ｜ ')}`;
    } catch {
      // ignore non-json body
    }
  }

  void recordAdminActivityLog(targetFirestore, {
    module: meta.module,
    moduleLabel: meta.moduleLabel,
    operationType: 'api',
    severity: meta.severity,
    action: meta.action,
    targetCollection: 'api',
    targetId: cleanPath,
    targetName: cleanPath,
    details: `${meta.action} [${method}]${bodyPreview}`,
  });
}

export async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  logAdminApiCall(input, init, response);
  return response;
}
