import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// 輕量級記憶體滑動視窗頻率限制（每 IP 每 5 分鐘最多 15 次登入／註冊驗證嘗試）
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX_REQUESTS = 15;
const ipRequestMap = new Map<string, number[]>();

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const timestamps = (ipRequestMap.get(ip) || []).filter((ts) => ts > cutoff);

  if (timestamps.length >= RATE_MAX_REQUESTS) {
    const oldest = timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + RATE_WINDOW_MS - now) / 1000));
    ipRequestMap.set(ip, timestamps);
    return { allowed: false, retryAfterSec };
  }

  timestamps.push(now);
  ipRequestMap.set(ip, timestamps);

  // 防止 Map 無限成長
  if (ipRequestMap.size > 2000) {
    for (const [k, v] of ipRequestMap.entries()) {
      const fresh = v.filter((ts) => ts > cutoff);
      if (fresh.length === 0) ipRequestMap.delete(k);
      else ipRequestMap.set(k, fresh);
    }
  }

  return { allowed: true, retryAfterSec: 0 };
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rate = checkRateLimit(ip);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `嘗試次數過於頻繁，請於 ${rate.retryAfterSec} 秒後再試。`,
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    const honeypot = typeof body?.honeypot === 'string' ? body.honeypot.trim() : '';
    const elapsedMs = typeof body?.elapsedMs === 'number' ? body.elapsedMs : 1000;
    const action = typeof body?.action === 'string' ? body.action : 'auth';

    // 1. 蜜罐欄位檢查（真人不會填寫隱藏欄位，腳本自動填入將立即攔截）
    if (honeypot.length > 0) {
      return NextResponse.json(
        { success: false, error: '安全性驗證未通過，請重新整理頁面後再試。' },
        { status: 403 }
      );
    }

    // 2. 非人類極速提交檢查（防止瞬間自動化腳本暴力呼叫）
    if (elapsedMs < 500) {
      return NextResponse.json(
        { success: false, error: '操作過快，請稍候 1 秒後再試。' },
        { status: 400 }
      );
    }

    // 3. 若已設定 Cloudflare Turnstile Secret Key，向 Cloudflare 官方驗證無感憑證
    const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
    if (secretKey) {
      if (!token) {
        return NextResponse.json(
          { success: false, error: '安全驗證尚未完成，請稍候 1 秒再點擊送出。' },
          { status: 400 }
        );
      }

      const formData = new URLSearchParams();
      formData.append('secret', secretKey);
      formData.append('response', token);
      if (ip !== 'unknown') {
        formData.append('remoteip', ip);
      }

      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
        cache: 'no-store',
      });

      const verifyData = await verifyRes.json().catch(() => null);
      if (!verifyRes.ok || !verifyData?.success) {
        console.warn('[verify-human] Turnstile rejected:', {
          action,
          codes: verifyData?.['error-codes'],
        });
        return NextResponse.json(
          { success: false, error: '人機安全驗證已過期或未通過，請重試。' },
          { status: 403 }
        );
      }

      return NextResponse.json({ success: true, provider: 'turnstile' });
    }

    // 未配置 Turnstile 金鑰時，由內建頻率限制 + 蜜罐 + 行為時間差防護放行
    return NextResponse.json({ success: true, provider: 'builtin' });
  } catch (err) {
    console.error('[verify-human] unexpected error:', err);
    return NextResponse.json(
      { success: false, error: '安全驗證服務暫時異常，請稍後再試。' },
      { status: 500 }
    );
  }
}
