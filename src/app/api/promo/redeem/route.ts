import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyUserRequest } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

interface ServerPromoCodeDef {
  code: string;
  label: string;
  freePlays: number;
  description: string;
  source: string;
}

// 所有隱藏／VIP 兌換碼僅存放於伺服器端（不會打包進前端 JavaScript）
const SERVER_PROMO_CODES: Record<string, ServerPromoCodeDef> = {
  OPEN2024: {
    code: 'OPEN2024',
    label: '🎉 盛大開幕・全場免費首抽',
    freePlays: 1,
    description: '慶祝盛大開幕，全場卡池免費抽卡券 1 張！',
    source: 'LINE 官方社群',
  },
  LUCKYCARD: {
    code: 'LUCKYCARD',
    label: '🎁 轉盤專屬・加碼券',
    freePlays: 2,
    description: '轉盤大福袋專屬 2 次抽獎加碼！',
    source: 'DISCORD',
  },
  KUJI888: {
    code: 'KUJI888',
    label: '✨ 一番賞・首抽特典',
    freePlays: 1,
    description: '活動套一番賞免費撕籤 1 次！',
    source: 'IG',
  },
  VIPGIFT: {
    code: 'VIPGIFT',
    label: '👑 貴賓專屬・九宮格券',
    freePlays: 3,
    description: '九宮格盲盒 3 次破箱連線挑戰！',
    source: 'VIP',
  },
  FREE888: {
    code: 'FREE888',
    label: '🎁 幸運發發・限時福利券',
    freePlays: 1,
    description: '官方福利加碼，贈送免費抽卡券 1 張！',
    source: '官網活動',
  },
  CARD2025: {
    code: 'CARD2025',
    label: '🃏 卡迷狂歡・專屬抽卡券',
    freePlays: 1,
    description: '卡迷狂歡季限定！免費抽卡券 1 張！',
    source: 'Discord 卡友群',
  },
  WELCOME: {
    code: 'WELCOME',
    label: '⭐ 新手專屬・見面禮加碼券',
    freePlays: 1,
    description: '新手專屬福利加碼，免費體驗頂級卡池！',
    source: '新手大禮包',
  },
  VIP666: {
    code: 'VIP666',
    label: '👑 尊爵貴賓・特邀抽卡券',
    freePlays: 2,
    description: '特邀貴賓尊榮好禮，免費抽卡券 2 張！',
    source: 'VIP 特邀',
  },
};

function generateUserInviteCode(userId: string): string {
  const cleanId = userId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `CARD-${cleanId.slice(0, 6).padEnd(6, '8')}`;
}

