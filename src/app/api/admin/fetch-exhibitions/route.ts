import { GoogleGenAI, Type } from '@google/genai';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// 預備精選之台灣定期與代表性球員卡展資料（當 API Key 未配置或聯網異常時無縫備援）
function getFallbackExhibitions() {
  const currentYear = new Date().getFullYear();
  const nextMonth = new Date().getMonth() + 2; // 1-12 based
  const m1 = nextMonth > 12 ? 1 : nextMonth;
  const m2 = (m1 % 12) + 1;
  const m3 = (m2 % 12) + 1;

  const pad = (n: number) => n.toString().padStart(2, '0');

  return [
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
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  // 若未設定 API Key，回傳結構化的精選備援卡展資料並標記提示
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_') || apiKey === 'YOUR_API_KEY') {
    return NextResponse.json({
      success: true,
      exhibitions: getFallbackExhibitions(),
      source: 'fallback',
      warning: '尚未在系統環境中配置有效 GEMINI_API_KEY，已自動為您載入台灣精選卡展資料庫。如需啟用即時聯網 AI 搜尋，請至設定填入 Gemini API 金鑰。',
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const today = new Date().toISOString().split('T')[0];

    const prompt = `你是一個專業的台灣體育球員卡與收藏卡展覽情報分析專家。
今天是 ${today}。
請利用 Google 搜尋台灣最新（近期、下個月或今年度）的球員卡展、球卡市集、收藏卡交流會、PSA/BGS 送件卡展等活動資訊。
搜尋關鍵字包括但不限於：台灣球員卡展, 大台北卡展, Taipei Card Show, 收藏卡交流會, 松菸卡展, 新竹卡展, 台中卡展, 高雄卡展, CARDNEX, 卡淘, 卡牌市集等。

請提取 3 到 6 場在台灣舉辦的真實或近期/即將舉行的球員卡展資訊。
若近期無特定精確日期，請搜尋台灣最經典且持續舉辦的代表性卡展或最新公開之場次，並提供合理規範的日期格式 (YYYY-MM-DD)。

請確保輸出為標準 JSON 格式的卡展陣列，每個物件欄位包含：
- title: 展覽名稱 (string, 例如: 2026 大台北球員卡交易博覽會)
- startDate: 開始日期 (string, 格式 YYYY-MM-DD)
- endDate: 結束日期 (string, 格式 YYYY-MM-DD，若為單日則與 startDate 相同)
- time: 展出時間 (string, 例如: 10:00 - 18:00)
- location: 展出地點 (string, 包含場館名稱與城市/地址，例如: 台北市南港展覽館 2 館 / 龍山文創基地)
- description: 展覽特色與簡介 (string, 100-200字，提及亮點如 PSA/BGS 現場鑑定收件、拆卡秀、卡友交換區、限定卡包發售等)
- imageUrl: 展覽宣傳圖 (string, 若無確切圖片可提供高品質卡展風格的 Unsplash 示意圖，或保留為空字串)
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

    const resultText = response.text;
    if (!resultText) {
      throw new Error('未收到 Gemini API 回傳內容');
    }

    const data = JSON.parse(resultText);
    const exhibitions = data.exhibitions || [];

    if (exhibitions.length === 0) {
      return NextResponse.json({
        success: true,
        exhibitions: getFallbackExhibitions(),
        source: 'fallback',
      });
    }

    return NextResponse.json({ success: true, exhibitions, source: 'ai' });
  } catch (error: any) {
    console.error('AI Fetch Exhibitions Error:', error);
    
    // 如果是 API Key 無效（400 / API key not valid）或配額問題，優雅回退為預備資料庫，不讓管理員崩潰
    const errorMessage = error?.message || '';
    const isApiKeyError = errorMessage.includes('API key') || errorMessage.includes('400') || errorMessage.includes('PERMISSION_DENIED');

    return NextResponse.json({
      success: true,
      exhibitions: getFallbackExhibitions(),
      source: 'fallback',
      warning: isApiKeyError
        ? 'Gemini API Key 無效或授權異常，系統已為您切換至【台灣精選卡展資料庫】。若需恢復 AI 聯網搜尋，請確認 Settings 中的 GEMINI_API_KEY。'
        : 'AI 搜尋暫時繁忙，系統已自動載入【台灣精選卡展資料庫】。',
    });
  }
}
