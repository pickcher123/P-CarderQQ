// src/app/api/payuni/notify/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'crypto';
import querystring from 'node:querystring';
import { adminDb } from '@/firebase/admin';
import admin from 'firebase-admin';
import { getBonusMultiplier, isBonusEventActive } from '@/lib/bonus-event';

function decrypt(encryptStr: string, key: string, iv: Buffer): string {
  try {
    const hexDecoded = Buffer.from(encryptStr, 'hex').toString('utf8');
    const parts = hexDecoded.split(':::');
    if (parts.length !== 2) throw new Error("Invalid encrypted format.");
    const [encryptData, tag] = parts;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    let decipherText = decipher.update(encryptData, "base64", "utf8");
    decipherText += decipher.final("utf8");
    return decipherText;
  } catch (error) {
    console.error("AES-GCM decryption failed:", error);
    throw new Error("Failed to decrypt notification data.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const status = formData.get('Status');
    const encryptInfo = formData.get('EncryptInfo') as string;
    const hashInfo = String(formData.get('HashInfo') || '').trim().toUpperCase();

    if (status !== 'SUCCESS' || !encryptInfo) return NextResponse.json({ status: 'success' });

    const hashKey = process.env.PAYUNI_HASH_KEY;
    const hashIV = process.env.PAYUNI_HASH_IV;

    if (!hashKey || !hashIV || !adminDb) {
        return NextResponse.json({ status: 'success' });
    }

    // 驗證 PAYUNi SHA256 HashInfo 簽章（防偽造通知）
    const expectedHash = crypto
      .createHash('sha256')
      .update(`${hashKey}${encryptInfo}${hashIV}`)
      .digest('hex')
      .toUpperCase();

    if (
      !hashInfo ||
      hashInfo.length !== expectedHash.length ||
      !crypto.timingSafeEqual(Buffer.from(hashInfo, 'utf8'), Buffer.from(expectedHash, 'utf8'))
    ) {
      console.error('PAYUNi Notify: Invalid HashInfo signature');
      return NextResponse.json({ status: 'error', message: 'Invalid signature' }, { status: 403 });
    }

    const ivBuffer = Buffer.from(hashIV, 'utf8');
    const decryptedString = decrypt(encryptInfo, hashKey, ivBuffer);
    const result = querystring.parse(decryptedString);

    const { TradeAmt, MerTradeNo, TradeNo } = result;
    const amount = Number(TradeAmt);
    const ourTradeId = MerTradeNo as string;
    const payuniTradeId = TradeNo as string;
    
    if (result.TradeStatus !== '1' || !Number.isFinite(amount) || amount <= 0 || !ourTradeId) {
      return NextResponse.json({ status: 'success' });
    }

    await adminDb.runTransaction(async (t: any) => {
        const transactionRef = adminDb.collection('transactions').doc(ourTradeId);
        const transactionDoc = await t.get(transactionRef);

        if (!transactionDoc.exists || transactionDoc.data()?.status === 'completed') return;

        // 嚴格核對通知金額與原訂單金額一致
        const expectedAmount = Number(transactionDoc.data()?.amount || 0);
        if (expectedAmount > 0 && expectedAmount !== amount) {
          console.error(`PAYUNi Notify: Amount mismatch for ${ourTradeId}: expected ${expectedAmount}, got ${amount}`);
          return;
        }

        const userId = transactionDoc.data()?.userId;
        if (!userId) return;
        const userRef = adminDb.collection('users').doc(userId);
        
        let multiplier = 1;
        try {
          const sysDoc = await t.get(adminDb.collection('systemConfig').doc('main'));
          const bonusEvent = sysDoc.data()?.bonusEvent;
          multiplier = getBonusMultiplier(bonusEvent, 'purchase');
        } catch (e) {
          multiplier = 1; // 讀取失敗時保守降級為 1X，避免誤發加倍點數
        }

        let bonus = 0;
        if (amount >= 30000) bonus = Math.floor(amount * 0.10);
        else if (amount >= 10000) bonus = Math.floor(amount * 0.08);
        else if (amount >= 5000) bonus = Math.floor(amount * 0.06);

        if (bonus > 0 && multiplier > 1) {
          bonus = Math.floor(bonus * multiplier);
        }

        t.update(userRef, { points: admin.firestore.FieldValue.increment(amount + bonus) });
        t.update(transactionRef, {
            status: 'completed',
            payuniTradeNo: payuniTradeId,
            details: `線上儲值 ${amount} 點${bonus > 0 ? ` (含點數包${multiplier > 1 ? ` ${multiplier}X加倍` : ''}加贈 ${bonus} 點)` : ''}`,
            transactionDate: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error("PAYUNi Notify Error:", error);
    return NextResponse.json({ status: 'success' });
  }
}
