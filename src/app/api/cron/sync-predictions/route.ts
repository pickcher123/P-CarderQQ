import { NextResponse } from 'next/server';
import { syncPredictionsToFirestore } from '@/lib/auto-sync-service';
import { verifyCronOrAdminRequest } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const denied = await verifyCronOrAdminRequest(req);
    if (denied) return denied;

    const result = await syncPredictionsToFirestore();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
      message: '賽事預測定時抓取同步成功！',
    });
  } catch (error: any) {
    console.error('[Cron Sync Predictions Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || '賽事同步失敗' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
