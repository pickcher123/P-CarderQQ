import { NextResponse } from 'next/server';
import { autoSettlePendingPredictions } from '@/lib/prediction-settlement-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  return handleSettleCron(req);
}

export async function POST(req: Request) {
  return handleSettleCron(req);
}

async function handleSettleCron(req: Request) {
  // 可選安全金鑰驗證
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

  try {
    const summary = await autoSettlePendingPredictions();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
      message: `自動賽果結算排程執行完畢，共掃描 ${summary.scannedCount} 場，結算 ${summary.settledCount} 場，共派發 ${summary.totalPointsPaid} P+ 點數！`,
    });
  } catch (error: any) {
    console.error('Cron Settle Predictions Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '自動結算排程發生未知錯誤' },
      { status: 500 }
    );
  }
}
