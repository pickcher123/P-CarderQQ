import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ success: false, error: '資料庫尚未就緒' }, { status: 500 });
    }

    const doc = await db.collection('systemConfig').doc('referral').get();
    if (!doc.exists) {
      return NextResponse.json({
        success: true,
        config: {
          isEnabled: true,
          referrerBonusPoints: 100,
          refereeBonusPoints: 50,
          refereeDiamonds: 0,
          freeDrawTickets: 1,
        }
      });
    }

    return NextResponse.json({ success: true, config: doc.data() });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { isEnabled, referrerBonusPoints, refereeBonusPoints, refereeDiamonds, freeDrawTickets } = body;

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ success: false, error: '資料庫尚未就緒' }, { status: 500 });
    }

    const docRef = db.collection('systemConfig').doc('referral');
    await docRef.set({
      isEnabled: isEnabled !== false,
      referrerBonusPoints: Number(referrerBonusPoints) || 0,
      refereeBonusPoints: Number(refereeBonusPoints) || 0,
      refereeDiamonds: Number(refereeDiamonds) || 0,
      freeDrawTickets: Number(freeDrawTickets) || 0,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ success: true, message: '推薦獎勵設定已儲存' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
