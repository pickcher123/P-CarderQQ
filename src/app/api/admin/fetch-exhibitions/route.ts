import { GoogleGenAI, Type } from '@google/genai';
import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

type ExhibitionRegion = 'taiwan' | 'asia' | 'usa';
type SearchRegion = ExhibitionRegion | 'all';

// 預備精選之台灣／亞洲／美國定期與代表性球員卡展資料（當 API Key 未配置或聯網異常時無縫備援）
function getFallbackExhibitions(region: SearchRegion = 'all') {
  const currentYear = new Date().getFullYear();
  const nextMonth = new Date().getMonth() + 2; // 1-12 based
  const m1 = nextMonth > 12 ? 1 : nextMonth;
  const m2 = (m1 % 12) + 1;
  const m3 = (m2 % 12) + 1;

  const pad = (n: number) => n.toString().padStart(2, '0');

  const allItems = [
    // 🇹🇼 台灣卡展
    {
      title: `${currentYear} 台灣大台北球員卡交易博覽會 (Taipei Card Show)`,
      startDate: `${currentYear}-${pad(m1)}-15`,
      endDate: `${currentYear}-${pad(m1)}-16`,
      time: '10:00 - 18:00',
      location: '台北市南港展覽館 2 館 (台北市南港區經貿二路 2 號)',
      region: 'taiwan',
      description: '全台規模最盛大之球卡博覽會！集結超過 100+ 知名卡店與個人賣家，現場特設 PSA / BGS 快速送評鑑定專區、球星簽名見面會、大額罕見卡交易鑑價及百人盲盒開拆秀。',
      imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: `${currentYear} 松菸收藏卡交流市集與鑑定收件會`,
      startDate: `${currentYear}-${pad(m2)}-08`,
      endDate: `${currentYear}-${pad(m2)}-09`,
      time: '11:00 - 19:00',
      location: '台北市松山文創園區 4 號倉庫 (台北市信義區光復南路 133 號)',
      region: 'taiwan',
      description: '結合 NBA、MLB、中華職棒 CPBL 與寶可夢 TCG 稀有卡展售！現場提供卡友免費交換桌、限定卡磚周邊與封膜開箱直播，是卡迷不可錯過的聚會。',
      imageUrl: 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: `${currentYear} 台中中台灣卡牌收藏博覽會 (Taichung Card Expo)`,
      startDate: `${currentYear}-${pad(m2)}-22`,
      endDate: `${currentYear}-${pad(m2)}-23`,
      time: '10:30 - 17:30',
      location: '台中世貿中心 2 館 (台中市西屯區天保街 60 號)',
      region: 'taiwan',
      description: '中部最大卡牌盛會！匯聚全台各大頂級卡商與藏家，現場舉行高階卡牌拍賣會、一元起標競標賽及球星新人卡評級講座。',
      imageUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: `${currentYear} 高雄港都球員卡交流節與拆卡同樂會`,
      startDate: `${currentYear}-${pad(m3)}-12`,
      endDate: `${currentYear}-${pad(m3)}-13`,
      time: '11:00 - 18:00',
      location: '高雄駁二藝術特區 B6 倉庫 (高雄市鹽埕區大勇路 1 號)',
      region: 'taiwan',
      description: '南台灣卡友年度熱門活動！設有中華職棒啦啦隊卡專區、NBA 頂級金折卡展區與現場即時拆卡抽籤活動，熱鬧非凡。',
      imageUrl: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1200&q=80',
    },

    // 🌏 亞洲卡展
    {
      title: `${currentYear} 日本東京國際卡牌收藏博覽會 (Tokyo Card Show)`,
      startDate: `${currentYear}-${pad(m1)}-28`,
      endDate: `${currentYear}-${pad(m1)}-30`,
      time: '10:00 - 18:30',
      location: '日本東京都江東區有明 Tokyo Big Sight (國際展示場)',
      region: 'asia',
      description: '亞洲指標性年度卡牌嘉年華！聚焦大谷翔平 MLB/日職稀世神卡、BBM/EPOCH 日本棒球珍藏卡及國際鑑定權威展位，吸引全亞洲上千卡友跨國參與。',
      imageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: `${currentYear} 香港大灣區國際體育球員卡展 (Hong Kong Card Expo)`,
      startDate: `${currentYear}-${pad(m2)}-18`,
      endDate: `${currentYear}-${pad(m2)}-20`,
      time: '10:30 - 19:00',
      location: '香港會議展覽中心 HKCEC (香港灣仔博覽道 1 號)',
      region: 'asia',
      description: '串聯港澳星馬之亞洲球卡重磅盛會！特設頂級現代籃球折射卡、足球天王簽名卡專門鑑定區，現場多組知名頻道聯合進行全球同步連線拆卡。',
      imageUrl: 'https://images.unsplash.com/photo-1506970845246-18f21d533b20?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: `${currentYear} 韓國首爾體育收藏卡展 (Seoul Sports Card Show)`,
      startDate: `${currentYear}-${pad(m3)}-05`,
      endDate: `${currentYear}-${pad(m3)}-06`,
      time: '10:00 - 18:00',
      location: '韓國首爾江南區 COEX 會展中心 (COEX Hall B)',
      region: 'asia',
      description: '韓國最大規模球員卡交流展會！展示孫興慜、李政厚等頂尖旅美球星新人親簽卡，特設海外代評免運專案與知名卡牌藏家主題座談。',
      imageUrl: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=1200&q=80',
    },

    // 🇺🇸 美國卡展
    {
      title: `The ${currentYear - 1979}th National Sports Collectors Convention (NSCC 全美最大國家級卡展)`,
      startDate: `${currentYear}-${pad(m2)}-29`,
      endDate: `${currentYear}-${pad(m3)}-02`,
      time: '09:30 - 18:00',
      location: 'Donald E. Stephens Convention Center, Rosemont / Chicago, IL',
      region: 'usa',
      description: '全球球卡界最至高無上之年度國家卡展！超過 600 家經銷商、近千位名人堂球星親自到場簽名，涵蓋 Vintage 百年骨董卡至現代百萬美元頂級折射卡。',
      imageUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: `Burbank Card Show ${currentYear} (加州伯班克頂級體育卡展)`,
      startDate: `${currentYear}-${pad(m1)}-20`,
      endDate: `${currentYear}-${pad(m1)}-22`,
      time: '10:00 - 19:00',
      location: 'Anaheim Convention Center, Anaheim / Burbank, California',
      region: 'usa',
      description: '西海岸公認最具潮流與影響力的卡友博覽會！PSA / BGS / CGC 現場收件即刻鑑定、破億身價卡牌當面成交，也是多位頂尖體育明星出沒之焦點。',
      imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=1200&q=80',
    },
    {
      title: `Dallas Card Show (德州達拉斯超級卡牌展)`,
      startDate: `${currentYear}-${pad(m3)}-20`,
      endDate: `${currentYear}-${pad(m3)}-23`,
      time: '10:00 - 18:00',
      location: 'Watters Creek Convention Center, Allen / Dallas, Texas',
      region: 'usa',
      description: '美國南部最大的常態性超大型卡展！全美知名拆卡頻道、交易商及百萬粉絲 YouTuber 齊聚，提供龐大現金交易桌與專屬封膜開盒區。',
      imageUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1200&q=80',
    },
  ];

  if (region === 'all') return allItems;
  return allItems.filter((item) => item.region === region);
}

