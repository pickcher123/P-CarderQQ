export interface EmailTemplateOptions {
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
  userData?: {
    username?: string;
    email?: string;
    points?: number;
    userLevel?: string;
  };
  siteUrl?: string;
}

export function replacePlaceholders(text: string, data: {
  username?: string;
  email?: string;
  points?: number;
  userLevel?: string;
  siteUrl?: string;
}): string {
  if (!text) return '';
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
  
  return text
    .replace(/\{\{username\}\}/g, data.username || '親愛的會員')
    .replace(/\{\{email\}\}/g, data.email || '')
    .replace(/\{\{points\}\}/g, (data.points ?? 0).toLocaleString())
    .replace(/\{\{level\}\}/g, data.userLevel || '一般會員')
    .replace(/\{\{userLevel\}\}/g, data.userLevel || '一般會員')
    .replace(/\{\{date\}\}/g, dateStr)
    .replace(/\{\{siteUrl\}\}/g, data.siteUrl || 'https://card-platform.app');
}

export function generateMarketingEmailHtml(options: EmailTemplateOptions): string {
  const siteUrl = options.siteUrl || 'https://card-platform.app';
  const userData = options.userData || { username: '親愛的會員', points: 0, userLevel: 'VIP' };
  
  const heading = replacePlaceholders(options.heading || options.subject, userData);
  const contentHtml = replacePlaceholders(options.contentHtml || '', userData);
  const buttonText = replacePlaceholders(options.buttonText || '', userData);
  const promoCode = replacePlaceholders(options.promoCode || '', userData);
  const preheader = replacePlaceholders(options.preheader || options.subject, userData);
  const customFooterNote = replacePlaceholders(options.customFooterNote || '', userData);

  return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0f19;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #f1f5f9;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #0b0f19;
      padding: 30px 10px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #111827;
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid #1f293d;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
    }
    .header {
      background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 50%, #1e293b 100%);
      padding: 36px 28px 24px;
      text-align: center;
      border-bottom: 2px solid #312e81;
    }
    .logo-badge {
      display: inline-block;
      padding: 6px 14px;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid #6366f1;
      border-radius: 9999px;
      color: #818cf8;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .main-title {
      font-size: 24px;
      font-weight: 900;
      color: #ffffff;
      margin: 0 0 10px 0;
      line-height: 1.35;
      letter-spacing: -0.5px;
    }
    .user-greeting {
      display: inline-flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.06);
      padding: 4px 12px;
      border-radius: 8px;
      font-size: 13px;
      color: #cbd5e1;
    }
    .user-greeting strong {
      color: #38bdf8;
      margin-left: 4px;
    }
    .banner-wrapper {
      width: 100%;
      text-align: center;
      background: #000000;
    }
    .banner-img {
      width: 100%;
      max-height: 280px;
      object-fit: cover;
      display: block;
    }
    .body-content {
      padding: 32px 28px;
      font-size: 15px;
      line-height: 1.7;
      color: #cbd5e1;
    }
    .content-box {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 14px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .promo-card {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.05) 100%);
      border: 1px dashed #f59e0b;
      border-radius: 14px;
      padding: 18px;
      text-align: center;
      margin: 24px 0;
    }
    .promo-label {
      font-size: 11px;
      font-weight: 700;
      color: #fbbf24;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 6px;
    }
    .promo-code-text {
      font-family: 'Courier New', Courier, monospace;
      font-size: 22px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: 3px;
      background: #0f172a;
      padding: 8px 16px;
      border-radius: 8px;
      display: inline-block;
      border: 1px solid #d97706;
    }
    .cta-container {
      text-align: center;
      margin: 32px 0 16px 0;
    }
    .cta-button {
      display: inline-block;
      padding: 16px 36px;
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-size: 16px;
      font-weight: 800;
      border-radius: 12px;
      letter-spacing: 0.5px;
      box-shadow: 0 10px 25px rgba(2, 132, 199, 0.4);
      transition: all 0.2s ease;
    }
    .footer {
      background: #090d16;
      padding: 24px 28px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #1e293b;
    }
    .footer a {
      color: #38bdf8;
      text-decoration: none;
    }
    .footer-note {
      margin-bottom: 12px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preheader || heading}
  </div>

  <div class="wrapper">
    <div class="container">
      
      <!-- Header -->
      <div class="header">
        <div class="logo-badge">P+ 卡牌官方行銷快訊</div>
        <h1 class="main-title">${heading}</h1>
        <div class="user-greeting">
          會員專屬通知：<strong>${userData.username || '親愛的藏家'}</strong>
          ${userData.userLevel ? `<span style="margin-left:8px;color:#f59e0b;font-weight:bold;">[${userData.userLevel}]</span>` : ''}
        </div>
      </div>

      <!-- Banner Image if provided -->
      ${options.bannerImageUrl ? `
        <div class="banner-wrapper">
          <img src="${options.bannerImageUrl}" alt="${heading}" class="banner-img" />
        </div>
      ` : ''}

      <!-- Main Body -->
      <div class="body-content">
        <div class="content-box">
          ${contentHtml || '<p>歡迎關注 P+ 卡牌交易所最新動態！精彩活動與限定好禮現正開放中。</p>'}
        </div>

        <!-- Promo Code Box if provided -->
        ${promoCode ? `
          <div class="promo-card">
            <div class="promo-label">🎁 專屬兌換 / 優惠序號</div>
            <div class="promo-code-text">${promoCode}</div>
            <p style="font-size:12px;color:#94a3b8;margin:8px 0 0 0;">請登入平台於「個人中心 ➜ 序號兌換」進行領取</p>
          </div>
        ` : ''}

        <!-- CTA Button if provided -->
        ${options.buttonUrl && buttonText ? `
          <div class="cta-container">
            <a href="${options.buttonUrl}" target="_blank" class="cta-button">
              ${buttonText} ➔
            </a>
          </div>
        ` : ''}
      </div>

      <!-- Footer -->
      <div class="footer">
        ${customFooterNote ? `<div class="footer-note">${customFooterNote}</div>` : ''}
        <p style="margin: 0 0 6px 0;">此郵件為 P+ 官方卡牌交易系統自動發送之會員活動通訊。</p>
        <p style="margin: 0;">
          <a href="${siteUrl}" target="_blank">造訪官方平台</a> &nbsp;|&nbsp; 
          <a href="${siteUrl}/profile" target="_blank">會員中心</a>
        </p>
        <p style="margin: 12px 0 0 0; font-size: 10px; color: #475569;">
          © ${new Date().getFullYear()} P+ Card Platform. All rights reserved.
        </p>
      </div>

    </div>
  </div>
</body>
</html>
  `;
}
