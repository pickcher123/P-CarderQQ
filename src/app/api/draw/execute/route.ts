import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { drawFromPool, drawKujiTickets } from '@/lib/draw-utils';
import { createProvablyFairRound } from '@/lib/provably-fair';
import { cleanFirestoreData } from '@/lib/utils';
import { format } from 'date-fns';
import type { Card, CardPool } from '@/types/draw';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const LOCK_DURATION = 120;

function isAdminCredentialError(err: any): boolean {
    const msg = String(err?.message || err || '').toLowerCase();
    return (
        msg.includes('could not load the default credentials') ||
        msg.includes('unable to detect a project id') ||
        msg.includes('metadata') ||
        msg.includes('econnrefused') ||
        msg.includes('enotfound') ||
        msg.includes('service account') ||
        msg.includes('getaddrinfo')
    );
}

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('authorization') || '';
        const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

        if (!idToken) {
            return NextResponse.json({ success: false, error: '請先登入帳戶後再進行抽卡。' }, { status: 401 });
        }

        const adminAuth = getAdminAuth();
        const adminDb = getAdminDb();

        if (!adminAuth || !adminDb) {
            return NextResponse.json(
                {
                    success: false,
                    code: 'ADMIN_UNAVAILABLE',
                    allowDevFallback: process.env.NODE_ENV !== 'production',
                    error: '後端資料庫尚未就緒，請稍後再試。',
                },
                { status: 503 }
            );
        }

        // 1. 密碼學驗證 Firebase ID Token（嚴格防偽造 UID）
        let decodedToken: any;
        try {
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (authErr: any) {
            if (isAdminCredentialError(authErr)) {
                return NextResponse.json(
                    {
                        success: false,
                        code: 'ADMIN_UNAVAILABLE',
                        allowDevFallback: process.env.NODE_ENV !== 'production',
                        error: '後端驗證服務尚未配置憑證。',
                    },
                    { status: 503 }
                );
            }
            return NextResponse.json({ success: false, error: '登入憑證已過期或無效，請重新登入後再試。' }, { status: 401 });
        }

        const uid: string = decodedToken.uid;
        const body = await req.json();
        const poolId = typeof body.poolId === 'string' ? body.poolId.trim() : '';
        const rawCount = Number(body.count ?? 1);
        const count = Number.isFinite(rawCount) ? Math.max(1, Math.min(100, Math.floor(rawCount))) : 1;
        const useTicketMode = Boolean(body.useTicketMode);
        const useEventTicketMode = Boolean(body.useEventTicketMode);
        const numbersToDraw: number[] | undefined = Array.isArray(body.numbersToDraw)
            ? body.numbersToDraw.map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n) && n > 0)
            : undefined;

        if (!poolId) {
            return NextResponse.json({ success: false, error: '缺少卡池 ID。' }, { status: 400 });
        }

        const todayStr = format(new Date(), 'yyyy-MM-dd');

        // 2. 在伺服器端執行完整原子交易（扣款、抽獎計算、鎖定卡池、寫入收藏與日誌）
        const txResult = await adminDb.runTransaction(async (transaction: any) => {
            const userDocRef = adminDb.collection('users').doc(uid);
            const poolDocRef = adminDb.collection('cardPools').doc(poolId);
            const poolStatsRef = adminDb.collection('users').doc(uid).collection('poolStats').doc(poolId);
            const sysConfigRef = adminDb.collection('systemConfig').doc('main');

            const [userSnap, poolSnap, poolStatsSnap, sysSnap] = await Promise.all([
                transaction.get(userDocRef),
                transaction.get(poolDocRef),
                transaction.get(poolStatsRef),
                transaction.get(sysConfigRef),
            ]);

            if (!poolSnap.exists) {
                throw new Error('此卡池已下架或不存在。');
            }

            const poolData = { id: poolSnap.id, ...poolSnap.data() } as CardPool;

            // 預先讀取卡池關聯的所有實體卡片主檔（供原子鎖定 isSold 與完整資訊寫入）
            const txCardsMap = new Map<string, Card>();
            const existingAllCardIds = new Set<string>();
            const referencedCardIds = new Set<string>();

            if (Array.isArray(poolData.cards)) {
                poolData.cards.forEach((c: any) => {
                    if (c?.cardId) referencedCardIds.add(String(c.cardId));
                });
            }
            if (Array.isArray(poolData.kujiTickets)) {
                poolData.kujiTickets.forEach((t: any) => {
                    if (t?.cardId) referencedCardIds.add(String(t.cardId));
                });
            }
            if (poolData.lastPrizeCardId) {
                referencedCardIds.add(String(poolData.lastPrizeCardId));
            }

            if (referencedCardIds.size > 0) {
                const cardRefs = Array.from(referencedCardIds).map((cid) => adminDb.collection('allCards').doc(cid));
                const fetchedCardSnaps = await Promise.all(cardRefs.map((ref) => transaction.get(ref)));
                fetchedCardSnaps.forEach((cSnap: any) => {
                    if (cSnap.exists) {
                        existingAllCardIds.add(cSnap.id);
                        txCardsMap.set(cSnap.id, { id: cSnap.id, ...cSnap.data() } as Card);
                    }
                });
            }

            let userData = userSnap.data();
            if (!userSnap.exists || !userData) {
                userData = {
                    id: uid,
                    points: 1000,
                    bonusPoints: 0,
                    freeDrawTickets: 0,
                    eventPoolTickets: {},
                    role: 'user',
                    userLevel: '普通會員',
                    createdAt: FieldValue.serverTimestamp(),
                };
                transaction.set(userDocRef, userData);
            }

            // 驗證 120 秒開獎保護鎖定
            if (poolData.hasProtection !== false && poolData.lockedAt && poolData.lockedBy && poolData.lockedBy !== uid) {
                const lockSecs = typeof (poolData.lockedAt as any).seconds === 'number'
                    ? (poolData.lockedAt as any).seconds
                    : (typeof (poolData.lockedAt as any).toMillis === 'function'
                        ? Math.floor((poolData.lockedAt as any).toMillis() / 1000)
                        : Math.floor(new Date(poolData.lockedAt as any).getTime() / 1000));
                const rawDiff = Math.floor(Date.now() / 1000 - lockSecs);
                if (rawDiff < LOCK_DURATION) {
                    const remaining = Math.min(LOCK_DURATION, Math.max(1, LOCK_DURATION - Math.max(0, rawDiff)));
                    throw new Error(`開獎保護中：其他玩家正在開獎，請稍等 ${remaining} 秒。`);
                }
            }

            // 驗證活動專屬限制
            if (poolData.isEventPool && poolData.exclusiveTicketOnly && !useEventTicketMode) {
                throw new Error(`此卡池為專屬活動卡池，僅限使用管理員派發之【${poolData.eventTicketName || '專屬活動抽卡券'}】！`);
            }

            const effectiveUseTicket = !useEventTicketMode && useTicketMode;
            const actualDrawCount = effectiveUseTicket ? 1 : (numbersToDraw && numbersToDraw.length > 0 ? numbersToDraw.length : count);

            // 檢查卡池剩餘庫存包數
            if (poolData.remainingPacks !== undefined && poolData.remainingPacks !== null) {
                if (poolData.remainingPacks <= 0) {
                    throw new Error('此卡池已全數售罄！');
                }
                if (poolData.remainingPacks < actualDrawCount) {
                    throw new Error(`卡池目前僅剩餘 ${poolData.remainingPacks} 包，無法抽取 ${actualDrawCount} 包！`);
                }
            }

            // 檢查每日限抽次數
            const poolStatsData = poolStatsSnap.exists ? poolStatsSnap.data() : { count: 0, totalCount: 0, lastDrawDate: '' };
            const todayCount = poolStatsData.lastDrawDate === todayStr ? (poolStatsData.count || 0) : 0;
            if (poolData.dailyLimit && poolData.dailyLimit > 0 && todayCount + actualDrawCount > poolData.dailyLimit) {
                throw new Error(`此卡池每日限抽 ${poolData.dailyLimit} 次，您今日已抽取 ${todayCount} 次。`);
            }

            // 檢查活動專屬每人最大抽取限制
            if (poolData.isEventPool && poolData.eventMaxDrawsPerUser && poolData.eventMaxDrawsPerUser > 0) {
                const userTotalDraws = (poolStatsData.totalCount || poolStatsData.count || 0);
                if (userTotalDraws + actualDrawCount > poolData.eventMaxDrawsPerUser) {
                    throw new Error(`此活動卡池每位玩家最多僅限抽取 ${poolData.eventMaxDrawsPerUser} 次，您目前已累積抽取 ${userTotalDraws} 次。`);
                }
            }

            // 計算與驗證費用／抽卡券
            const basePrice = poolData.price || 0;
            const cost = (useEventTicketMode || effectiveUseTicket)
                ? 0
                : (actualDrawCount === 1
                    ? basePrice
                    : actualDrawCount === 3
                        ? (poolData.price3Draws || basePrice * 3)
                        : actualDrawCount === 10
                            ? (poolData.price10Draws || basePrice * 10)
                            : basePrice * actualDrawCount);

            const currencyField = poolData.currency === 'p-point' ? 'bonusPoints' : 'points';
            const balance = Number(userData[currencyField] || 0);
            const tickets = Number(userData.freeDrawTickets || 0);
            const eventTicketsMap = userData.eventPoolTickets || {};
            const currentEventTickets = typeof eventTicketsMap[poolId] === 'number' ? eventTicketsMap[poolId] : 0;

            if (useEventTicketMode) {
                if (currentEventTickets < actualDrawCount) {
                    throw new Error(`【${poolData.eventTicketName || '活動專屬抽卡券'}】不足！您持有 ${currentEventTickets} 張，本次需消耗 ${actualDrawCount} 張。`);
                }
            } else if (effectiveUseTicket) {
                if (poolData.allowFreeDraw === false) {
                    throw new Error('此卡池目前未開放免費抽卡券兌換。');
                }
                if (tickets < 1) {
                    throw new Error('您的活動免費抽卡券不足，請先至領券中心領取！');
                }
            } else {
                if (balance < cost) {
                    throw new Error('點數不足，無法抽卡。');
                }
            }

            // 進行伺服器端抽卡計算（核心防作弊）
            const isKujiPool = !!(poolData.enablePickNumber || (poolData.kujiTickets && poolData.kujiTickets.length > 0));
            let drawn: any[] = [];
            let updatedCards: any[] = [];
            let updatedPointPrizes: any[] = [];
            let updatedTickets: any[] | undefined = undefined;

            if (isKujiPool || (numbersToDraw && numbersToDraw.length > 0)) {
                if (poolData.kujiTickets && poolData.kujiTickets.length > 0 && numbersToDraw && numbersToDraw.length > 0) {
                    for (const num of numbersToDraw) {
                        const found = poolData.kujiTickets.find((t: any) => t.number === num);
                        if (!found) throw new Error(`號碼 #${num} 不存在於此卡池中。`);
                        if (found.isDrawn) throw new Error(`號碼 #${num} 剛剛已被其他玩家抽走，請重新挑選其他號碼！`);
                    }
                }
                const kujiRes = drawKujiTickets(poolData, numbersToDraw, actualDrawCount, txCardsMap);
                drawn = kujiRes.drawn;
                updatedCards = kujiRes.updatedCards;
                updatedPointPrizes = kujiRes.updatedPointPrizes;
                updatedTickets = kujiRes.updatedTickets;
            } else {
                const storeProtection = sysSnap.exists ? (sysSnap.data() as any)?.storeProtection : undefined;
                const normalRes = drawFromPool(poolData, actualDrawCount, txCardsMap, false, storeProtection);
                drawn = normalRes.drawn;
                updatedCards = normalRes.updatedCards;
                updatedPointPrizes = normalRes.updatedPointPrizes;
            }

            if (drawn.length === 0) {
                throw new Error('卡池目前已無獎項可供抽取。');
            }

            const packsConsumed = drawn.length;
            let claimLastPrize = false;

            // 檢查並派發最後賞 (Last One Prize)
            if (
                poolData.remainingPacks !== undefined &&
                poolData.remainingPacks !== null &&
                poolData.remainingPacks - packsConsumed <= 0 &&
                poolData.lastPrizeCardId &&
                !(poolData as any).lastPrizeClaimed
            ) {
                const lpId = String(poolData.lastPrizeCardId);
                const lpDetails = txCardsMap.get(lpId);
                drawn.push({
                    id: lpId,
                    name: lpDetails?.name || '最後賞限定大獎',
                    imageUrl: lpDetails?.imageUrl || '',
                    backImageUrl: lpDetails?.backImageUrl || '',
                    serialNumber: '',
                    imageHint: lpDetails?.name || '最後賞限定大獎',
                    category: (lpDetails?.category && lpDetails.category !== '抽賞' && lpDetails.category !== 'all') ? lpDetails.category : '一般',
                    rarity: 'legendary',
                    sellPrice: lpDetails?.sellPrice || 0,
                    type: 'last-prize',
                });
                claimLastPrize = true;
            }

            // 寫入收藏庫與原子鎖定已抽出實體卡
            const drawSource = useEventTicketMode ? 'event_ticket_draw' : (effectiveUseTicket ? 'promo_ticket_draw' : 'draw');
            const soldCardIdsToLock = new Set<string>();

            for (const prize of drawn) {
                const newUserCardRef = adminDb.collection('users').doc(uid).collection('userCards').doc();
                const serialNumber = `${crypto.randomInt(1000, 10000)}`;
                const isPointOrRandom = prize.type === 'points' || Boolean(prize.isPoints) || Boolean(prize.name?.includes('隨機球員'));
                const rawId = String(prize.id || '');

                const cardPayload: any = isPointOrRandom
                    ? {
                        cardId: rawId.startsWith('random-player-') ? rawId : `random-player-${rawId || 'points_50'}`,
                        name: prize.name || '隨機球員 普/特 卡',
                        userId: uid,
                        category: '抽賞',
                        rarity: prize.rarity || 'common',
                        isFoil: false,
                        isPoints: true,
                        points: Number(prize.points || 50),
                        source: drawSource,
                        poolId,
                        poolName: poolData.name || '',
                        serialNumber,
                        createdAt: FieldValue.serverTimestamp(),
                    }
                    : {
                        cardId: rawId,
                        name: prize.name || '典藏球員卡',
                        imageUrl: prize.imageUrl || '',
                        backImageUrl: prize.backImageUrl || '',
                        sellPrice: Number(prize.sellPrice || 0),
                        userId: uid,
                        category: (prize.category && !['抽賞', 'all', 'normal'].includes(prize.category)) ? prize.category : '一般',
                        rarity: prize.rarity || 'common',
                        isFoil: prize.rarity === 'legendary' || prize.type === 'last-prize',
                        isPoints: false,
                        source: drawSource,
                        poolId,
                        poolName: poolData.name || '',
                        serialNumber,
                        ...(prize.tierCode ? { tierCode: prize.tierCode } : {}),
                        ...(prize.buybackPoints ? { buybackPoints: prize.buybackPoints } : {}),
                        createdAt: FieldValue.serverTimestamp(),
                    };

                if (prize.ticketNumber !== undefined && prize.ticketNumber !== null) {
                    cardPayload.ticketNumber = prize.ticketNumber;
                }

                transaction.set(newUserCardRef, cleanFirestoreData(cardPayload));
                prize.serialNumber = serialNumber;
                prize.userCardId = newUserCardRef.id;

                if (!isPointOrRandom && rawId && existingAllCardIds.has(rawId)) {
                    soldCardIdsToLock.add(rawId);
                }
            }

            soldCardIdsToLock.forEach((soldCardId) => {
                transaction.update(adminDb.collection('allCards').doc(soldCardId), {
                    isSold: true,
                    status: 'sold',
                    soldVia: 'draw',
                    soldFromPoolId: poolId,
                    soldBy: uid,
                    soldAt: FieldValue.serverTimestamp(),
                });
            });

            // 扣除使用者資產
            const updateFields: any = {};
            if (useEventTicketMode) {
                updateFields[`eventPoolTickets.${poolId}`] = Math.max(0, currentEventTickets - actualDrawCount);
            } else if (effectiveUseTicket) {
                updateFields.freeDrawTickets = Math.max(0, tickets - 1);
            } else if (poolData.currency === 'p-point') {
                updateFields.bonusPoints = FieldValue.increment(-cost);
            } else {
                updateFields.points = FieldValue.increment(-cost);
            }
            transaction.update(userDocRef, cleanFirestoreData(updateFields));

            // 更新卡池庫存與 120 秒保護鎖
            const nextRemainingPacks = Math.max(0, Number(poolData.remainingPacks ?? 0) - packsConsumed);
            const poolUpdates: any = {
                remainingPacks: FieldValue.increment(-packsConsumed),
                cards: updatedCards,
            };
            if (poolData.hasProtection !== false) {
                if (nextRemainingPacks > 0) {
                    poolUpdates.lockedBy = uid;
                    poolUpdates.lockedAt = FieldValue.serverTimestamp();
                } else {
                    poolUpdates.lockedBy = null;
                    poolUpdates.lockedAt = null;
                }
            }
            if (updatedPointPrizes && updatedPointPrizes.length > 0) {
                poolUpdates.pointPrizes = updatedPointPrizes;
            }
            if (updatedTickets && updatedTickets.length > 0) {
                poolUpdates.kujiTickets = updatedTickets;
            }
            if (claimLastPrize) {
                poolUpdates.lastPrizeClaimed = true;
            }
            if (drawn.some((p: any) => p.tierCode === 'SP')) {
                poolUpdates.spRevealed = true;
            }
            transaction.update(poolDocRef, cleanFirestoreData(poolUpdates));

            // 明池盲開＋隱藏 SP 公開開獎紀錄
            if (poolData.isHybridBlindSpMode) {
                const totalPacksNum = Number(poolData.totalPacks || 100);
                const prevRemainingNum = Number(poolData.remainingPacks ?? totalPacksNum);
                const rawDisplayName = String(userData?.displayName || userData?.username || userData?.email || uid);
                const maskedUsername = rawDisplayName.length <= 2
                    ? `${rawDisplayName[0] || 'u'}***`
                    : `${rawDisplayName.slice(0, 2)}***${rawDisplayName.slice(-1)}`;
                drawn.forEach((p: any, idx: number) => {
                    const pullNumber = p.type === 'last-prize'
                        ? totalPacksNum
                        : Math.max(1, totalPacksNum - prevRemainingNum + idx + 1);
                    const publicLogRef = adminDb.collection('cardPools').doc(poolId).collection('drawLogs').doc();
                    transaction.set(publicLogRef, cleanFirestoreData({
                        poolId,
                        pullNumber,
                        userId: uid,
                        maskedUsername,
                        tierCode: p.type === 'last-prize' ? 'LAST' : (p.tierCode || (p.rarity === 'legendary' ? 'A' : p.rarity === 'rare' ? 'B' : 'D')),
                        prizeId: String(p.id || ''),
                        prizeName: p.name || '典藏卡包獎項',
                        userCardId: p.userCardId || null,
                        isOpened: true,
                        redeemedAsPoints: false,
                        createdAt: FieldValue.serverTimestamp(),
                    }));
                });
            }

            // 紀錄交易日誌與 Provably Fair
            const pfRound = await createProvablyFairRound({
                clientSeed: `${uid.substring(0, 8)}_${Date.now()}`,
                outcomeType: 'draw',
                poolSize: poolData.totalPacks || 80,
            });

            const notablePrize = drawn.find((p: any) => (p.type === 'card' || p.type === 'last-prize') && (p.rarity === 'legendary' || p.rarity === 'rare')) || drawn[0];
            const primaryCardName = notablePrize?.name || (notablePrize as any)?.cardName || '卡牌';
            const prizeSummaryText = drawn.length === 1
                ? `獲得【${primaryCardName}】`
                : `獲得【${primaryCardName}】等共 ${drawn.length} 張卡牌`;

            const transactionRef = adminDb.collection('transactions').doc();
            transaction.set(transactionRef, cleanFirestoreData({
                userId: uid,
                transactionType: 'Draw',
                currency: useEventTicketMode ? 'event_ticket' : (effectiveUseTicket ? 'free_ticket' : (poolData.currency || 'diamond')),
                amount: (useEventTicketMode || effectiveUseTicket) ? 0 : -cost,
                details: useEventTicketMode
                    ? `在活動卡池 [${poolData.name}] 使用專屬抽卡券【${poolData.eventTicketName || '活動券'}】 (${actualDrawCount} 抽) - ${prizeSummaryText}`
                    : (effectiveUseTicket
                        ? `在卡池 [${poolData.name}] 使用活動免費抽卡券 (1抽) - ${prizeSummaryText}`
                        : `在卡池 [${poolData.name}] 抽卡 (${actualDrawCount} 抽) - ${prizeSummaryText}`),
                cardName: primaryCardName,
                prizeNames: drawn.map((p: any) => p.name || (p as any).cardName || '卡牌'),
                poolName: poolData.name || '',
                poolId,
                serverVerified: true,
                transactionDate: FieldValue.serverTimestamp(),
                section: 'draw',
                provablyFair: {
                    serverSeed: pfRound.serverSeed,
                    serverHash: pfRound.serverHash,
                    clientSeed: pfRound.clientSeed,
                    nonce: pfRound.nonce,
                    outcomeType: 'pack',
                    cardName: primaryCardName,
                    poolSize: poolData.totalPacks || 80,
                    timestamp: Date.now(),
                },
            }));

            const logRef = adminDb.collection('drawnCardLogs').doc();
            transaction.set(logRef, cleanFirestoreData({
                userId: uid,
                poolId,
                agentId: (poolData as any).agentId || null,
                drawnAt: FieldValue.serverTimestamp(),
                cost,
                count: actualDrawCount,
                isTicket: effectiveUseTicket || useEventTicketMode,
                isEventTicket: useEventTicketMode,
                serverVerified: true,
                prizes: drawn.map((p: any) => ({ id: p.id, name: p.name, rarity: p.rarity, type: p.type })),
            }));

            const newCount = todayCount + packsConsumed;
            const newTotalCount = (poolStatsData.totalCount || poolStatsData.count || 0) + packsConsumed;
            transaction.set(poolStatsRef, cleanFirestoreData({
                count: newCount,
                totalCount: newTotalCount,
                lastDrawDate: todayStr,
            }), { merge: true });

            return {
                drawn,
                packsConsumed,
                claimLastPrize,
                updatedCards,
                updatedPointPrizes,
                updatedTickets,
                nextRemainingPacks,
                hasProtection: poolData.hasProtection !== false,
                isBlindBoxMode: Boolean(poolData.isBlindBoxMode),
                poolName: poolData.name || '',
                winnerName: userData?.username || decodedToken.name || '神秘藏家',
            };
        });

        // 非同步發布中獎榮譽榜公告（盲盒模式不播報）
        if (!txResult.isBlindBoxMode) {
            const bigHits = txResult.drawn.filter(
                (p: any) => (p.type === 'card' || p.type === 'last-prize') && (p.rarity === 'legendary' || p.rarity === 'rare')
            );
            if (bigHits.length > 0) {
                Promise.allSettled(
                    bigHits.map((hit: any) =>
                        adminDb.collection('announcements').add(
                            cleanFirestoreData({
                                username: txResult.winnerName,
                                action: hit.type === 'last-prize' ? '抱走了最後賞' : '抽中了',
                                prize: hit.name || '精選頂級球員卡',
                                prizeImageUrl: hit.imageUrl || '',
                                rarity: hit.rarity || 'legendary',
                                section: 'draw',
                                poolName: txResult.poolName,
                                timestamp: FieldValue.serverTimestamp(),
                            })
                        )
                    )
                ).catch(() => {});
            }
        }

        return NextResponse.json({
            success: true,
            mode: 'server',
            drawn: txResult.drawn,
            packsConsumed: txResult.packsConsumed,
            claimLastPrize: txResult.claimLastPrize,
            updatedCards: txResult.updatedCards,
            updatedPointPrizes: txResult.updatedPointPrizes,
            updatedTickets: txResult.updatedTickets,
            nextRemainingPacks: txResult.nextRemainingPacks,
            winnerName: txResult.winnerName,
        });
    } catch (err: any) {
        if (isAdminCredentialError(err)) {
            return NextResponse.json(
                {
                    success: false,
                    code: 'ADMIN_UNAVAILABLE',
                    allowDevFallback: process.env.NODE_ENV !== 'production',
                    error: '後端資料庫憑證尚未配置。',
                },
                { status: 503 }
            );
        }
        const message = err?.message || '抽卡過程發生錯誤，請稍後再試。';
        return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
}
