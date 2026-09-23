/**
 * 體育隊伍官方 LOGO 與圖示智慧解析服務
 * 整合 NBA、MLB、CPBL (中華職棒)、歐洲足球五大聯賽及台灣職籃官方高解析度公開 CDN
 */

export interface TeamMeta {
  name: string;
  aliases: string[];
  logo: string;
  primaryColor?: string;
}

// 1. NBA 30 支球隊官方 ESPN 500px 透明 PNG CDN
export const NBA_TEAMS: TeamMeta[] = [
  { name: '金州勇士', aliases: ['勇士', '金州', 'warriors', 'gsw', 'golden state'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/gsw.png', primaryColor: '#1D428A' },
  { name: '洛杉磯湖人', aliases: ['湖人', 'lakers', 'lal', 'los angeles lakers'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png', primaryColor: '#552583' },
  { name: '波士頓塞爾提克', aliases: ['塞爾提克', '塞爾特人', '綠衫軍', 'celtics', 'bos', 'boston'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png', primaryColor: '#007A33' },
  { name: '丹佛金塊', aliases: ['金塊', '掘金', 'nuggets', 'den', 'denver'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/den.png', primaryColor: '#0E2240' },
  { name: '密爾瓦基公鹿', aliases: ['公鹿', '雄鹿', 'bucks', 'mil', 'milwaukee'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png', primaryColor: '#00471B' },
  { name: '鳳凰城太陽', aliases: ['太陽', 'suns', 'phx', 'phoenix'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png', primaryColor: '#1D1160' },
  { name: '達拉斯獨行俠', aliases: ['獨行俠', '小牛', 'mavericks', 'mavs', 'dal', 'dallas'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png', primaryColor: '#00538C' },
  { name: '邁阿密熱火', aliases: ['熱火', 'heat', 'mia', 'miami'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png', primaryColor: '#98002E' },
  { name: '紐約尼克', aliases: ['尼克', '尼克斯', 'knicks', 'nyk', 'new york'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/nyk.png', primaryColor: '#006BB6' },
  { name: '費城76人', aliases: ['76人', '七六人', 'sixers', '76ers', 'phi', 'philadelphia'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png', primaryColor: '#006BB6' },
  { name: '洛杉磯快艇', aliases: ['快艇', '快船', 'clippers', 'lac', 'los angeles clippers'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png', primaryColor: '#C8102E' },
  { name: '明尼蘇達灰狼', aliases: ['灰狼', '森林狼', 'timberwolves', 'wolves', 'min', 'minnesota'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/min.png', primaryColor: '#0C2340' },
  { name: '奧克拉荷馬雷霆', aliases: ['雷霆', 'thunder', 'okc', 'oklahoma'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png', primaryColor: '#007AC1' },
  { name: '克里夫蘭騎士', aliases: ['騎士', 'cavaliers', 'cavs', 'cle', 'cleveland'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png', primaryColor: '#860038' },
  { name: '印第安那溜馬', aliases: ['溜馬', '步行者', 'pacers', 'ind', 'indiana'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png', primaryColor: '#002D62' },
  { name: '奧蘭多魔術', aliases: ['魔術', 'magic', 'orl', 'orlando'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png', primaryColor: '#0077C0' },
  { name: '沙加緬度國王', aliases: ['國王', 'kings', 'sac', 'sacramento'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png', primaryColor: '#5A2D81' },
  { name: '紐奧良鵜鶘', aliases: ['鵜鶘', 'pelicans', 'nop', 'no', 'new orleans'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/no.png', primaryColor: '#0C2340' },
  { name: '休士頓火箭', aliases: ['火箭', 'rockets', 'hou', 'houston'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png', primaryColor: '#CE1141' },
  { name: '曼菲斯灰熊', aliases: ['灰熊', 'grizzlies', 'mem', 'memphis'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png', primaryColor: '#5D76A9' },
  { name: '芝加哥公牛', aliases: ['公牛', 'bulls', 'chi', 'chicago'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png', primaryColor: '#CE1141' },
  { name: '亞特蘭大老鷹', aliases: ['老鷹', 'hawks', 'atl', 'atlanta'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png', primaryColor: '#E03A3E' },
  { name: '布魯克林籃網', aliases: ['籃網', 'nets', 'bkn', 'brooklyn'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png', primaryColor: '#000000' },
  { name: '多倫多暴龍', aliases: ['暴龍', '猛龍', 'raptors', 'tor', 'toronto'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png', primaryColor: '#CE1141' },
  { name: '猶他爵士', aliases: ['爵士', 'jazz', 'uta', 'utah'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/uta.png', primaryColor: '#002B5C' },
  { name: '聖安東尼奧馬刺', aliases: ['馬刺', 'spurs', 'sas', 'sa', 'san antonio'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png', primaryColor: '#C4CED4' },
  { name: '夏洛特黃蜂', aliases: ['黃蜂', 'hornets', 'cha', 'charlotte'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png', primaryColor: '#1D1160' },
  { name: '波特蘭拓荒者', aliases: ['拓荒者', '開拓者', 'blazers', 'trail blazers', 'por', 'portland'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/por.png', primaryColor: '#E03A3E' },
  { name: '底特律活塞', aliases: ['活塞', 'pistons', 'det', 'detroit'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/det.png', primaryColor: '#1D42BA' },
  { name: '華盛頓巫師', aliases: ['巫師', '奇才', 'wizards', 'wsh', 'was', 'washington'], logo: 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png', primaryColor: '#002B5C' },
];

// 2. MLB 30 支球隊官方 ESPN 500px 透明 PNG CDN
export const MLB_TEAMS: TeamMeta[] = [
  { name: '洛杉磯道奇', aliases: ['道奇', 'dodgers', 'lad', 'la dodgers'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/lad.png', primaryColor: '#005A9C' },
  { name: '紐約洋基', aliases: ['洋基', 'yankees', 'nyy', 'new york yankees'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png', primaryColor: '#0C2340' },
  { name: '聖地牙哥教士', aliases: ['教士', 'padres', 'sd', 'san diego padres'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/sd.png', primaryColor: '#2F241D' },
  { name: '波士頓紅襪', aliases: ['紅襪', 'red sox', 'bos', 'boston red sox'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/bos.png', primaryColor: '#BD3039' },
  { name: '休士頓太空人', aliases: ['太空人', 'astros', 'hou', 'houston astros'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/hou.png', primaryColor: '#EB6E1F' },
  { name: '亞特蘭大勇士', aliases: ['勇士棒球', 'braves', 'atl', 'atlanta braves'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/atl.png', primaryColor: '#CE1141' },
  { name: '費城費城人', aliases: ['費城人', 'phillies', 'phi', 'philadelphia phillies'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/phi.png', primaryColor: '#E81828' },
  { name: '巴爾的摩金鶯', aliases: ['金鶯', 'orioles', 'bal', 'baltimore orioles'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/bal.png', primaryColor: '#DF4601' },
  { name: '坦帕灣光芒', aliases: ['光芒', 'rays', 'tb', 'tampa bay rays'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/tb.png', primaryColor: '#092C5C' },
  { name: '多倫多藍鳥', aliases: ['藍鳥', 'blue jays', 'tor', 'toronto blue jays'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/tor.png', primaryColor: '#134A8E' },
  { name: '芝加哥小熊', aliases: ['小熊', 'cubs', 'chc', 'chicago cubs'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/chc.png', primaryColor: '#0E3386' },
  { name: '舊金山巨人', aliases: ['巨人棒球', 'giants', 'sf', 'san francisco giants'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/sf.png', primaryColor: '#FD5A1E' },
  { name: '紐約大都會', aliases: ['大都會', 'mets', 'nym', 'new york mets'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/nym.png', primaryColor: '#002D72' },
  { name: '西雅圖水手', aliases: ['水手', 'mariners', 'sea', 'seattle mariners'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/sea.png', primaryColor: '#0C2C56' },
  { name: '德州遊騎兵', aliases: ['遊騎兵', 'rangers', 'tex', 'texas rangers'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/tex.png', primaryColor: '#003278' },
  { name: '洛杉磯天使', aliases: ['天使', 'angels', 'laa', 'los angeles angels'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/laa.png', primaryColor: '#BA0021' },
  { name: '克里夫蘭守護者', aliases: ['守護者', '印地安人', 'guardians', 'cle', 'cleveland guardians'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/cle.png', primaryColor: '#E31937' },
  { name: '明尼蘇達雙城', aliases: ['雙城', 'twins', 'min', 'minnesota twins'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/min.png', primaryColor: '#002B5C' },
  { name: '密爾瓦基釀酒人', aliases: ['釀酒人', 'brewers', 'mil', 'milwaukee brewers'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/mil.png', primaryColor: '#12284C' },
  { name: '聖路易紅雀', aliases: ['紅雀', 'cardinals', 'stl', 'st. louis cardinals'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/stl.png', primaryColor: '#C41E3A' },
  { name: '亞利桑那響尾蛇', aliases: ['響尾蛇', 'diamondbacks', 'dbacks', 'ari', 'arizona'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/ari.png', primaryColor: '#A71930' },
  { name: '底特律老虎', aliases: ['老虎棒球', 'tigers', 'det', 'detroit tigers'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/det.png', primaryColor: '#0C2340' },
  { name: '堪薩斯皇家', aliases: ['皇家', 'royals', 'kc', 'kansas city royals'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/kc.png', primaryColor: '#004687' },
  { name: '辛辛那提紅人', aliases: ['紅人', 'reds', 'cin', 'cincinnati reds'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/cin.png', primaryColor: '#C6011F' },
  { name: '匹茲堡海盜', aliases: ['海盜', 'pirates', 'pit', 'pittsburgh pirates'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/pit.png', primaryColor: '#FDB827' },
  { name: '邁阿密馬林魚', aliases: ['馬林魚', 'marlins', 'mia', 'miami marlins'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/mia.png', primaryColor: '#00A3E0' },
  { name: '華盛頓國民', aliases: ['國民', 'nationals', 'wsh', 'washington nationals'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/wsh.png', primaryColor: '#AB0003' },
  { name: '運動家', aliases: ['奧克蘭運動家', 'athletics', 'oak', 'oakland'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/oak.png', primaryColor: '#003831' },
  { name: '科羅拉多洛磯', aliases: ['洛磯', '落磯', 'rockies', 'col', 'colorado rockies'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/col.png', primaryColor: '#33006F' },
  { name: '芝加哥白襪', aliases: ['白襪', 'white sox', 'chw', 'cws', 'chicago white sox'], logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/chw.png', primaryColor: '#27251F' },
];

// 3. CPBL 中華職棒 6 隊本地極速高清晰徽章
export const CPBL_TEAMS: TeamMeta[] = [
  { name: '中信兄弟', aliases: ['兄弟', '中信', 'brothers', 'ctbc brothers', '象隊', '黃衫軍'], logo: '/team-logos/cpbl-brothers.svg', primaryColor: '#FFCC00' },
  { name: '富邦悍將', aliases: ['富邦', '悍將', 'guardians', 'fubon guardians'], logo: '/team-logos/cpbl-guardians.svg', primaryColor: '#00529B' },
  { name: '統一7-ELEVEn獅', aliases: ['統一獅', '統一', '獅隊', 'lions', 'uni-lions', 'uni lions'], logo: '/team-logos/cpbl-lions.svg', primaryColor: '#FF6B00' },
  { name: '樂天桃猿', aliases: ['樂天', '桃猿', 'monkeys', 'rakuten monkeys', 'rakuten'], logo: '/team-logos/cpbl-monkeys.svg', primaryColor: '#8B0000' },
  { name: '味全龍', aliases: ['味全', '龍隊', 'dragons', 'wei chuan dragons'], logo: '/team-logos/cpbl-dragons.svg', primaryColor: '#E50914' },
  { name: '台鋼雄鷹', aliases: ['台鋼', '雄鷹', 'hawks', 'tsg hawks', 'tsg'], logo: '/team-logos/cpbl-hawks.svg', primaryColor: '#0F5132' },
];

// 4. 歐洲頂級足球俱樂部 (英超、西甲、德甲、法甲、義甲) ESPN CDN
export const SOCCER_TEAMS: TeamMeta[] = [
  { name: '曼城', aliases: ['曼徹斯特城', 'man city', 'manchester city', 'mci'], logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/382.png', primaryColor: '#6CABDD' },
  { name: '利物浦', aliases: ['紅軍', 'liverpool', 'liv'], logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png', primaryColor: '#C8102E' },
  { name: '阿森納', aliases: ['兵工廠', '槍手', 'arsenal', 'ars'], logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png', primaryColor: '#EF0107' },
  { name: '曼聯', aliases: ['曼徹斯特聯', '紅魔', 'man utd', 'manchester united', 'mun'], logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/360.png', primaryColor: '#DA291C' },
  { name: '切爾西', aliases: ['車路士', '藍軍', 'chelsea', 'che'], logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/363.png', primaryColor: '#034694' },
  { name: '熱刺', aliases: ['托特納姆熱刺', 'tottenham', 'tottenham hotspur', 'tot'], logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/367.png', primaryColor: '#132257' },
  { name: '皇家馬德里', aliases: ['皇馬', 'real madrid', 'rma'], logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/86.png', primaryColor: '#FFFFFF' },
  { name: '巴塞隆納', aliases: ['巴薩', 'barcelona', 'fc barcelona', 'bar'], logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/83.png', primaryColor: '#004D98' },
  { name: '拜仁慕尼黑', aliases: ['拜仁', 'bayern munich', 'bayern', 'bay'], logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/132.png', primaryColor: '#DC052D' },
  { name: '巴黎聖日耳曼', aliases: ['大巴黎', 'psg', 'paris saint-germain'], logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/160.png', primaryColor: '#004170' },
  { name: '國際米蘭', aliases: ['國米', 'inter milan', 'inter'], logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/110.png', primaryColor: '#010E80' },
  { name: 'AC米蘭', aliases: ['ac milan', 'milan', '紅黑軍團'], logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/103.png', primaryColor: '#FB090B' },
];

// 全球資料庫整合
export const ALL_KNOWN_TEAMS: TeamMeta[] = [
  ...CPBL_TEAMS,
  ...NBA_TEAMS,
  ...MLB_TEAMS,
  ...SOCCER_TEAMS,
];

/**
 * 智慧解析球隊名稱並取得精準官方 LOGO 網址
 */
export function resolveTeamLogo(
  teamNameOrKeyword?: string,
  sportCategory?: string,
  providedLogo?: string
): string {
  if (providedLogo && providedLogo.trim() !== '' && !providedLogo.includes('default') && !providedLogo.includes('null')) {
    return providedLogo.trim();
  }

  if (!teamNameOrKeyword || typeof teamNameOrKeyword !== 'string') {
    return '/team-logos/sports-default.svg';
  }

  const raw = teamNameOrKeyword.trim().toLowerCase();

  // 1. 優先在特定運動分類中尋找
  let targetPool = ALL_KNOWN_TEAMS;
  if (sportCategory === 'baseball') {
    targetPool = [...CPBL_TEAMS, ...MLB_TEAMS, ...ALL_KNOWN_TEAMS];
  } else if (sportCategory === 'basketball') {
    targetPool = [...NBA_TEAMS, ...ALL_KNOWN_TEAMS];
  } else if (sportCategory === 'football' || sportCategory === 'soccer') {
    targetPool = [...SOCCER_TEAMS, ...ALL_KNOWN_TEAMS];
  }

  // 2. 完全比對隊名
  for (const team of targetPool) {
    if (team.name.toLowerCase() === raw) {
      return team.logo;
    }
  }

  // 3. 比對隊伍別名
  for (const team of targetPool) {
    for (const alias of team.aliases) {
      if (alias.toLowerCase() === raw) {
        return team.logo;
      }
    }
  }

  // 4. 關鍵字模糊包含比對 (例如 "金州勇士 (-3.5)" 包含 "勇士" 或 "金州勇士")
  // 優先比對字數較長的名稱以防子字串衝突
  const sortedTeams = [...targetPool].sort((a, b) => b.name.length - a.name.length);
  for (const team of sortedTeams) {
    if (raw.includes(team.name.toLowerCase())) {
      return team.logo;
    }
    for (const alias of team.aliases) {
      if (alias.length >= 2 && raw.includes(alias.toLowerCase())) {
        return team.logo;
      }
    }
  }

  return '/team-logos/sports-default.svg';
}

/**
 * 從對戰賽事名稱 (例如 "金州勇士 vs 洛杉磯湖人" 或 "洛杉磯湖人 @ 金州勇士") 拆解主客隊
 */
export function parseTeamsFromMatchName(matchName: string): { homeTeam: string; awayTeam: string } {
  if (!matchName || typeof matchName !== 'string') {
    return { homeTeam: '主隊', awayTeam: '客隊' };
  }

  const cleaned = matchName
    .replace(/【.*?】/g, '')
    .replace(/\[.*?\]/g, '')
    .trim();

  // 支援格式： "客隊 @ 主隊" (美式)
  if (cleaned.includes('@')) {
    const parts = cleaned.split('@').map(s => s.trim());
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return { awayTeam: parts[0], homeTeam: parts[1] };
    }
  }

  // 支援格式： "A vs B", "A vs. B", "A 對 B", "A VS B"
  const vsMatch = cleaned.split(/\s*(?:vs\.?|VS|對決|對)\s*/i);
  if (vsMatch.length >= 2 && vsMatch[0] && vsMatch[1]) {
    // 亞洲慣例多為 主隊 vs 客隊，或是 客隊 vs 主隊
    return { homeTeam: vsMatch[0].trim(), awayTeam: vsMatch[1].trim() };
  }

  return { homeTeam: cleaned, awayTeam: '' };
}

/**
 * 自動為賽事補充完整的隊伍名稱與 LOGO
 */
export function resolveMatchTeamsAndLogos(match: {
  matchName?: string;
  sportCategory?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
}): {
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string;
  awayTeamLogo: string;
} {
  let homeTeam = (match.homeTeam || '').trim();
  let awayTeam = (match.awayTeam || '').trim();

  if (!homeTeam || !awayTeam) {
    const parsed = parseTeamsFromMatchName(match.matchName || '');
    if (!homeTeam) homeTeam = parsed.homeTeam;
    if (!awayTeam) awayTeam = parsed.awayTeam;
  }

  const homeTeamLogo = resolveTeamLogo(homeTeam, match.sportCategory, match.homeTeamLogo);
  const awayTeamLogo = resolveTeamLogo(awayTeam, match.sportCategory, match.awayTeamLogo);

  return {
    homeTeam: homeTeam || '主隊',
    awayTeam: awayTeam || '客隊',
    homeTeamLogo,
    awayTeamLogo,
  };
}

/**
 * 針對下注選項文字，精準尋找該選項對應的球隊 LOGO（若為非球隊選項如「和局」、「大小分」則回傳 null）
 */
export function findTeamLogoForOption(optionText: string, sportCategory?: string): string | null {
  if (!optionText || typeof optionText !== 'string') return null;
  const logo = resolveTeamLogo(optionText, sportCategory);
  if (logo === '/team-logos/sports-default.svg') {
    return null;
  }
  return logo;
}

