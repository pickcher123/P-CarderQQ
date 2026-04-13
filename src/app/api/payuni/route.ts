// src/app/api/payuni/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/firebase/admin';
import admin from 'firebase-admin';

/**
 * Manually builds a URL-encoded query string from an object,
 * ensuring a fixed, non-alphabetical order of keys.
 */
function createQueryString(data: Record<string, any>): string {
    return Object.keys(data)
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
        .join('&');
}

/**
 * AES-GCM Encryption
 */
function encrypt(plaintext: string, key: string, iv: Buffer): string {
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let cipherText = cipher.update(plaintext, "utf8", "base64");
  cipherText += cipher.final("base64");
  const tag = cipher.getAuthTag().toString("base64");
  return Buffer.from(`${cipherText}:::${tag}`).toString("hex").trim();
}

/**
 * PAYUNi SHA256 Signature
 */
function sha256(encryptStr: string, key: string, iv: string): string {
  const hash = crypto.createHash("sha256").update(`${key}${encryptStr}${iv}`);
  return hash.digest("hex").toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    // 改用原生 process.env 避免因 env.mjs 遺失導致建置失敗
    const hashKey = process.env.PAYUNI_HASH_KEY;
    const hashIV = process.env.PAYUNI_HASH_IV;
    const merchantId = process.env.PAYUNI_MERCHANT_ID;
    const apiUrl = process.env.PAYUNI_API_URL;
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '');

    if (!hashKey || !hashIV || !merchantId || !apiUrl) {
        throw new Error('Missing required PAYUNi environment variables.');
    }

    const { userId, orderDetails } = await req.json();

    if (!userId || !orderDetails || !orderDetails.amt || !orderDetails.prodDesc || !orderDetails.email) {
      return NextResponse.json({ error: 'Missing required order details or userId' }, { status: 400 });
    }
    
    const timestamp = String(Math.floor(Date.now() / 1000));
    const merTradeNo = `pcarder_${timestamp}`;

    // Create a pending transaction record
    if (adminDb) {
        const transactionRef = adminDb.collection('transactions').doc(merTradeNo);
        await transactionRef.set({
          userId: userId,
          transactionType: 'Deposit',
          section: 'deposit',
          amount: orderDetails.amt,
          status: 'pending',
          details: `PAYUNi deposit initiated - ${orderDetails.prodDesc}`,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          transactionDate: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    const tradeInfoPayload: Record<string, any> = {
        MerID: merchantId,
        MerTradeNo: merTradeNo,
        TradeAmt: orderDetails.amt,
        Timestamp: timestamp,
        ReturnURL: process.env.PAYUNI_RETURN_URL || `${appUrl}/payment/result`,
        NotifyURL: process.env.PAYUNI_NOTIFY_URL || `${appUrl}/api/payuni/notify`,
        UsrMail: orderDetails.email,
        ProdDesc: orderDetails.prodDesc,
    };
    
    const plaintext = createQueryString(tradeInfoPayload);
    const ivBuffer = Buffer.from(hashIV, 'utf8');

    const encryptInfo = encrypt(plaintext, hashKey, ivBuffer);
    const hashInfo = sha256(encryptInfo, hashKey, hashIV);
    
    return NextResponse.json({
      ApiUrl: apiUrl,
      MerID: merchantId,
      Version: '2.0',
      EncryptInfo: encryptInfo,
      HashInfo: hashInfo,
    });
    
  } catch (error) {
    console.error('PAYUNi API Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create payment request';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
