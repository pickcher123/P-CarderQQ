import { GoogleGenAI, Type } from '@google/genai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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

    const resultText = response.text;
    if (!resultText) {
      throw new Error('No response from Gemini API');
    }

    const data = JSON.parse(resultText);
    return NextResponse.json({ success: true, exhibitions: data.exhibitions || [] });
  } catch (error: any) {
    console.error('AI Fetch Exhibitions Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '無法抓取台灣卡展資訊' },
      { status: 500 }
    );
  }
}
