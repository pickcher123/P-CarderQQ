import { NextResponse } from 'next/server';
import { syncPredictionsToFirestore, syncExhibitionsToFirestore } from '@/lib/auto-sync-service';
import { autoSettlePendingPredictions } from '@/lib/prediction-settlement-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 允許最長 60 秒供 AI 搜尋與寫入

let lastRunTime = 0;
const COOLDOWN_MS = 15 * 1000; // 15 秒基本防刷冷卻

async function handleSync(req: Request) {
  const now = Date.now();
  if (now - lastRunTime < COOLDOWN_MS) {
    return NextResponse.json({
      success: true,
      message: '排程正在冷卻中（15秒內避免重複執行），已跳過本次請求。',
      timestamp: new Date().toISOString(),
    });
  }

  // 可選安全金鑰驗證 (若環境變數配置了 CRON_SECRET)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && cronSecret.trim() !== '') {
    const url = new URL(req.url);
    const keyParam = url.searchParams.get('key') || url.searchParams.get('secret');
    const authHeader = req.headers.get('authorization');
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (keyParam !== cronSecret && bearer !== cronSecret) {
      return NextResponse.json(
        { success: false, error: '未授權的排程呼叫：CRON_SECRET 驗證不符' },
        { status: 401 }
      );
    }
  }

  lastRunTime = now;

  try {
    // 平行同步體育賽事預測、卡展，以及執行賽事賽果自動結算派獎
    const [predictionResult, exhibitionResult, settlementResult] = await Promise.allSettled([
      syncPredictionsToFirestore(),
      syncExhibitionsToFirestore(),
      autoSettlePendingPredictions(),
    ]);

    const predictions = predictionResult.status === 'fulfilled'
      ? predictionResult.value
      : { error: (predictionResult.reason as any)?.message || '同步失敗' };

    const exhibitions = exhibitionResult.status === 'fulfilled'
      ? exhibitionResult.value
      : { error: (exhibitionResult.reason as any)?.message || '同步失敗' };

    const settlements = settlementResult.status === 'fulfilled'
      ? settlementResult.value
      : { error: (settlementResult.reason as any)?.message || '結算失敗' };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        predictions,
        exhibitions,
        settlements,
      },
      message: '自動排程同步與賽果派獎作業已順利執行完成！',
    });
  } catch (error: any) {
    console.error('[Cron Sync All Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '自動同步發生未知異常',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return handleSync(req);
}

export async function POST(req: Request) {
  return handleSync(req);
}