export async function POST(req: Request) {
  try {
    const auth = await verifyUserRequest(req);
    if (!auth.ok) return auth.response;

    const uid = auth.user.uid;
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ success: false, error: '資料庫尚未就緒，請稍後再試。' }, { status: 503 });
    }

    const body = await req.json();
    const action = String(body.action || 'redeem_code');

    // === 1. 領取新玩家首抽禮包 ===
    if (action === 'claim_welcome') {
      const result = await db.runTransaction(async (tx) => {
        const userRef = db.collection('users').doc(uid);
        const snap = await tx.get(userRef);
        if (!snap.exists) {
          throw new Error('找不到會員資料，請重新整理後再試。');
        }
        const data = snap.data() || {};
        if (data.claimedWelcomeTicket || (Array.isArray(data.claimedPromoCodes) && data.claimedPromoCodes.includes('WELCOME_PACK'))) {
          throw new Error('您已經領取過新玩家首抽禮包囉！');
        }
        tx.update(userRef, {
          freeDrawTickets: FieldValue.increment(1),
          claimedWelcomeTicket: true,
          inviteCode: data.inviteCode || generateUserInviteCode(uid),
          claimedPromoCodes: FieldValue.arrayUnion('WELCOME_PACK'),
        });
        return {
          success: true,
          ticketsAdded: 1,
          message: '恭喜獲得新玩家專屬免費抽卡券 1 張！',
        };
      });
      return NextResponse.json(result);
    }

    // === 2. 加入官方社群領取免費抽卡券 (限領乙次) ===
    if (action === 'claim_community') {
      const communitySource = typeof body.source === 'string' && body.source.trim() ? body.source.trim() : '官方社群';
      const result = await db.runTransaction(async (tx) => {
        const userRef = db.collection('users').doc(uid);
        const snap = await tx.get(userRef);
        if (!snap.exists) {
          throw new Error('找不到會員資料，請重新整理後再試。');
        }
        const data = snap.data() || {};
        const already = Boolean(
          data.claimedCommunityTicket ||
          (Array.isArray(data.claimedPromoCodes) && data.claimedPromoCodes.includes('COMMUNITY_JOIN'))
        );
        if (already) {
          return {
            success: false,
            alreadyClaimed: true,
            ticketsAdded: 0,
            message: '您已經領取過社群專屬免費首抽券囉！歡迎在社群與卡友熱情交流！',
          };
        }

        tx.update(userRef, {
          freeDrawTickets: FieldValue.increment(1),
          claimedCommunityTicket: true,
          inviteCode: data.inviteCode || generateUserInviteCode(uid),
          claimedPromoCodes: FieldValue.arrayUnion('COMMUNITY_JOIN'),
        });
        return {
          success: true,
          alreadyClaimed: false,
          ticketsAdded: 1,
          message: `🎉 感謝加入${communitySource}！已為您發送免費首抽券 1 張！`,
        };
      });
      return NextResponse.json(result);
    }

    // === 3. 兌換隱藏／VIP 序號 ===
    if (action === 'redeem_code') {
      const code = String(body.code || '').trim().toUpperCase();
      if (!code) {
        return NextResponse.json({ success: false, error: '請輸入兌換碼' }, { status: 400 });
      }

      // 同時支援內建伺服器序號與 Firestore `promoCodes/{code}` 動態序號
      let promo: ServerPromoCodeDef | null = SERVER_PROMO_CODES[code] || null;
      if (!promo) {
        const dynDoc = await db.collection('promoCodes').doc(code).get();
        if (dynDoc.exists) {
          const d = dynDoc.data() || {};
          if (d.isActive !== false && Number(d.freePlays) > 0) {
            promo = {
              code,
              label: String(d.label || `🎁 專屬兌換碼 ${code}`),
              freePlays: Math.min(20, Math.max(1, Math.floor(Number(d.freePlays)))),
              description: String(d.description || ''),
              source: String(d.source || '官方活動'),
            };
          }
        }
      }

      if (!promo) {
        return NextResponse.json(
          { success: false, error: '此兌換碼無效或已過期，請確認代碼是否輸入正確。' },
          { status: 404 }
        );
      }

      const activePromo = promo;
      const result = await db.runTransaction(async (tx) => {
        const userRef = db.collection('users').doc(uid);
        const snap = await tx.get(userRef);
        if (!snap.exists) {
          throw new Error('找不到會員資料，請重新整理後再試。');
        }
        const data = snap.data() || {};
        const claimedCodes: string[] = Array.isArray(data.claimedPromoCodes) ? data.claimedPromoCodes : [];
        if (claimedCodes.includes(code)) {
          throw new Error(`您已經兌換過「${code}」囉！每組兌換碼限使用乙次。`);
        }

        tx.update(userRef, {
          freeDrawTickets: FieldValue.increment(activePromo.freePlays),
          claimedPromoCodes: FieldValue.arrayUnion(code),
        });

        tx.set(db.collection('transactions').doc(), {
          userId: uid,
          transactionType: 'Issuance',
          section: 'promo',
          currency: 'ticket',
          amount: activePromo.freePlays,
          details: `兌換專屬序號【${code}】：獲得 ${activePromo.freePlays} 張免費抽卡券`,
          transactionDate: FieldValue.serverTimestamp(),
        });

        return {
          success: true,
          ticketsAdded: activePromo.freePlays,
          label: activePromo.label,
          message: `兌換成功！已獲得 ${activePromo.freePlays} 張免費抽卡券！`,
        };
      });

      return NextResponse.json(result);
    }

    // === 4. 安全同步本地暫存序號（僅允許伺服器白名單內的合法序號，禁止偽造張數） ===
    if (action === 'sync_codes') {
      const rawCodes: string[] = Array.isArray(body.codes)
        ? Array.from(new Set<string>(body.codes.map((c: unknown) => String(c || '').trim().toUpperCase()).filter(Boolean))).slice(0, 20)
        : [];

      if (rawCodes.length === 0) {
        return NextResponse.json({ success: true, ticketsAdded: 0 });
      }

      const result = await db.runTransaction(async (tx) => {
        const userRef = db.collection('users').doc(uid);
        const snap = await tx.get(userRef);
        if (!snap.exists) return { success: true, ticketsAdded: 0 };

        const data = snap.data() || {};
        const existingCodes: string[] = Array.isArray(data.claimedPromoCodes) ? data.claimedPromoCodes : [];
        let totalTickets = 0;
        const newCodes: string[] = [];
        let markCommunity = false;

        for (const c of rawCodes) {
          if (existingCodes.includes(c)) continue;
          if (c === 'COMMUNITY_JOIN') {
            if (!data.claimedCommunityTicket) {
              totalTickets += 1;
              newCodes.push('COMMUNITY_JOIN');
              markCommunity = true;
            }
          } else if (SERVER_PROMO_CODES[c]) {
            totalTickets += SERVER_PROMO_CODES[c].freePlays;
            newCodes.push(c);
          }
        }

        if (totalTickets <= 0) {
          return { success: true, ticketsAdded: 0 };
        }

        const updates: Record<string, any> = {
          freeDrawTickets: FieldValue.increment(totalTickets),
          claimedPromoCodes: FieldValue.arrayUnion(...newCodes),
        };
        if (markCommunity) updates.claimedCommunityTicket = true;
        tx.update(userRef, updates);

        return { success: true, ticketsAdded: totalTickets };
      });

      return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, error: '無效的操作類型' }, { status: 400 });
  } catch (error: any) {
    console.error('[API /api/promo/redeem] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || '兌換失敗，請稍後再試。' },
      { status: 400 }
    );
  }
}
