import { NextResponse } from 'next/server';
import {
  fetchMatchResultWithAi,
  settlePredictionEvent,
  autoSettlePendingPredictions,
} from '@/lib/prediction-settlement-service';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, eventId, winningOptions, actualScore, explanation } = body;

    // 1. AI 聯網查詢特定賽事之完賽比分與勝出選項
    if (action === 'fetch_result') {
      if (!eventId) {
        return NextResponse.json({ success: false, error: '缺少 eventId 參數' }, { status: 400 });
      }

      const db = getAdminDb();
      if (!db) {
        return NextResponse.json({ success: false, error: '資料庫尚未就緒' }, { status: 500 });
      }

      const doc = await db.collection('predictionEvents').doc(eventId).get();
      if (!doc.exists) {
        return NextResponse.json({ success: false, error: '找不到該預測賽事' }, { status: 404 });
      }

      const eventData = doc.data()!;
      const aiResult = await fetchMatchResultWithAi({
        id: eventId,
        matchName: eventData.matchName || '',
        question: eventData.question || '',
        options: eventData.options || [],
        sportCategory: eventData.sportCategory,
        league: eventData.league,
        bettingEndTime: eventData.bettingEndTime || '',
      });

      // 取得目前預測人數預覽
      const predsSnap = await db.collection('userPredictions').where('eventId', '==', eventId).get();
      const totalPreds = predsSnap.size;
      const optionCounts: Record<string, number> = {};
      predsSnap.forEach((p) => {
        const opt = p.data().option;
        optionCounts[opt] = (optionCounts[opt] || 0) + 1;
      });

      return NextResponse.json({
        success: true,
        aiResult,
        preview: {
          totalPredictions: totalPreds,
          optionCounts,
          reward: eventData.reward || 100,
        },
      });
    }

    // 2. 管理員手動確認並派發指定賽事獎勵
    if (action === 'settle_single') {
      if (!eventId) {
        return NextResponse.json({ success: false, error: '缺少 eventId 參數' }, { status: 400 });
      }

      const settleRes = await settlePredictionEvent(eventId, {
        winningOptions,
        actualScore,
        explanation,
        settledBy: 'admin-manual',
      });

      return NextResponse.json({
        success: true,
        settleResult: settleRes,
        message: `結算完成！共有 ${settleRes.winnersCount} 位玩家命中勝出，共派發 +${settleRes.totalPayout} P+ 點數！`,
      });
    }

    // 3. 一鍵自動掃描全部到期賽事並自動派獎
    if (action === 'settle_all_pending') {
      const autoRes = await autoSettlePendingPredictions();
      return NextResponse.json({
        success: true,
        summary: autoRes,
        message: `自動結算掃描完成！共掃描 ${autoRes.scannedCount} 場截止賽事，成功結算 ${autoRes.settledCount} 場，共派發 ${autoRes.totalPointsPaid} P+ 點數！`,
      });
    }

    return NextResponse.json({ success: false, error: '未知的操作指令 (action)' }, { status: 400 });
  } catch (error: any) {
    console.error('Prediction Settle API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '執行結算派獎時發生未知錯誤' },
      { status: 500 }
    );
  }
}
