import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveSmtpConfig, verifySmtpConnection } from '@/lib/nodemailer-server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const config = await getEffectiveSmtpConfig(body.smtpConfig);
    const result = await verifySmtpConnection(config);

    if (result.success) {
      return NextResponse.json({ success: true, message: result.message });
    } else {
      return NextResponse.json({ success: false, error: result.message }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || '驗證 SMTP 失敗' },
      { status: 500 }
    );
  }
}
