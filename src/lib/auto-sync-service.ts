import { GoogleGenAI, Type } from '@google/genai';
import { getAdminDb } from './firebase-admin';
import * as admin from 'firebase-admin';
import { resolveMatchTeamsAndLogos, resolveTeamLogo } from './sports-team-logos';

// 體育賽事介面
export interface ScrapedMatch {
  matchName: string;
  sportCategory: 'basketball' | 'baseball' | 'football' | 'esports' | 'other';
  league?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  question: string;
  options: string[];
  reward: number;
  bettingEndTime: string;
  analysis?: string;
}

// 卡展介面
export interface ScrapedExhibition {
  title: string;
  startDate: string;
  endDate: string;
  time: string;
  location: string;
  description: string;
  imageUrl?: string;
}

/**
 * 取得運動賽事與盤口資料（透過 Gemini 聯網搜尋 或 備援資料庫）
 */
export async function scrapeSportsMatches(): Promise<ScrapedMatch[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  // 計算明天與後天的時間
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const tDate = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
  const dDate = `${dayAfter.getFullYear()}-${pad(dayAfter.getMonth() + 1)}-${pad(dayAfter.getDate())}`;

  // 當無 API Key 或聯網失敗時的精選備援名單
  const fallbackMatches: ScrapedMatch[] = [
    {
      matchName: '金州勇士 vs 洛杉磯湖人',
      sportCategory: 'basketball',
      league: 'NBA 美國職籃',
      homeTeam: '金州勇士',
      awayTeam: '洛杉磯湖人',
      homeTeamLogo: 'https://a.espncdn.com/i/teamlogos/nba/500/gsw.png',
      awayTeamLogo: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
      question: '【NBA焦點戰】金州勇士 vs 洛杉磯湖人：讓分盤誰能過盤？',
      options: ['金州勇士 (-3.5)', '洛杉磯湖人 (+3.5)'],
      reward: 100,
      bettingEndTime: `${tDate}T09:55`,
      analysis: '勇士近期外線命中率突破四成，湖人禁區內線得分佔優，盤口開出勇士主讓 3.5 分。',
    },
    {
      matchName: '洛杉磯道奇 vs 聖地牙哥教士',
      sportCategory: 'baseball',
      league: 'MLB 美國職棒',
      homeTeam: '洛杉磯道奇',
      awayTeam: '聖地牙哥教士',
      homeTeamLogo: 'https://a.espncdn.com/i/teamlogos/mlb/500/lad.png',
      awayTeamLogo: 'https://a.espncdn.com/i/teamlogos/mlb/500/sd.png',
      question: '【MLB國聯焦點】洛杉磯道奇 vs 聖地牙哥教士：比賽結果預測？',
      options: ['洛杉磯道奇 (-1.5)', '聖地牙哥教士 (+1.5)', '總分大於 8.5 分', '總分小於 8.5 分'],
      reward: 120,
      bettingEndTime: `${tDate}T07:05`,
      analysis: '道奇由王牌強投主投，中心打線火力充沛，教士作客挑戰讓分盤。',
    },
    {
      matchName: '中信兄弟 vs 富邦悍將',
      sportCategory: 'baseball',
      league: 'CPBL 中華職棒',
      homeTeam: '中信兄弟',
      awayTeam: '富邦悍將',
      homeTeamLogo: '/team-logos/cpbl-brothers.svg',
      awayTeamLogo: '/team-logos/cpbl-guardians.svg',
      question: '【中華職棒例行賽】中信兄弟 vs 富邦悍將：誰能獲勝？',
      options: ['中信兄弟 (-1.5)', '富邦悍將 (+1.5)'],
      reward: 100,
      bettingEndTime: `${tDate}T18:30`,
      analysis: '中信兄弟主場打線串聯穩定，富邦由強力先發洋投登板壓陣。',
    },
    {
      matchName: '曼城 vs 利物浦',
      sportCategory: 'football',
      league: '英超足球 Premier League',
      homeTeam: '曼城',
      awayTeam: '利物浦',
      homeTeamLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/382.png',
      awayTeamLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png',
      question: '【英超榜首天王山】曼城 vs 利物浦：最終賽果？',
      options: ['曼城獨贏', '雙方握手言和 (和局)', '利物浦獨贏'],
      reward: 150,
      bettingEndTime: `${dDate}T02:55`,
      analysis: '英超爭冠焦點大戰，兩隊近期皆維持優異連勝狀態。',
    },
  ];

  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_') || apiKey === 'YOUR_API_KEY') {
    return fallbackMatches;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const today = now.toISOString().split('T')[0];

    const prompt = `你是一個專業的體育賽事與賠率盤口情報分析專家。
今天是 ${today}。
請利用 Google 搜尋「今天、明天或未來 3 天內」即將開打的全球或台灣焦點熱門賽事，重點關注：
1. NBA 美國職籃最新賽程與讓分盤口
2. MLB 美國職棒 或 CPBL 中華職棒最新賽程與讓分盤口
3. 足球 (英超 Premier League / 歐冠 / 西甲) 焦點對決
4. 台灣職籃 (TPBL / P. LEAGUE+) 焦點對決

請精選 3 到 6 場「尚未開打、最受矚目」的焦點對決，為每一場比賽指出主隊 (homeTeam) 與客隊 (awayTeam)，並設計一個有趣的預測競猜問題與 2~4 個預測選項（如：讓分過盤、大小分、獨贏）。
若能透過搜尋找到隊伍的官方 LOGO 圖片網址 (如 ESPN / 官網 / Wikipedia 圖片 URL)，請一併填入 homeTeamLogo 與 awayTeamLogo，若無則留空。
所有比賽的 bettingEndTime 必須在開賽前 5~10 分鐘，且必須晚於 ${today}。

請務必嚴格依循 JSON Schema 格式輸出：
- matchName: 格式如 "金州勇士 vs 洛杉磯湖人"
- homeTeam: 主隊名稱 (例如: "金州勇士")
- awayTeam: 客隊名稱 (例如: "洛杉磯湖人")
- homeTeamLogo: 主隊 LOGO 圖片網址 (可選)
- awayTeamLogo: 客隊 LOGO 圖片網址 (可選)
- sportCategory: "basketball" | "baseball" | "football" | "esports" | "other"
- league: 聯賽名稱 (例如: "NBA 美國職籃", "CPBL 中華職棒")
- question: 預測題目 (例如: "【NBA焦點戰】金州勇士 vs 洛杉磯湖人：讓分盤誰能過盤？")
- options: 預測選項陣列 (例如: ["金州勇士 (-3.5)", "洛杉磯湖人 (+3.5)"])
- reward: 預測成功獎勵 (數字, 建議 100 ~ 200)
- bettingEndTime: 格式必須為 "YYYY-MM-DDTHH:mm" (例如: "${tDate}T09:55")
- analysis: 簡短賽前分析與盤口亮點 (50-100字)
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  matchName: { type: Type.STRING },
                  homeTeam: { type: Type.STRING },
                  awayTeam: { type: Type.STRING },
                  homeTeamLogo: { type: Type.STRING },
                  awayTeamLogo: { type: Type.STRING },
                  sportCategory: { type: Type.STRING },
                  league: { type: Type.STRING },
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  reward: { type: Type.NUMBER },
                  bettingEndTime: { type: Type.STRING },
                  analysis: { type: Type.STRING },
                },
                required: ['matchName', 'question', 'options', 'bettingEndTime'],
              },
            },
          },
          required: ['matches'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.matches && Array.isArray(parsed.matches) && parsed.matches.length > 0) {
      return parsed.matches.map((m: any) => {
        const cat = ['basketball', 'baseball', 'football', 'esports', 'other'].includes(m.sportCategory)
          ? m.sportCategory
          : 'other';
        
        // 智慧解析與補充球隊名稱及高畫質官方 LOGO
        const resolvedTeams = resolveMatchTeamsAndLogos({
          matchName: m.matchName,
          sportCategory: cat,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          homeTeamLogo: m.homeTeamLogo,
          awayTeamLogo: m.awayTeamLogo,
        });

        return {
          matchName: m.matchName || `${resolvedTeams.homeTeam} vs ${resolvedTeams.awayTeam}`,
          homeTeam: resolvedTeams.homeTeam,
          awayTeam: resolvedTeams.awayTeam,
          homeTeamLogo: resolvedTeams.homeTeamLogo,
          awayTeamLogo: resolvedTeams.awayTeamLogo,
          sportCategory: cat,
          league: m.league || '焦點賽事',
          question: m.question || `${m.matchName}：誰能獲勝？`,
          options: Array.isArray(m.options) && m.options.length >= 2 ? m.options : ['主隊勝', '客隊勝'],
          reward: Number(m.reward) || 100,
          bettingEndTime: m.bettingEndTime || `${tDate}T12:00`,
          analysis: m.analysis || '',
        };
      });
    }
  } catch (error) {
    console.error('[ScrapeSportsMatches] AI 搜尋失敗，切換為備援賽事:', error);
  }

  return fallbackMatches;
}

/**
 * 取得最新卡展情報（透過 Gemini 聯網搜尋 或 備援資料庫）
 */
export async function scrapeCardExhibitions(): Promise<ScrapedExhibition[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  const currentYear = new Date().getFullYear();
  const nextMonth = new Date().getMonth() + 2;
  const m1 = nextMonth > 12 ? 1 : nextMonth;
  const m2 = (m1 % 12) + 1;
  const m3 = (m2 % 12) + 1;
  const pad = (n: number) => n.toString().padStart(2, '0');

  const fallbackExhibitions: ScrapedExhibition[] = [
    {
      title: `${currentYear} 台灣大台北球員卡交易博覽會 (Taipei Card Show)`,
      startDate: `${currentYear}-${pad(m1)}-15`,
      endDate: `${currentYear}-${pad(m1)}-16`,
      time: '10:00 - 18:00',
      location: '台北市南港展覽館 2 館 (台北市南港區經貿二路 2 號)',
      description: '全台規模最盛大之球卡博覽會！集結超過 100+ 知名卡店與個人賣家，現場特設 PSA / BGS 快速送評鑑定專區、球星簽名見面會、大額罕見卡交易鑑價及百人盲盒開拆秀。',
      imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: `${currentYear} 松菸收藏卡交流市集與鑑定收件會`,
      startDate: `${currentYear}-${pad(m2)}-08`,
      endDate: `${currentYear}-${pad(m2)}-09`,
      time: '11:00 - 19:00',
      location: '台北市松山文創園區 4 號倉庫 (台北市信義區光復南路 133 號)',
      description: '結合 NBA、MLB、中華職棒 CPBL 與寶可夢 TCG 稀有卡展售！現場提供卡友免費交換桌、限定卡磚周邊與封膜開箱直播，是卡迷不可錯過的聚會。',
      imageUrl: 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: `${currentYear} 台中中台灣卡牌收藏博覽會 (Taichung Card Expo)`,
      startDate: `${currentYear}-${pad(m2)}-22`,
      endDate: `${currentYear}-${pad(m2)}-23`,
      time: '10:30 - 17:30',
      location: '台中世貿中心 2 館 (台中市西屯區天保街 60 號)',
      description: '中部最大卡牌盛會！匯聚全台各大頂級卡商與藏家，現場舉行高階卡牌拍賣會、一元起標競標賽及球星新人卡評級講座。',
      imageUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: `${currentYear} 高雄港都球員卡交流節與拆卡同樂會`,
      startDate: `${currentYear}-${pad(m3)}-12`,
      endDate: `${currentYear}-${pad(m3)}-13`,
      time: '11:00 - 18:00',
      location: '高雄駁二藝術特區 B6 倉庫 (高雄市鹽埕區大勇路 1 號)',
      description: '南台灣卡友年度熱門活動！設有中華職棒啦啦隊卡專區、NBA 頂級金折卡展區與現場即時拆卡抽籤活動，熱鬧非凡。',
      imageUrl: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1200&q=80',
    },
  ];

  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_') || apiKey === 'YOUR_API_KEY') {
    return fallbackExhibitions;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const today = new Date().toISOString().split('T')[0];

    const prompt = `你是一個專業的台灣體育球員卡與收藏卡展覽情報分析專家。
今天是 ${today}。
請利用 Google 搜尋台灣最新（近期、下個月或今年度）的球員卡展、球卡市集、收藏卡交流會、PSA/BGS 送件卡展等活動資訊。
搜尋關鍵字包括但不限於：台灣球員卡展, 大台北卡展, Taipei Card Show, 收藏卡交流會, 松菸卡展, 新竹卡展, 台中卡展, 高雄卡展, CARDNEX, 卡淘, 卡牌市集等。

請提取 3 到 6 場在台灣舉辦的真實或近期/即將舉行的球員卡展資訊。
請確保輸出為標準 JSON 格式的卡展陣列：
- title: 展覽名稱
- startDate: 開始日期 (YYYY-MM-DD)
- endDate: 結束日期 (YYYY-MM-DD)
- time: 展出時間 (例如: 10:00 - 18:00)
- location: 展出地點
- description: 展覽亮點與簡介
- imageUrl: 展覽宣傳圖
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            exhibitions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  startDate: { type: Type.STRING },
                  endDate: { type: Type.STRING },
                  time: { type: Type.STRING },
                  location: { type: Type.STRING },
                  description: { type: Type.STRING },
                  imageUrl: { type: Type.STRING },
                },
                required: ['title', 'startDate', 'location'],
              },
            },
          },
          required: ['exhibitions'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.exhibitions && Array.isArray(parsed.exhibitions) && parsed.exhibitions.length > 0) {
      return parsed.exhibitions;
    }
  } catch (error) {
    console.error('[ScrapeCardExhibitions] AI 搜尋失敗，切換為備援卡展:', error);
  }

  return fallbackExhibitions;
}

