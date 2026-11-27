import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveSmtpConfig, verifySmtpConnection } from '@/lib/nodemailer-server';
import { verifyAdminRequest } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.ok) return auth.response;

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
