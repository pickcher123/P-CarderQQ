import { NextRequest, NextResponse } from 'next/server';

function extractClientIp(req: NextRequest): string {
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  return '127.0.0.1';
}

function parseUserAgentInfo(ua: string): {
  device: 'mobile' | 'tablet' | 'desktop';
  os: string;
  browser: string;
} {
  const lower = ua.toLowerCase();

  let device: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  if (/ipad|tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) {
    device = 'tablet';
  } else if (/iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|iemobile/i.test(lower)) {
    device = 'mobile';
  }

  let os = '未知系統';
  if (ua.includes('Windows NT 10.0') || ua.includes('Windows NT 11.0') || ua.includes('Windows')) {
    os = 'Windows';
  } else if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) {
    os = 'iOS';
  } else if (ua.includes('Android')) {
    os = 'Android';
  } else if (ua.includes('Mac OS X') || ua.includes('Macintosh')) {
    os = 'macOS';
  } else if (ua.includes('CrOS')) {
    os = 'ChromeOS';
  } else if (ua.includes('Linux')) {
    os = 'Linux';
  }

  let browser = '標準瀏覽器';
  if (ua.includes('Line/')) {
    browser = 'LINE 內建瀏覽器';
  } else if (ua.includes('FBAN') || ua.includes('FBAV')) {
    browser = 'Facebook 瀏覽器';
  } else if (ua.includes('Instagram')) {
    browser = 'Instagram 瀏覽器';
  } else if (ua.includes('Edg/')) {
    browser = 'Microsoft Edge';
  } else if (ua.includes('OPR/') || ua.includes('Opera')) {
    browser = 'Opera';
  } else if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
    browser = 'Google Chrome';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    browser = 'Apple Safari';
  } else if (ua.includes('Firefox/')) {
    browser = 'Mozilla Firefox';
  }

  return { device, os, browser };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ua = req.headers.get('user-agent') || '';
    const ip = extractClientIp(req);
    const { device, os, browser } = parseUserAgentInfo(ua);

    return NextResponse.json({
      ok: true,
      logData: {
        userId: body?.userId || '',
        email: body?.email || '',
        loginMethod: body?.loginMethod || 'email',
        ip,
        device,
        os,
        browser,
        userAgent: ua.slice(0, 300),
      },
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        logData: {
          ip: '127.0.0.1',
          device: 'desktop',
          os: '未知系統',
          browser: '標準瀏覽器',
          userAgent: '',
        },
      },
      { status: 200 }
    );
  }
}
