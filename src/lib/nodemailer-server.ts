import nodemailer from 'nodemailer';
import { getAdminDb, hasAdminCredentials } from '@/firebase/admin';

export interface SmtpConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  fromName?: string;
  fromEmail?: string;
}

export async function getEffectiveSmtpConfig(overrideConfig?: SmtpConfig): Promise<SmtpConfig> {
  // 1. If override config with host & user is provided, use it
  if (overrideConfig?.host && overrideConfig?.user) {
    return {
      host: overrideConfig.host,
      port: overrideConfig.port ? Number(overrideConfig.port) : 587,
      secure: overrideConfig.secure ?? (Number(overrideConfig.port) === 465),
      user: overrideConfig.user,
      pass: overrideConfig.pass,
      fromName: overrideConfig.fromName || 'P+Carder 玩卡人',
      fromEmail: overrideConfig.fromEmail || overrideConfig.user,
    };
  }

  // 2. Try to load from Firestore systemSettings/email if admin credentials are ready
  if (hasAdminCredentials()) {
    try {
      const db = getAdminDb();
      if (db) {
        const docSnap = await db.collection('systemSettings').doc('email').get();
        if (docSnap.exists) {
          const data = docSnap.data() as SmtpConfig;
          if (data?.host && data?.user) {
            return {
              host: data.host,
              port: data.port ? Number(data.port) : 587,
              secure: data.secure ?? (Number(data.port) === 465),
              user: data.user,
              pass: data.pass,
              fromName: data.fromName || 'P+Carder 玩卡人',
              fromEmail: data.fromEmail || data.user,
            };
          }
        }
      }
    } catch (err: any) {
      if (!err?.message?.includes('PERMISSION_DENIED') && !err?.message?.includes('permission')) {
        console.warn('Failed to load SMTP settings from Firestore:', err);
      }
    }
  }

  // 3. Fallback to process.env
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER || process.env.GMAIL_USER || '';
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '';
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const fromName = process.env.SMTP_FROM_NAME || 'P+Carder 玩卡人';
  const fromEmail = process.env.SMTP_FROM_EMAIL || user;

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromName,
    fromEmail,
  };
}

export function createTransporter(config: SmtpConfig) {
  if (!config.host || !config.user || !config.pass) {
    throw new Error('尚未設定 SMTP 伺服器資訊（需填寫主機 Host、帳號與密碼），請先至「寄件伺服器設定」頁籤填寫並儲存。');
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port || 587,
    secure: config.secure || false,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

export async function verifySmtpConnection(config: SmtpConfig): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = createTransporter(config);
    await transporter.verify();
    return { success: true, message: 'SMTP 郵件伺服器連線驗證成功！可正常發信。' };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || '無法連線至 SMTP 伺服器，請檢查 Host、Port、帳號或密碼是否正確。若使用 Gmail 請確保使用「應用程式密碼」。',
    };
  }
}
