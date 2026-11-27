import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyUserRequest } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

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
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    if (!orderId) {
      return NextResponse.json({ success: false, error: '缺少出貨單編號。' }, { status: 400 });
    }

    await db.runTransaction(async (tx) => {
      const orderRef = db.collection('shippingOrders').doc(orderId);
      const orderSnap = await tx.get(orderRef);

      if (!orderSnap.exists) {
        throw new Error('找不到該筆出貨單。');
      }

      const order = orderSnap.data() || {};
      if (order.userId !== uid) {
        throw new Error('無權限取消此筆出貨單。');
      }
      if (order.status !== 'pending') {
        throw new Error('此出貨單已進入處理流程或已取消，無法再次取消。');
      }

      tx.update(orderRef, {
        status: 'cancelled',
        cancelledAt: FieldValue.serverTimestamp(),
      });

      const fee = Number(order.fee || 0);
      if (fee > 0) {
        tx.update(db.collection('users').doc(uid), {
          points: FieldValue.increment(fee),
        });
        tx.set(db.collection('transactions').doc(), {
          userId: uid,
          transactionType: 'Refund',
          section: 'shipping',
          currency: 'diamond',
          amount: fee,
          details: `取消運單 ${orderId} 退款`,
          transactionDate: FieldValue.serverTimestamp(),
        });
      }

      const cardList = Array.isArray(order.cardIds) ? order.cardIds : [];
      for (const cardInfo of cardList) {
        if (!cardInfo) continue;
        tx.set(db.collection('users').doc(uid).collection('userCards').doc(), {
          cardId: cardInfo.cardId || null,
          userId: uid,
          isFoil: Boolean(cardInfo.isFoil),
          rarity: cardInfo.rarity || 'unknown',
          category: cardInfo.category || 'all',
          restoredFromOrderId: orderId,
          acquiredAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API /api/shipping/cancel] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || '取消訂單失敗，請稍後再試。' },
      { status: 400 }
    );
  }
}
