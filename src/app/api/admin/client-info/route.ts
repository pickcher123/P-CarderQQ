import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfIp = req.headers.get('cf-connecting-ip');

  let ip = '未知 IP';
  if (cfIp) {
    ip = cfIp.trim();
  } else if (forwardedFor) {
    ip = forwardedFor.split(',')[0].trim();
  } else if (realIp) {
    ip = realIp.trim();
  }

  const userAgent = req.headers.get('user-agent') || '';

  return NextResponse.json({
    ip,
    userAgent,
    timestamp: new Date().toISOString(),
  });
}
