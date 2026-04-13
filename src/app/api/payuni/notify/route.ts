// src/app/api/payuni/notify/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'crypto';
import querystring from 'node:querystring';
import { adminDb } from '@/firebase/admin';
import admin from 'firebase-admin';

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

    if (status !== 'SUCCESS') return NextResponse.json({ status: 'success' });

    const hashKey = process.env.PAYUNI_HASH_KEY;
    const hashIV = process.env.PAYUNI_HASH_IV;

    if (!hashKey || !hashIV || !adminDb) {
        return NextResponse.json({ status: 'success' });
    }

    const ivBuffer = Buffer.from(hashIV, 'utf8');
    const decryptedString = decrypt(encryptInfo, hashKey, ivBuffer);
    const result = querystring.parse(decryptedString);

    const { TradeAmt, MerTradeNo, TradeNo, TradeStatus } = result;
    const amount = Number(TradeAmt);
    const ourTradeId = MerTradeNo as string;
    const payuniTradeId = TradeNo as string;
    
    if (result.TradeStatus !== '1') return NextResponse.json({ status: 'success' });

    await adminDb.runTransaction(async (t) => {
        const transactionRef = adminDb.collection('transactions').doc(ourTradeId);
        const transactionDoc = await t.get(transactionRef);

        if (!transactionDoc.exists || transactionDoc.data()?.status === 'completed') return;

        const userId = transactionDoc.data()?.userId;
        const userRef = adminDb.collection('users').doc(userId);
        
        let bonus = 0;
        if (amount >= 30000) bonus = Math.floor(amount * 0.10);
        else if (amount >= 10000) bonus = Math.floor(amount * 0.08);
        else if (amount >= 5000) bonus = Math.floor(amount * 0.06);

        t.update(userRef, { points: admin.firestore.FieldValue.increment(amount + bonus) });
        t.update(transactionRef, {
            status: 'completed',
            payuniTradeNo: payuniTradeId,
            details: `線上儲值 ${amount} 點${bonus > 0 ? ` (含點數包加贈 ${bonus} 點)` : ''}`,
            transactionDate: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error("PAYUNi Notify Error:", error);
    return NextResponse.json({ status: 'success' });
  }
}