const REGION_PROMPT_GUIDE: Record<SearchRegion, { label: string; scope: string; keywords: string }> = {
  taiwan: {
    label: '台灣',
    scope: '台灣最新（近期、下個月或今年度）的球員卡展、球卡市集、收藏卡交流會、PSA/BGS 送件卡展等活動資訊（請提取 3 到 6 場）。',
    keywords: '台灣球員卡展, 大台北卡展, Taipei Card Show, 收藏卡交流會, 松菸卡展, 新竹卡展, 台中卡展, 高雄卡展, CARDNEX, 卡淘, 卡牌市集',
  },
  asia: {
    label: '亞洲',
    scope: '亞洲各國（日本東京／大阪、香港、韓國首爾、新加坡、上海、曼谷等，不含台灣）最新近期或年度具代表性的球員卡展與體育收藏卡博覽會（請提取 3 到 6 場）。',
    keywords: 'Tokyo Card Show, Japan Sports Card Expo, Hong Kong Card Expo, Seoul Sports Card Show, Singapore Card Show, アジア トレカ イベント, 亞洲球員卡展',
  },
  usa: {
    label: '美國',
    scope: '美國最新近期或年度具代表性的球員卡展與大型體育收藏卡博覽會（請提取 3 到 6 場）。',
    keywords: 'National Sports Collectors Convention, NSCC, Burbank Card Show, Dallas Card Show, Fanatics Fest NYC, Front Row Card Show, East Coast National',
  },
  all: {
    label: '全球（台灣・亞洲・美國）',
    scope: '台灣、亞洲（日本／香港／韓國／新加坡）以及美國近期或年度具代表性的球員卡展與收藏卡博覽會（請平均提取共 6 到 9 場，每個地區至少 2 場）。',
    keywords: '台灣球員卡展, Taipei Card Show, Tokyo Card Show, Hong Kong Card Expo, Seoul Sports Card Show, NSCC, Burbank Card Show, Dallas Card Show',
  },
};

