import { GoogleGenAI, Type } from '@google/genai';
import { NextResponse } from 'next/server';

export interface SportsMatchOdd {
  id: string;
  league: string; // NBA, MLB, CPBL, Premier League, etc.
  matchName: string; // e.g. "洛杉磯湖人 @ 金州勇士"
  homeTeam: string; // 主隊
  awayTeam: string; // 客隊
  matchTime: string; // 台灣時間 (YYYY-MM-DD HH:mm)
  bettingEndTime: string; // 預計下注截止時間 (YYYY-MM-DDTHH:mm)
  spread: string; // 讓分盤口, e.g. "勇士 -3.5 / 湖人 +3.5"
  moneyline?: string; // 獨贏賠率, e.g. "勇士 1.65 / 湖人 2.25"
  totalPoints?: string; // 大小分, e.g. "226.5 分 (大分 1.90 / 小分 1.90)"
  suggestedQuestion: string; // 預測題目
  suggestedOptions: string[]; // 預測選項陣列
  analysis: string; // 賽前焦點分析
}

// 備援示範即時賽事與盤口資料（當 API Key 未配置或聯網異常時無縫提供）
function getFallbackSportsOdds(queryText: string): SportsMatchOdd[] {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  // 計算明天與後天的時間
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const tDate = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
  const dDate = `${dayAfter.getFullYear()}-${pad(dayAfter.getMonth() + 1)}-${pad(dayAfter.getDate())}`;

  const allPresets: SportsMatchOdd[] = [
    {
      id: 'nba-gsw-lal',
      league: 'NBA 美國職籃',
      matchName: '金州勇士 vs 洛杉磯湖人',
      homeTeam: '金州勇士',
      awayTeam: '洛杉磯湖人',
      matchTime: `${tDate} 10:00`,
      bettingEndTime: `${tDate}T09:55`,
      spread: '勇士 主讓 -3.5 分 (1.92) / 湖人 客受讓 +3.5 分 (1.88)',
      moneyline: '勇士 1.62 / 湖人 2.30',
      totalPoints: '228.5 分 (大 1.90 / 小 1.90)',
      suggestedQuestion: '【NBA焦點戰】金州勇士 vs 洛杉磯湖人：讓分盤誰能過盤？',
      suggestedOptions: ['金州勇士 (-3.5)', '洛杉磯湖人 (+3.5)'],
      analysis: '勇士近五戰主場進攻效率高達 118.5，外線火力復甦；湖人背靠背作客體能面臨考驗，但禁區進攻具有身材優勢。盤口開出勇士主讓 3.5 分。',
    },
    {
      id: 'mlb-lad-sd',
      league: 'MLB 美國職棒',
      matchName: '洛杉磯道奇 vs 聖地牙哥教士',
      homeTeam: '洛杉磯道奇',
      awayTeam: '聖地牙哥教士',
      matchTime: `${tDate} 07:10`,
      bettingEndTime: `${tDate}T07:05`,
      spread: '道奇 主讓 -1.5 分 (2.05) / 教士 客受讓 +1.5 分 (1.78)',
      moneyline: '道奇 1.55 / 教士 2.45',
      totalPoints: '8.5 分 (大 1.85 / 小 1.95)',
      suggestedQuestion: '【MLB國聯焦點】洛杉磯道奇 vs 聖地牙哥教士：比賽結果預測？',
      suggestedOptions: ['洛杉磯道奇 (-1.5)', '聖地牙哥教士 (+1.5)', '總分大於 8.5 分', '總分小於 8.5 分'],
      analysis: '道奇派出王牌先發投手登板，打線中心近期長打率維持高檔；教士近期牛棚防禦率偏高，盤口多數開出主隊道奇讓 1.5 分。',
    },
    {
      id: 'cpbl-brothers-guardians',
      league: 'CPBL 中華職棒',
      matchName: '中信兄弟 vs 富邦悍將',
      homeTeam: '中信兄弟',
      awayTeam: '富邦悍將',
      matchTime: `${tDate} 18:35`,
      bettingEndTime: `${tDate}T18:30`,
      spread: '中信兄弟 主讓 -1.5 分 (1.95) / 富邦悍將 客受讓 +1.5 分 (1.85)',
      moneyline: '中信兄弟 1.60 / 富邦悍將 2.35',
      totalPoints: '7.5 分 (大 1.90 / 小 1.90)',
      suggestedQuestion: '【中華職棒例行賽】中信兄弟 vs 富邦悍將：誰能獲勝？',
      suggestedOptions: ['中信兄弟 (-1.5)', '富邦悍將 (+1.5)'],
      analysis: '中信兄弟洲際主場打線串聯度優異，富邦悍將客場作戰依賴洋投壓制力，關鍵在於中繼後援投手穩定度。',
    },
    {
      id: 'epl-mci-liv',
      league: '英超足球 Premier League',
      matchName: '曼城 (Manchester City) vs 利物浦 (Liverpool)',
      homeTeam: '曼城',
      awayTeam: '利物浦',
      matchTime: `${dDate} 03:00`,
      bettingEndTime: `${dDate}T02:55`,
      spread: '曼城 主讓 0.5/1 球 (1.98) / 利物浦 客受讓 0.5/1 球 (1.88)',
      moneyline: '曼城 1.80 / 和局 3.75 / 利物浦 3.90',
      totalPoints: '3/3.5 球 (大 1.92 / 小 1.92)',
      suggestedQuestion: '【英超榜首天王山】曼城 vs 利物浦：最終賽果？',
      suggestedOptions: ['曼城獨贏', '雙方握手言和 (和局)', '利物浦獨贏'],
      analysis: '英超頂級對決，雙方近況皆保持連勝，進攻端火力兇猛。曼城坐擁主場控球優勢，利物浦反擊速度極具威脅。',
    },
  ];

  if (!queryText.trim()) return allPresets;

  const q = queryText.toLowerCase();
  const filtered = allPresets.filter(
    m =>
      m.league.toLowerCase().includes(q) ||
      m.matchName.toLowerCase().includes(q) ||
      m.homeTeam.toLowerCase().includes(q) ||
      m.awayTeam.toLowerCase().includes(q)
  );

  return filtered.length > 0 ? filtered : allPresets;
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  let body: { query?: string; league?: string; team?: string } = {};

  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const queryText = (body.query || body.team || body.league || '').trim();

  // 若無有效的 API Key，自動回傳結構化示範盤口資料庫
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_') || apiKey === 'YOUR_API_KEY') {
    return NextResponse.json({
      success: true,
      matches: getFallbackSportsOdds(queryText),
      source: 'fallback',
      warning: '尚未配置有效 GEMINI_API_KEY，已為您載入即時示範賽事與盤口資料庫。配置 API 金鑰後即可啟用即時 Google 聯網全網檢索。',
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const today = new Date().toISOString().split('T')[0];

    const targetDesc = queryText
      ? `使用者指定查詢的球隊、聯賽或關鍵字為：「${queryText}」`
      : `請搜尋當前最新、即將在今明後三天內舉行的熱門體育賽事（優先搜尋 NBA、MLB、中華職棒 CPBL、英超足球或 TPBL/PLG 職籃）`;

    const prompt = `你是一個專業的體育賽事分析員與運彩賠率盤口情報分析專家。
今天是西元 ${today}。
${targetDesc}

請使用 Google 搜尋引擎，即時檢索該球隊/聯賽最近或即將開打的賽事場次資訊與相關盤口賠率。
搜尋時請特別注意：
1. 比賽對戰雙方（明確指出 主隊 Home Team 與 客隊 Away Team）
2. 比賽日期與開賽時間（請換算為台灣時間 GMT+8，格式：YYYY-MM-DD HH:mm）
3. 運彩/國際賭盤開出的最新盤口：
   - 讓分盤 (Spread / Handicap，如 主讓 -3.5 / 客受讓 +3.5，或 主讓 -1.5)
   - 獨贏賠率 (Moneyline，如 主 1.70 / 客 2.10)
   - 大小分盤口 (Over / Under，如 225.5 分)
4. 賽事簡短戰力與焦點分析 (50-100字)
5. 針對該場比賽自動產生一組精準的「建議預測題目」以及「建議預測選項 (例如讓分選項或獨贏選項)」

請提取 2 到 5 場符合條件的賽事資訊，輸出為嚴格的 JSON 格式。
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
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
                  id: { type: Type.STRING },
                  league: { type: Type.STRING, description: '聯賽名稱，如 NBA, MLB, CPBL, 英超' },
                  matchName: { type: Type.STRING, description: '賽事名稱，例如 主隊 vs 客隊' },
                  homeTeam: { type: Type.STRING, description: '主場球隊名稱' },
                  awayTeam: { type: Type.STRING, description: '客場球隊名稱' },
                  matchTime: { type: Type.STRING, description: '比賽時間 (台灣時間 YYYY-MM-DD HH:mm)' },
                  bettingEndTime: { type: Type.STRING, description: '建議封盤截止時間 (格式 YYYY-MM-DDTHH:mm)' },
                  spread: { type: Type.STRING, description: '讓分盤口，例如 主隊 -3.5 / 客隊 +3.5' },
                  moneyline: { type: Type.STRING, description: '獨贏賠率資訊' },
                  totalPoints: { type: Type.STRING, description: '大小分盤口資訊' },
                  suggestedQuestion: { type: Type.STRING, description: '建議預測問題題目' },
                  suggestedOptions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: '建議預測選項列表，例如 [主隊 (-3.5), 客隊 (+3.5)]',
                  },
                  analysis: { type: Type.STRING, description: '賽前簡評與焦點' },
                },
                required: ['league', 'matchName', 'homeTeam', 'awayTeam', 'matchTime', 'spread', 'suggestedQuestion', 'suggestedOptions'],
              },
            },
          },
          required: ['matches'],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error('未收到 Gemini API 回傳內容');
    }

    const data = JSON.parse(resultText);
    const matches = data.matches || [];

    if (matches.length === 0) {
      return NextResponse.json({
        success: true,
        matches: getFallbackSportsOdds(queryText),
        source: 'fallback',
        warning: `AI 搜尋未找到針對「${queryText}」的近期盤口，已載入熱門賽事參考。`,
      });
    }

    // 格式化與補齊 id 與時間
    const formattedMatches = matches.map((m: any, idx: number) => ({
      ...m,
      id: m.id || `ai-match-${Date.now()}-${idx}`,
      bettingEndTime: m.bettingEndTime || (m.matchTime ? m.matchTime.replace(' ', 'T') : ''),
    }));

    return NextResponse.json({
      success: true,
      matches: formattedMatches,
      source: 'ai',
    });
  } catch (error: any) {
    console.error('AI Fetch Sports Odds Error:', error);
    const errorMessage = error?.message || '';
    const isApiKeyError =
      errorMessage.includes('API key') ||
      errorMessage.includes('400') ||
      errorMessage.includes('PERMISSION_DENIED') ||
      errorMessage.includes('404');

    return NextResponse.json({
      success: true,
      matches: getFallbackSportsOdds(queryText),
      source: 'fallback',
      warning: isApiKeyError
        ? 'Gemini API 連線或金鑰授權異常，已自動為您載入【即時示範賽事與盤口資料庫】。'
        : 'AI 搜尋暫時繁忙，已自動載入【即時示範賽事與盤口資料庫】。',
    });
  }
}
