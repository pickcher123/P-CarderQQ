import { NextResponse } from 'next/server';
import { syncExhibitionsToFirestore } from '@/lib/auto-sync-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && cronSecret.trim() !== '') {
      const url = new URL(req.url);
      const keyParam = url.searchParams.get('key') || url.searchParams.get('secret');
      if (keyParam !== cronSecret) {
        return NextResponse.json({ success: false, error: '未授權' }, { status: 401 });
      }
    }

    const result = await syncExhibitionsToFirestore();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
      message: '卡展行事曆定時抓取同步成功！',
    });
  } catch (error: any) {
    console.error('[Cron Sync Exhibitions Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || '卡展同步失敗' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
