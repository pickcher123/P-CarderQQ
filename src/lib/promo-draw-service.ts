import { Firestore } from 'firebase/firestore';

export interface PromoCodeDefinition {
  code: string;
  label: string;
  freePlays: number;
  description: string;
  source: string;
}

async function getBearerHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { getAuth } = await import('firebase/auth');
    const token = await getAuth().currentUser?.getIdToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // ignore if auth not initialized
  }
  return headers;
}

/**
 * 產生用戶的邀請碼 (CARD-前6碼)
 */
export function generateUserInviteCode(userId: string): string {
  if (!userId) return 'CARD-VIP';
  const cleanId = userId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `CARD-${cleanId.slice(0, 6).padEnd(6, '8')}`;
}

/**
 * 領取新玩家免費首抽禮包 (1次) — 透過後端 API 驗證並原子派券
 */
export async function claimWelcomeFreeDraw(_firestore: Firestore, userId: string, _userName?: string) {
  if (!userId) throw new Error('使用者未登入');
  const res = await fetch('/api/promo/redeem', {
    method: 'POST',
    headers: await getBearerHeaders(),
    body: JSON.stringify({ action: 'claim_welcome' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || '領取失敗，請稍後再試');
  }
  return data;
}

/**
 * 輸入隱藏／VIP 兌換碼領取抽卡券 — 序號完全由後端伺服器驗證，前端不儲存任何密鑰
 */
export async function redeemPromoDrawCode(_firestore: Firestore, userId: string, rawCode: string) {
  if (!userId) throw new Error('使用者未登入');
  const code = rawCode.trim().toUpperCase();
  if (!code) throw new Error('請輸入兌換碼');

  const res = await fetch('/api/promo/redeem', {
    method: 'POST',
    headers: await getBearerHeaders(),
    body: JSON.stringify({ action: 'redeem_code', code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || '此兌換碼無效或已過期，請確認代碼是否輸入正確。');
  }
  return data;
}

/**
 * 點擊加入社群獲得免費首抽券 1 張 (限領一次) — 透過後端 API 驗證派券
 */
export async function claimCommunityFreeDraw(
  _firestore: Firestore,
  userId: string,
  communitySource: string = '官方社群'
) {
  if (!userId) throw new Error('使用者未登入');
  const res = await fetch('/api/promo/redeem', {
    method: 'POST',
    headers: await getBearerHeaders(),
    body: JSON.stringify({ action: 'claim_community', source: communitySource }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || '領取失敗，請稍後再試');
  }
  return data;
}

/**
 * 自動同步瀏覽器 localStorage 內的領券紀錄至後端驗證入帳（僅限伺服器白名單內的合法序號）
 */
export async function syncLocalPromoClaimsToFirestore(_firestore: Firestore, userId: string): Promise<number> {
  if (!userId || typeof window === 'undefined') return 0;

  try {
    const raw1 = localStorage.getItem('card_exhibition_promo_claims');
    const raw2 = localStorage.getItem('promo_claim_history');
    const list1: any[] = raw1 ? JSON.parse(raw1) : [];
    const list2: any[] = raw2 ? JSON.parse(raw2) : [];
    const combined = [...(Array.isArray(list1) ? list1 : []), ...(Array.isArray(list2) ? list2 : [])];
    if (combined.length === 0) return 0;

    const codes = combined
      .filter((item) => item && (item.status === 'ACTIVE' || !item.status) && item.code)
      .map((item) => String(item.code).trim().toUpperCase())
      .filter(Boolean);

    if (codes.length === 0) return 0;

    const res = await fetch('/api/promo/redeem', {
      method: 'POST',
      headers: await getBearerHeaders(),
      body: JSON.stringify({ action: 'sync_codes', codes }),
    });
    const data = await res.json().catch(() => ({}));

    clearLocalPromoClaims();
    return Number(data.ticketsAdded || 0);
  } catch (err) {
    console.warn('syncLocalPromoClaimsToFirestore warning:', err);
    return 0;
  }
}

/**
 * 清除本地暫存領取紀錄
 */
export function clearLocalPromoClaims() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('card_exhibition_promo_claims');
    localStorage.removeItem('promo_claim_history');
  } catch {
    // ignore
  }
}

/**
 * 從本地 localStorage 計算所有已領取的免費券總張數
 */
export function getLocalAvailableTicketsCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    let count = 0;
    const claimsRaw = localStorage.getItem('card_exhibition_promo_claims');
    if (claimsRaw) {
      const claims = JSON.parse(claimsRaw);
      if (Array.isArray(claims)) {
        claims.forEach((c: any) => {
          count += c.freePlays || 1;
        });
      }
    }
    const historyRaw = localStorage.getItem('promo_claim_history');
    if (historyRaw) {
      const history = JSON.parse(historyRaw);
      if (Array.isArray(history)) {
        history.forEach((h: any) => {
          if (h.code && !claimsRaw?.includes(h.code)) {
            count += h.freePlays || 1;
          }
        });
      }
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * 取得用戶真正的有效免費抽卡券張數（已登入會員一律以 Firestore 帳號內存量為準）
 */
export function getEffectiveTicketCount(userProfile?: any): number {
  if (userProfile && typeof userProfile.freeDrawTickets === 'number') {
    return Math.max(0, userProfile.freeDrawTickets);
  }
  return getLocalAvailableTicketsCount();
}
