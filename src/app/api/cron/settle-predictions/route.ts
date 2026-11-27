import { NextResponse } from 'next/server';
import { autoSettlePendingPredictions } from '@/lib/prediction-settlement-service';
import { verifyCronOrAdminRequest } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  return handleSettleCron(req);
}

export async function POST(req: Request) {
  return handleSettleCron(req);
}

async function handleSettleCron(req: Request) {
  const denied = await verifyCronOrAdminRequest(req);
  if (denied) return denied;

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
