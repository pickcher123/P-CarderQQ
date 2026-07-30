export const rarityVisuals: Record<string, { color: string, glow: string, celebration: 'none' | 'rare' | 'legendary', label: string }> = {
  legendary: { color: 'text-accent', glow: 'shadow-[0_0_60px_rgba(234,179,8,0.6)]', celebration: 'legendary', label: 'LEGENDARY' },
  rare: { color: 'text-primary', glow: 'shadow-[0_0_50px_rgba(6,182,212,0.5)]', celebration: 'rare', label: 'RARE' },
  common: { color: 'text-slate-900', glow: 'shadow-black/5', celebration: 'none', label: 'COMMON' },
};

export const pointPrizeRarityStyles: Record<string, { text: string, bg: string, border: string }> = {
  legendary: { text: 'text-accent', bg: 'bg-accent/10 backdrop-blur-xl', border: 'border-accent/30' },
  rare: { text: 'text-primary', bg: 'bg-primary/10 backdrop-blur-xl', border: 'border-primary/30' },
  common: { text: 'text-slate-900', bg: 'bg-slate-200 backdrop-blur-xl', border: 'border-slate-400' },
};

export interface TeamPresetInfo {
  name: string;
  logoUrl: string;
}

export const MLB_TEAMS_DETAILED: TeamPresetInfo[] = [
  { name: "紐約洋基", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png" },
  { name: "洛杉磯道奇", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/lad.png" },
  { name: "波士頓紅襪", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/bos.png" },
  { name: "舊金山巨人", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/sf.png" },
  { name: "芝加哥小熊", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/chc.png" },
  { name: "紐約大都會", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/nym.png" },
  { name: "費城費城人", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/phi.png" },
  { name: "休士頓太空人", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/hou.png" },
  { name: "聖路易紅雀", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/stl.png" },
  { name: "亞特蘭大勇士", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/atl.png" },
  { name: "洛杉磯天使", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/laa.png" },
  { name: "聖地牙哥教士", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/sd.png" },
  { name: "西雅圖水手", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/sea.png" },
  { name: "德州遊騎兵", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/tex.png" },
  { name: "多倫多藍鳥", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/tor.png" },
  { name: "巴爾的摩金鶯", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/bal.png" },
  { name: "坦帕灣光芒", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/tb.png" },
  { name: "明尼蘇達雙城", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/min.png" },
  { name: "克里夫蘭守護者", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/cle.png" },
  { name: "密爾瓦基釀酒人", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/mil.png" },
  { name: "亞利桑那響尾蛇", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/ari.png" },
  { name: "科羅拉多洛磯", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/col.png" },
  { name: "匹茲堡海盜", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/pit.png" },
  { name: "辛辛那提紅人", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/cin.png" },
  { name: "邁阿密馬林魚", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/mia.png" },
  { name: "華盛頓國民", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/wsh.png" },
  { name: "堪薩斯皇家", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/kc.png" },
  { name: "底特律老虎", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/det.png" },
  { name: "奧克蘭運動家", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/oak.png" },
  { name: "芝加哥白襪", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/chw.png" }
];

export const NBA_TEAMS_DETAILED: TeamPresetInfo[] = [
  { name: "波士頓塞爾提克", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/bos.png" },
  { name: "洛杉磯湖人", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/lal.png" },
  { name: "金州勇士", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/gs.png" },
  { name: "密爾瓦基公鹿", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/mil.png" },
  { name: "費城76人", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/phi.png" },
  { name: "鳳凰城太陽", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/phx.png" },
  { name: "邁阿密熱火", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/mia.png" },
  { name: "布魯克林籃網", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/bkn.png" },
  { name: "達拉斯獨行俠", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/dal.png" },
  { name: "丹佛金塊", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/den.png" },
  { name: "芝加哥公牛", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/chi.png" },
  { name: "洛杉磯快艇", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/lac.png" },
  { name: "曼菲斯灰熊", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/mem.png" },
  { name: "多倫多暴龍", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/tor.png" },
  { name: "紐約尼克", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/ny.png" },
  { name: "猶他爵士", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/utah.png" },
  { name: "亞特蘭大老鷹", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/atl.png" },
  { name: "夏洛特黃蜂", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/cha.png" },
  { name: "波特蘭拓荒者", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/por.png" },
  { name: "聖安東尼奧馬刺", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/sa.png" },
  { name: "紐奧良鵜鶘", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/no.png" },
  { name: "沙加緬度國王", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/sac.png" },
  { name: "印第安納溜馬", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/ind.png" },
  { name: "華盛頓巫師", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/was.png" },
  { name: "克里夫蘭騎士", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/cle.png" },
  { name: "奧蘭多魔術", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/orl.png" },
  { name: "休士頓火箭", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/hou.png" },
  { name: "奧克拉荷馬雷霆", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/okc.png" },
  { name: "底特律活塞", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/det.png" },
  { name: "明尼蘇達灰狼", logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/min.png" }
];

export const MLB_TEAMS = MLB_TEAMS_DETAILED.map(t => t.name);
export const NBA_TEAMS = NBA_TEAMS_DETAILED.map(t => t.name);

// 根據球隊名稱自動查詢對應的 Logo URL（兼具向下相容與預設匹配）
const logoMap = new Map<string, string>();
MLB_TEAMS_DETAILED.forEach(t => logoMap.set(t.name, t.logoUrl));
NBA_TEAMS_DETAILED.forEach(t => logoMap.set(t.name, t.logoUrl));

export function getTeamLogoUrl(teamName: string, customLogoUrl?: string): string | null {
  if (customLogoUrl) return customLogoUrl;
  if (!teamName) return null;
  
  // 1. 完全比對
  if (logoMap.has(teamName)) return logoMap.get(teamName)!;
  
  // 2. 模糊比對
  for (const [name, logo] of logoMap.entries()) {
    if (teamName.includes(name) || name.includes(teamName)) {
      return logo;
    }
  }
  
  return null;
}