export async function POST(req: Request) {
  const auth = await verifyAdminRequest(req);
  if (!auth.ok) return auth.response;

  let requestedRegion: SearchRegion = 'all';
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.region === 'taiwan' || body?.region === 'asia' || body?.region === 'usa' || body?.region === 'all') {
      requestedRegion = body.region;
    }
  } catch {
    // ignore malformed body
  }

  const regionGuide = REGION_PROMPT_GUIDE[requestedRegion];
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

  // 若未設定 API Key，回傳結構化的精選備援卡展資料並標記提示
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_') || apiKey === 'YOUR_API_KEY') {
    return NextResponse.json({
      success: true,
      exhibitions: getFallbackExhibitions(requestedRegion),
      region: requestedRegion,
      source: 'fallback',
      warning: `尚未配置有效 GEMINI_API_KEY，已為您載入【${regionGuide.label}精選卡展資料庫】。如需啟用即時聯網 AI 搜尋，請至環境變數填入 Gemini API 金鑰。`,
    });
  }

  const extractJsonPayload = (raw: string): any => {
    const trimmed = raw.trim();
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
    try {
      return JSON.parse(candidate);
    } catch {
      const start = candidate.indexOf('{');
      const end = candidate.lastIndexOf('}');
      if (start !== -1 && end > start) {
        return JSON.parse(candidate.slice(start, end + 1));
      }
      const arrStart = candidate.indexOf('[');
      const arrEnd = candidate.lastIndexOf(']');
      if (arrStart !== -1 && arrEnd > arrStart) {
        return { exhibitions: JSON.parse(candidate.slice(arrStart, arrEnd + 1)) };
      }
      throw new Error('無法解析 AI 回傳的 JSON 格式');
    }
  };

  try {
    const ai = new GoogleGenAI({ apiKey });
    const today = new Date().toISOString().split('T')[0];

    const prompt = `你是一個專業的全球體育球員卡與收藏卡展覽情報分析專家。
今天是 ${today}。
請利用 Google 搜尋${regionGuide.scope}
搜尋關鍵字包括但不限於：${regionGuide.keywords}。

若近期無特定精確日期，請搜尋該地區最經典且持續舉辦的代表性卡展或最新公開之場次，並提供合理規範的日期格式 (YYYY-MM-DD)。

請「只輸出」一個純 JSON 物件（不要任何開場白或結語），格式如下：
{
  "exhibitions": [
    {
      "title": "展覽名稱 (可附註英文原名)",
      "region": "taiwan 或 asia 或 usa",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "time": "10:00 - 18:00",
      "location": "場館名稱與城市/國家",
      "description": "100-200字繁體中文簡介，提及 PSA/BGS 送件、拆卡秀、交換區等亮點",
      "imageUrl": ""
    }
  ]
}`;

    let resultText: string | undefined;

    // 第一階段：使用 Google Search 聯網檢索（不與 responseMimeType/responseSchema 混用，避免 Gemini API 400 衝突）
    try {
      const searchResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      resultText = searchResponse.text;
    } catch (searchErr) {
      console.warn('[fetch-exhibitions] Google Search grounding pass failed, retrying structured JSON mode:', searchErr);
    }

    // 第二階段：若聯網檢索失敗或無法解析，自動以結構化 JSON 模式重試一次
    let data: any = null;
    if (resultText) {
      try {
        data = extractJsonPayload(resultText);
      } catch (parseErr) {
        console.warn('[fetch-exhibitions] Search JSON parse failed, retrying structured JSON mode:', parseErr);
      }
    }

    if (!data || !Array.isArray(data.exhibitions) || data.exhibitions.length === 0) {
      const structuredResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
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
                    region: { type: Type.STRING, enum: ['taiwan', 'asia', 'usa'] },
                    startDate: { type: Type.STRING },
                    endDate: { type: Type.STRING },
                    time: { type: Type.STRING },
                    location: { type: Type.STRING },
                    description: { type: Type.STRING },
                    imageUrl: { type: Type.STRING },
                  },
                  required: ['title', 'region', 'startDate', 'location'],
                },
              },
            },
            required: ['exhibitions'],
          },
        },
      });
      if (structuredResponse.text) {
        data = extractJsonPayload(structuredResponse.text);
      }
    }

    const exhibitions = (data?.exhibitions || []).map((item: any) => ({
      ...item,
      region: item.region === 'taiwan' || item.region === 'asia' || item.region === 'usa'
        ? item.region
        : requestedRegion === 'all'
          ? 'taiwan'
          : requestedRegion,
    }));

    if (exhibitions.length === 0) {
      return NextResponse.json({
        success: true,
        exhibitions: getFallbackExhibitions(requestedRegion),
        region: requestedRegion,
        source: 'fallback',
      });
    }

    return NextResponse.json({ success: true, exhibitions, region: requestedRegion, source: 'ai' });
  } catch (error: any) {
    console.error('AI Fetch Exhibitions Error:', error);
    
    const errorMessage = error?.message || '';
    const isApiKeyError = errorMessage.includes('API key') || errorMessage.includes('400') || errorMessage.includes('PERMISSION_DENIED');

    return NextResponse.json({
      success: true,
      exhibitions: getFallbackExhibitions(requestedRegion),
      region: requestedRegion,
      source: 'fallback',
      warning: isApiKeyError
        ? `Gemini API Key 無效或授權異常，系統已為您切換至【${regionGuide.label}精選卡展資料庫】。`
        : `AI 搜尋暫時繁忙，系統已自動載入【${regionGuide.label}精選卡展資料庫】。`,
    });
  }
}
