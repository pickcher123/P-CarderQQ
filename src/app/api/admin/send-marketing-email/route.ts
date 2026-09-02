import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/firebase/admin';
import { getEffectiveSmtpConfig, createTransporter } from '@/lib/nodemailer-server';
import { generateMarketingEmailHtml, EmailTemplateOptions } from '@/lib/email-templates';

interface SendMarketingEmailRequest {
  targetType: 'all' | 'specific_users' | 'user_levels' | 'user_tags' | 'custom_emails';
  targetUserIds?: string[];
  targetLevels?: string[];
  targetTags?: string[];
  customEmails?: string[];
  subject: string;
  preheader?: string;
  senderName?: string;
  templateType?: string;
  heading?: string;
  contentHtml?: string;
  buttonText?: string;
  buttonUrl?: string;
  promoCode?: string;
  bannerImageUrl?: string;
  customFooterNote?: string;
  isTestEmail?: boolean;
  testEmailAddress?: string;
  smtpConfig?: any;
  sentBy?: string;
}

interface Recipient {
  email: string;
  username?: string;
  points?: number;
  userLevel?: string;
  userId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SendMarketingEmailRequest;
    const {
      targetType,
      targetUserIds = [],
      targetLevels = [],
      targetTags = [],
      customEmails = [],
      subject,
      preheader,
      senderName,
      templateType = 'custom',
      heading,
      contentHtml,
      buttonText,
      buttonUrl,
      promoCode,
      bannerImageUrl,
      customFooterNote,
      isTestEmail = false,
      testEmailAddress,
      smtpConfig,
      sentBy = 'admin',
    } = body;

    if (!subject || !subject.trim()) {
      return NextResponse.json({ success: false, error: '請輸入郵件主旨' }, { status: 400 });
    }