/**
 * 執行預測賽事同步並寫入 Firestore（自動比對去重）
 */
export async function syncPredictionsToFirestore() {
  const db = getAdminDb();
  if (!db) {
    throw new Error('Firebase Admin DB 尚未初始化');
  }

  const scrapedMatches = await scrapeSportsMatches();
  let addedCount = 0;
  let skippedCount = 0;

  // 取得現有尚未結束的預測賽事進行去重比對
  const existingSnapshot = await db.collection('predictionEvents').get();
  const existingKeys = new Set<string>();

  existingSnapshot.forEach((doc: any) => {
    const data = doc.data();
    if (data.question) {
      existingKeys.add(data.question.trim().toLowerCase());
    }
    if (data.matchName && data.bettingEndTime) {
      existingKeys.add(`${data.matchName.trim()}_${data.bettingEndTime.trim()}`.toLowerCase());
    }
  });

  const batch = db.batch();
  const collectionRef = db.collection('predictionEvents');

  for (const match of scrapedMatches) {
    const qKey = match.question.trim().toLowerCase();
    const comboKey = `${match.matchName.trim()}_${match.bettingEndTime.trim()}`.toLowerCase();

    // 已存在則跳過，避免重複灌入相同賽事
    if (existingKeys.has(qKey) || existingKeys.has(comboKey)) {
      skippedCount++;
      continue;
    }

    const newDocRef = collectionRef.doc();
    batch.set(newDocRef, {
      matchName: match.matchName,
      homeTeam: match.homeTeam || '',
      awayTeam: match.awayTeam || '',
      homeTeamLogo: match.homeTeamLogo || '',
      awayTeamLogo: match.awayTeamLogo || '',
      sportCategory: match.sportCategory || 'other',
      league: match.league || '',
      question: match.question,
      options: match.options,
      reward: match.reward || 100,
      bettingEndTime: match.bettingEndTime,
      startTime: new Date().toISOString(),
      status: 'open',
      winningOption: '',
      winningOptions: [],
      analysis: match.analysis || '',
      source: 'auto-cron',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    existingKeys.add(qKey);
    existingKeys.add(comboKey);
    addedCount++;
  }

  if (addedCount > 0) {
    await batch.commit();
  }

  // 記錄最後同步時間
  await db.collection('system_configs').doc('cron_sync').set(
    {
      lastPredictionsSyncAt: admin.firestore.FieldValue.serverTimestamp(),
      lastPredictionsAdded: addedCount,
    },
    { merge: true }
  );

  return { addedCount, skippedCount, totalScraped: scrapedMatches.length };
}

/**
 * 執行卡展行事曆同步並寫入 Firestore（自動比對去重）
 */
export async function syncExhibitionsToFirestore() {
  const db = getAdminDb();
  if (!db) {
    throw new Error('Firebase Admin DB 尚未初始化');
  }

  const scrapedExhibitions = await scrapeCardExhibitions();
  let addedCount = 0;
  let skippedCount = 0;

  // 取得現有卡展清單進行去重比對
  const existingSnapshot = await db.collection('card_exhibitions').get();
  const existingKeys = new Set<string>();

  existingSnapshot.forEach((doc: any) => {
    const data = doc.data();
    if (data.title) {
      existingKeys.add(data.title.trim().toLowerCase());
    }
  });

  const batch = db.batch();
  const collectionRef = db.collection('card_exhibitions');

  for (const exh of scrapedExhibitions) {
    const tKey = exh.title.trim().toLowerCase();

    // 若名稱完全相同則跳過，避免重複灌入
    if (existingKeys.has(tKey)) {
      skippedCount++;
      continue;
    }

    const newDocRef = collectionRef.doc();
    const sDate = exh.startDate ? new Date(exh.startDate) : new Date();
    const eDate = exh.endDate ? new Date(exh.endDate) : sDate;

    batch.set(newDocRef, {
      title: exh.title || '台灣球員卡展',
      date: admin.firestore.Timestamp.fromDate(sDate),
      endDate: admin.firestore.Timestamp.fromDate(eDate),
      time: exh.time || '10:00 - 18:00',
      location: exh.location || '台灣',
      description: exh.description || '',
      imageUrl: exh.imageUrl || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
      source: 'auto-cron',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    existingKeys.add(tKey);
    addedCount++;
  }

  if (addedCount > 0) {
    await batch.commit();
  }

  // 記錄最後同步時間
  await db.collection('system_configs').doc('cron_sync').set(
    {
      lastExhibitionsSyncAt: admin.firestore.FieldValue.serverTimestamp(),
      lastExhibitionsAdded: addedCount,
    },
    { merge: true }
  );

  return { addedCount, skippedCount, totalScraped: scrapedExhibitions.length };
}
