/**
 * 隨機生成高質感官方風格卡包包裝（SVG Data URI，免外部圖庫依賴、每次生成皆不相同）
 */

const PACK_PALETTES = [
  { name: '黑曜香檳金', bg1: '#0a0f1c', bg2: '#1a1408', accent: '#FDE68A', accent2: '#F59E0B', sub: '#94A3B8' },
  { name: '皇室曜石藍', bg1: '#070b18', bg2: '#0f1f3d', accent: '#FDE68A', accent2: '#38BDF8', sub: '#CBD5E1' },
  { name: '冠軍赤金紅', bg1: '#14070a', bg2: '#2d0c14', accent: '#FDE68A', accent2: '#FB7185', sub: '#FECDD3' },
  { name: '翡翠黑鈦金', bg1: '#051210', bg2: '#0c2923', accent: '#FDE68A', accent2: '#34D399', sub: '#A7F3D0' },
  { name: '極光紫曜石', bg1: '#0c081a', bg2: '#1f123d', accent: '#FDE68A', accent2: '#C084FC', sub: '#DDD6FE' },
  { name: '鉑金雪銀版', bg1: '#0f172a', bg2: '#1e293b', accent: '#F8FAFC', accent2: '#CBD5E1', sub: '#94A3B8' },
];

export function generateRandomPackSvgDataUrl(poolTitle?: string): {
  dataUrl: string;
  styleName: string;
} {
  const palette = PACK_PALETTES[Math.floor(Math.random() * PACK_PALETTES.length)];
  const patternType = Math.floor(Math.random() * 4); // 0: 菱格, 1: 電路斜線, 2: 同心光環, 3: 幾何稜鏡
  const editionNo = Math.floor(1000 + Math.random() * 9000);
  const angle = Math.floor(15 + Math.random() * 60);
  const safeTitle = (poolTitle || 'P+CARDER').replace(/[<>&"']/g, '').slice(0, 14) || 'P+CARDER';

  let patternSvg = '';
  if (patternType === 0) {
    patternSvg = `
      <pattern id="p" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})">
        <path d="M18 0 L36 18 L18 36 L0 18 Z" fill="none" stroke="${palette.accent}" stroke-opacity="0.16" stroke-width="1"/>
      </pattern>
      <rect width="400" height="600" fill="url(#p)"/>
    `;
  } else if (patternType === 1) {
    patternSvg = `
      <pattern id="p" width="44" height="44" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})">
        <line x1="0" y1="22" x2="44" y2="22" stroke="${palette.accent2}" stroke-opacity="0.18" stroke-width="1.2"/>
        <circle cx="22" cy="22" r="2.2" fill="${palette.accent}" fill-opacity="0.35"/>
      </pattern>
      <rect width="400" height="600" fill="url(#p)"/>
    `;
  } else if (patternType === 2) {
    patternSvg = `
      <circle cx="200" cy="270" r="145" fill="none" stroke="${palette.accent}" stroke-opacity="0.18" stroke-width="1.5"/>
      <circle cx="200" cy="270" r="110" fill="none" stroke="${palette.accent2}" stroke-opacity="0.22" stroke-width="1" stroke-dasharray="6 6"/>
      <circle cx="200" cy="270" r="76" fill="none" stroke="${palette.accent}" stroke-opacity="0.28" stroke-width="1.5"/>
    `;
  } else {
    patternSvg = `
      <polygon points="200,85 335,270 200,455 65,270" fill="none" stroke="${palette.accent}" stroke-opacity="0.22" stroke-width="1.5"/>
      <polygon points="200,130 295,270 200,410 105,270" fill="none" stroke="${palette.accent2}" stroke-opacity="0.22" stroke-width="1"/>
    `;
  }

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="400" height="600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.bg1}"/>
      <stop offset="55%" stop-color="${palette.bg2}"/>
      <stop offset="100%" stop-color="${palette.bg1}"/>
    </linearGradient>
    <linearGradient id="foil" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${palette.accent}" stop-opacity="0"/>
      <stop offset="50%" stop-color="${palette.accent}" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="${palette.accent}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="44%" r="48%">
      <stop offset="0%" stop-color="${palette.accent2}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${palette.bg1}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="400" height="600" fill="url(#bg)"/>
  <rect width="400" height="600" fill="url(#glow)"/>
  ${patternSvg}

  <!-- 鋁箔封口壓紋 -->
  <rect x="0" y="0" width="400" height="28" fill="#000000" fill-opacity="0.45"/>
  <rect x="0" y="572" width="400" height="28" fill="#000000" fill-opacity="0.45"/>
  <rect x="20" y="34" width="360" height="532" rx="18" fill="none" stroke="${palette.accent}" stroke-opacity="0.35" stroke-width="1.5"/>

  <!-- 頂部光條 -->
  <rect x="40" y="34" width="320" height="2.5" fill="url(#foil)"/>

  <!-- 頂部官方徽章 -->
  <rect x="122" y="58" width="156" height="26" rx="13" fill="#000000" fill-opacity="0.55" stroke="${palette.accent}" stroke-opacity="0.45" stroke-width="1"/>
  <text x="200" y="75" text-anchor="middle" fill="${palette.accent}" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="800" letter-spacing="2.5">P+CARDER OFFICIAL</text>

  <!-- 中央主視覺徽記 -->
  <polygon points="200,175 275,270 200,365 125,270" fill="#000000" fill-opacity="0.55" stroke="${palette.accent}" stroke-width="2.2"/>
  <text x="200" y="264" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="900" letter-spacing="2">P+</text>
  <text x="200" y="294" text-anchor="middle" fill="${palette.accent}" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="800" letter-spacing="3">EDITION</text>

  <!-- 底部卡池標題與序號 -->
  <text x="200" y="468" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="900" letter-spacing="1">${safeTitle}</text>
  <text x="200" y="496" text-anchor="middle" fill="${palette.sub}" font-family="monospace" font-size="11" font-weight="700" letter-spacing="2">${palette.name} · NO.${editionNo}</text>
</svg>`.trim();

  const encoded = encodeURIComponent(svg);
  return {
    dataUrl: `data:image/svg+xml;utf8,${encoded}`,
    styleName: `${palette.name} #${editionNo}`,
  };
}