    // 1. Prepare SMTP Transporter
    const effectiveConfig = await getEffectiveSmtpConfig(smtpConfig);
    let transporter: any;
    try {
      transporter = createTransporter(effectiveConfig);
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: err.message || 'SMTP 連線設定無效，請至寄件伺服器設定進行配置' },
        { status: 400 }
      );
    }

    const hostOrigin = req.nextUrl.origin || 'https://card-platform.app';
    const db = getAdminDb();

    // 2. Resolve Recipients
    const recipients: Recipient[] = [];

    if (isTestEmail) {
      if (!testEmailAddress || !testEmailAddress.includes('@')) {
        return NextResponse.json({ success: false, error: '請提供有效的測試收件 Email 信箱' }, { status: 400 });
      }
      recipients.push({
        email: testEmailAddress.trim(),
        username: '測試預覽會員',
        points: 8888,
        userLevel: '鑽石 VIP (測試)',
      });
    } else {
      if (targetType === 'custom_emails') {
        customEmails.forEach((e) => {
          const trimmed = e.trim();
          if (trimmed && trimmed.includes('@')) {
            recipients.push({
              email: trimmed,
              username: trimmed.split('@')[0],
              points: 0,
              userLevel: '會員',
            });
          }
        });
      } else if (db) {
        const usersRef = db.collection('users');
        let snapshot;

        if (targetType === 'all') {
          snapshot = await usersRef.limit(1000).get();
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.email && typeof data.email === 'string' && data.email.includes('@')) {
              recipients.push({
                email: data.email.trim(),
                username: data.username || data.realName || '親愛的會員',
                points: data.points || 0,
                userLevel: data.userLevel || '一般會員',
                userId: docSnap.id,
              });
            }
          });
        } else if (targetType === 'specific_users' && targetUserIds.length > 0) {
          // Batch fetch user documents
          for (let i = 0; i < targetUserIds.length; i += 30) {
            const chunk = targetUserIds.slice(i, i + 30);
            const snaps = await usersRef.where('__name__', 'in', chunk).get();
            snaps.forEach((docSnap) => {
              const data = docSnap.data();
              if (data.email && typeof data.email === 'string' && data.email.includes('@')) {
                recipients.push({
                  email: data.email.trim(),
                  username: data.username || data.realName || '親愛的會員',
                  points: data.points || 0,
                  userLevel: data.userLevel || '一般會員',
                  userId: docSnap.id,
                });
              }
            });
          }
        } else if (targetType === 'user_levels' && targetLevels.length > 0) {
          snapshot = await usersRef.where('userLevel', 'in', targetLevels).limit(1000).get();
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.email && typeof data.email === 'string' && data.email.includes('@')) {
              recipients.push({
                email: data.email.trim(),
                username: data.username || data.realName || '親愛的會員',
                points: data.points || 0,
                userLevel: data.userLevel || '一般會員',
                userId: docSnap.id,
              });
            }
          });
        } else if (targetType === 'user_tags' && targetTags.length > 0) {
          snapshot = await usersRef.where('tags', 'array-contains-any', targetTags).limit(1000).get();
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.email && typeof data.email === 'string' && data.email.includes('@')) {
              recipients.push({
                email: data.email.trim(),
                username: data.username || data.realName || '親愛的會員',
                points: data.points || 0,
                userLevel: data.userLevel || '一般會員',
                userId: docSnap.id,
              });
            }
          });
        }
      }
    }

    // Deduplicate recipients by email
    const uniqueRecipientsMap = new Map<string, Recipient>();
    recipients.forEach((r) => {
      const lower = r.email.toLowerCase();
      if (!uniqueRecipientsMap.has(lower)) {
        uniqueRecipientsMap.set(lower, r);
      }
    });
    const uniqueRecipients = Array.from(uniqueRecipientsMap.values());

    if (uniqueRecipients.length === 0) {
      return NextResponse.json(
        { success: false, error: '找不到符合條件且擁有有效 Email 的收件會員。' },
        { status: 400 }
      );
    }

    // 3. Send emails with throttled concurrency (chunk size: 5)
    let sentCount = 0;
    let failedCount = 0;
    const errors: { email: string; error: string }[] = [];

    const CHUNK_SIZE = 5;
    for (let i = 0; i < uniqueRecipients.length; i += CHUNK_SIZE) {
      const chunk = uniqueRecipients.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (recipient) => {
          try {
            const templateOpts: EmailTemplateOptions = {
              subject,
              preheader,
              senderName: senderName || effectiveConfig.fromName || 'P+ 卡牌交易中心',
              templateType,
              heading: heading || subject,
              contentHtml,
              buttonText,
              buttonUrl,
              promoCode,
              bannerImageUrl,
              customFooterNote,
              userData: {
                username: recipient.username,
                email: recipient.email,
                points: recipient.points,
                userLevel: recipient.userLevel,
              },
              siteUrl: hostOrigin,
            };

            const html = generateMarketingEmailHtml(templateOpts);

            await transporter.sendMail({
              from: `"${templateOpts.senderName}" <${effectiveConfig.fromEmail || effectiveConfig.user}>`,
              to: recipient.email,
              subject: templateOpts.subject,
              html: html,
            });

            sentCount++;
          } catch (err: any) {
            failedCount++;
            errors.push({
              email: recipient.email,
              error: err?.message || '發送失敗',
            });
          }
        })
      );

      // Short delay between chunks to avoid rate limiting
      if (i + CHUNK_SIZE < uniqueRecipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    // 4. Record into Firestore marketingEmailLogs
    let logId: string | null = null;
    if (db && !isTestEmail) {
      try {
        const logRef = await db.collection('marketingEmailLogs').add({
          subject,
          preheader: preheader || '',
          senderName: senderName || effectiveConfig.fromName || 'P+ 卡牌交易中心',
          templateType,
          heading: heading || subject,
          contentHtml: contentHtml || '',
          buttonText: buttonText || '',
          buttonUrl: buttonUrl || '',
          promoCode: promoCode || '',
          bannerImageUrl: bannerImageUrl || '',
          targetType,
          targetSummary:
            targetType === 'all'
              ? '全體註冊會員'
              : targetType === 'specific_users'
              ? `指定會員 (${targetUserIds.length} 人)`
              : targetType === 'user_levels'
              ? `會員等級 (${targetLevels.join(', ')})`
              : targetType === 'user_tags'
              ? `會員標籤 (${targetTags.join(', ')})`
              : `自訂 Email (${customEmails.length} 組)`,
          totalRecipients: uniqueRecipients.length,
          sentCount,
          failedCount,
          errors: errors.slice(0, 50), // Store up to 50 error details
          sentBy,
          createdAt: new Date(),
          status: failedCount === 0 ? 'success' : sentCount > 0 ? 'partial' : 'failed',
        });
        logId = logRef.id;
      } catch (logErr) {
        console.warn('Failed to write marketing email log:', logErr);
      }
    }

    return NextResponse.json({
      success: true,
      totalRecipients: uniqueRecipients.length,
      sentCount,
      failedCount,
      errors: errors.slice(0, 10),
      logId,
      isTest: isTestEmail,
    });
  } catch (error: any) {
    console.error('Error sending marketing email:', error);
    return NextResponse.json(
      { success: false, error: error?.message || '發送行銷郵件過程發生錯誤' },
      { status: 500 }
    );
  }
}
