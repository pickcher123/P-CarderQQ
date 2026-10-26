import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

interface OracleResponse {
  fortuneTitle: string;
  luckLevel: string;
  luckScore: number;
  luckyNumbers: number[];
  luckyReason: string;
  luckyDirection: string;
  luckyColor: string;
  oracleQuote: string;
  geminiPowered: boolean;
  remainingCount: number;
}

// 豐富的本地備援卦象庫
const FALLBACK_ORACLES = [
  {
    fortuneTitle: '【紫氣東來 · 帝王首選】',
    luckLevel: 'SSR 逆天大吉',
    luckScore: 99,
    luckyReason: '今日天府星高照，福運直沖斗杓！此號暗合卡池天命機遇，極易炸出限量特卡！',
    luckyDirection: '正南方 · 迎光之處',
    luckyColor: '帝皇金 · 烈焰橙',
    oracleQuote: '凝神屏氣，心念所向，金光必至！',
  },
  {
    fortuneTitle: '【靈狐拜月 · 奇巧通靈】',
    luckLevel: 'UR 狂喜上上籤',
    luckScore: 96,
    luckyReason: '玄鳥盤旋，水木相生！此數在剩餘盲包中氣息最為清奇，切忌猶豫，果斷下注！',
    luckyDirection: '東南方 · 順風方位',
    luckyColor: '星芒青 · 琥珀褐',
    oracleQuote: '出其不意，單抽出奇蹟，連抽奪大賞！',
  },
  {
    fortuneTitle: '【神龍擺尾 · 決殺入魂】',
    luckLevel: 'SSR 神威頂峰',
    luckScore: 98,
    luckyReason: '宛如終場前 0.1 秒後仰跳投絕殺！命盤中帶有強烈壓哨收網機運，正是開箱良機！',
    luckyDirection: '正東方 · 朝陽之勢',
    luckyColor: '曜石黑 · 鎏金黃',
    oracleQuote: '手風正順，自信出手，這波穩拿頭獎！',
  },
  {
    fortuneTitle: '【金玉滿堂 · 聚寶納吉】',
    luckLevel: '大吉 · 福星拱照',
    luckScore: 92,
    luckyReason: '財帛宮紫微星動，今日對傳奇稀有卡極具感召力，跟隨直覺必有所獲！',
    luckyDirection: '正西方 · 聚財方位',
    luckyColor: '珍珠白 · 耀目藍',
    oracleQuote: '開卡前雙手合十，幸運女神自會降臨！',
  },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const poolName: string = body.poolName || '頂級球員卡池';
    const rawAvailable: number[] = Array.isArray(body.availableTickets) ? body.availableTickets : [];
    const userZodiac: string = body.userZodiac || '幸運星人';
    const pickCount: number = Math.min(Math.max(body.pickCount || 1, 1), 5);

    // 確保候選號碼為純數字且去重
    const candidateNumbers: number[] = rawAvailable.length > 0 
      ? Array.from(new Set(rawAvailable.map(Number).filter(n => !isNaN(n) && n > 0)))
      : Array.from({ length: 80 }, (_, i) => i + 1);

    const candidateSet = new Set(candidateNumbers);

    // 預設隨機挑選作為兜底（絕對嚴格從 candidateNumbers 中挑選）
    const shuffled = [...candidateNumbers].sort(() => 0.5 - Math.random());
    const defaultLuckyNumbers = shuffled.slice(0, Math.min(pickCount, shuffled.length));

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && candidateNumbers.length > 0) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `你是一位精通體育球員卡開箱與一番賞抽籤的「AI 賽博玄學算命仙」。
請根據當前玩家資訊，為他進行今日抽卡運勢卜卦，並為他在【目前卡池中真正剩餘】的籤號中，挑選出最具「靈驗氣場」的幸運號碼！

【背景資訊】
- 當前卡池/福袋：${poolName}
- 玩家星座/生肖/屬性：${userZodiac}
- 欲卜籤數量：${pickCount} 籤

【🚨 最嚴格規則：僅能推薦以下卡池中真正剩餘、未被抽走的號碼】
以下是卡池中「僅存的剩餘籤號」清單：
[${candidateNumbers.join(', ')}]

【鐵律禁令】：已被抽走或不存在上述清單的號碼「絕對不可推薦」！
請從上述清單中嚴格挑選 ${pickCount} 個最具天命加持的號碼，並針對這幾個號碼給予熱血幽默的玄學短評。`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            temperature: 0.85,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                fortuneTitle: {
                  type: Type.STRING,
                  description: '卦象稱號，例如【紫氣東來 · 一發入魂】',
                },
                luckLevel: {
                  type: Type.STRING,
                  description: '運勢等級，例如 SSR 逆天大吉 / UR 狂喜上上籤',
                },
                luckScore: {
                  type: Type.INTEGER,
                  description: '運勢指數 (85 ~ 100)',
                },
                luckyNumbers: {
                  type: Type.ARRAY,
                  items: { type: Type.INTEGER },
                  description: `選出的 ${pickCount} 個號碼，必須100%完全來自給定的剩餘籤號清單`,
                },
                luckyReason: {
                  type: Type.STRING,
                  description: '算命仙風趣生動的號碼玄學解說（40~80字）',
                },
                luckyDirection: {
                  type: Type.STRING,
                  description: '開盒最佳玄學方位（例如：正東方 · 迎陽之位）',
                },
                luckyColor: {
                  type: Type.STRING,
                  description: '開運幸運色（例如：帝皇金、星空紫）',
                },
                oracleQuote: {
                  type: Type.STRING,
                  description: '一句熱血開箱咒語或開運錦囊（15~30字）',
                },
              },
              required: [
                'fortuneTitle',
                'luckLevel',
                'luckScore',
                'luckyNumbers',
                'luckyReason',
                'luckyDirection',
                'luckyColor',
                'oracleQuote',
              ],
            },
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text) as OracleResponse;

          // 🚨 強制過濾：僅保留 100% 存在於 candidateNumbers（真正剩餘）中的號碼！
          let validNumbers = (parsed.luckyNumbers || [])
            .map(Number)
            .filter(n => candidateSet.has(n));

          // 若 AI 產生了已被抽走的號碼導致數量不足，立即從真正剩餘的 candidateNumbers 中隨機補齊
          if (validNumbers.length < pickCount) {
            const unusedCandidates = candidateNumbers.filter(n => !validNumbers.includes(n));
            const extraPicks = unusedCandidates.sort(() => 0.5 - Math.random()).slice(0, pickCount - validNumbers.length);
            validNumbers = [...validNumbers, ...extraPicks];
          }

          const finalNumbers = validNumbers.slice(0, pickCount);

          return NextResponse.json({
            ...parsed,
            luckyNumbers: finalNumbers,
            geminiPowered: true,
            remainingCount: candidateNumbers.length,
          });
        }
      } catch (geminiError) {
        console.warn('Gemini Oracle generation fallback to local oracle:', geminiError);
      }
    }

    // 本地備援隨機卦象（保證號碼絕對來自 candidateNumbers）
    const randomFallback = FALLBACK_ORACLES[Math.floor(Math.random() * FALLBACK_ORACLES.length)];
    return NextResponse.json({
      ...randomFallback,
      luckyNumbers: defaultLuckyNumbers,
      geminiPowered: false,
      remainingCount: candidateNumbers.length,
    });
  } catch (error: any) {
    console.error('AI Gacha Oracle error:', error);
    return NextResponse.json({
      fortuneTitle: '【福星高照 · 隨心開花】',
      luckLevel: '大吉 90%',
      luckScore: 90,
      luckyNumbers: [7],
      luckyReason: '冥冥之中自有定數，今日卡運亨通，直接點選順眼的號碼即是大吉！',
      luckyDirection: '正東方',
      luckyColor: '黃金金',
      oracleQuote: '信者有福，大獎自來！',
      geminiPowered: false,
      remainingCount: 0,
    }, { status: 200 });
  }
}
