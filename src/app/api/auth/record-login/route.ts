import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';
import firebaseConfigData from '../../../../firebase-applet-config.json';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function parseUserAgent(ua: string) {
  let browser = '未知瀏覽器';
  let os = '未知作業系統';
  let device: 'desktop' | 'mobile' | 'tablet' = 'desktop';

  // 裝置判斷
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    device = 'tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(ua)) {
    device = 'mobile';
  } else {
    device = 'desktop';
  }

  // 作業系統判斷
  if (/windows phone/i.test(ua)) {
    os = 'Windows Phone';
  } else if (/win(dows|98|me|nt|xp|vista|7|8|10|11)/i.test(ua)) {
    if (/windows nt 10.0/i.test(ua)) os = 'Windows 10/11';
    else if (/windows nt 6.3/i.test(ua)) os = 'Windows 8.1';
    else if (/windows nt 6.2/i.test(ua)) os = 'Windows 8';
    else if (/windows nt 6.1/i.test(ua)) os = 'Windows 7';
    else os = 'Windows';
  } else if (/android/i.test(ua)) {
    const match = ua.match(/android\s([0-9.]+)/i);
    os = match ? `Android ${match[1]}` : 'Android';
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    const match = ua.match(/os\s([0-9_]+)/i);
    os = match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS';
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = 'macOS';
  } else if (/linux/i.test(ua)) {
    os = 'Linux';
  }

  // 瀏覽器判斷
  if (/line/i.test(ua)) {
    browser = 'LINE 內建瀏覽器';
  } else if (/fbav|fban/i.test(ua)) {
    browser = 'Facebook 內建瀏覽器';
  } else if (/micromessenger/i.test(ua)) {
    browser = 'WeChat 內建瀏覽器';
  } else if (/edg/i.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/chrome|crios/i.test(ua)) {
    browser = 'Google Chrome';
  } else if (/safari/i.test(ua)) {
    browser = 'Apple Safari';
  } else if (/firefox|fxios/i.test(ua)) {
    browser = 'Mozilla Firefox';
  } else if (/opera|opr/i.test(ua)) {
    browser = 'Opera';
  }

  return { browser, os, device };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, email, username, photoURL, loginMethod = 'email' } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // 解析真實 IP
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const cfConnectingIp = req.headers.get('cf-connecting-ip');
    let clientIp = cfConnectingIp || realIp || (forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1');
    if (clientIp.startsWith('::ffff:')) {
      clientIp = clientIp.replace('::ffff:', '');
    }

    const ua = req.headers.get('user-agent') || '';
    const { browser, os, device } = parseUserAgent(ua);

    const now = new Date();
    const loginTimeIso = now.toISOString();

    let methodName = '帳號密碼登入';
    if (loginMethod === 'google') methodName = 'Google 快捷登入';
    else if (loginMethod === 'register') methodName = '新會員註冊登入';

    const logData = {
      userId,
      email: email || '',
      username: username || (email ? email.split('@')[0] : '玩卡人會員'),
      photoURL: photoURL || null,
      loginMethod,
      loginMethodName: methodName,
      ip: clientIp,
      userAgent: ua,
      browser,
      os,
      device,
      status: 'success',
      createdAt: FieldValue.serverTimestamp(),
      loginTime: loginTimeIso,
    };

    // 寫入 Firestore userLoginLogs 與更新 users 資料
    if (adminDb && typeof adminDb.collection === 'function') {
      try {
        const logRef = await adminDb.collection('userLoginLogs').add(logData);
        // 同步更新使用者的最近登入時間與 IP
        await adminDb.collection('users').doc(userId).set({
          lastLoginAt: FieldValue.serverTimestamp(),
          lastLoginTime: loginTimeIso,
          lastLoginIp: clientIp,
          lastLoginMethod: loginMethod,
          lastDevice: device,
          lastBrowser: browser,
        }, { merge: true });

        return NextResponse.json({ success: true, logId: logRef.id });
      } catch (adminErr) {
        console.warn('AdminDb write login log failed, returning success anyway:', adminErr);
      }
    }

    // 若伺服器端 Admin 憑證未配置，回傳必要資料由客戶端直寫
    return NextResponse.json({
      success: true,
      logData: {
        ...logData,
        createdAt: loginTimeIso,
      }
    });

  } catch (error: any) {
    console.error('Record login failed:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
