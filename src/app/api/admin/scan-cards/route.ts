import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { 
      image, // base64 data string (with or without data:image/...;base64, prefix)
      mode = 'recognize', // 'recognize' | 'detect'
    } = await req.json();

    if (!image) {
      return NextResponse.json({ error: '未提供圖片資料' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: '伺服器未配置 GEMINI_API_KEY' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // 提取乾淨的 base64 與 mimeType
    let base64Data = image;
    let mimeType = 'image/jpeg';
    if (image.startsWith('data:')) {
      const matches = image.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        base64Data = matches[2];
      }
    }

    if (mode === 'detect') {
      // 模式 1：自動偵測多卡邊界框 (Bounding Boxes)
      const detectPrompt = `
請分析這張包含一張或多張球員卡／收藏卡的掃描圖或合拍照。
請找出畫面中所有卡片（包括裸卡、卡夾或 PSA/BGS 評級鑑定卡殼）的位置，回傳每張卡片的標準邊界框 (Bounding Box)。
每張卡片的座標請以 0 到 1000 的整數百分比表示：
- ymin: 上邊界 (0-1000)
- xmin: 左邊界 (0-1000)
- ymax: 下邊界 (0-1000)
- xmax: 右邊界 (0-1000)
請依從左至右、從上至下的閱讀順序排列。
請僅回傳標準 JSON。
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: detectPrompt },
              {
                inlineData: {
                  data: base64Data,
                  mimeType,
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              boxes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    ymin: { type: Type.INTEGER },
                    xmin: { type: Type.INTEGER },
                    ymax: { type: Type.INTEGER },
                    xmax: { type: Type.INTEGER },
                    label: { type: Type.STRING },
                  },
                  required: ['ymin', 'xmin', 'ymax', 'xmax'],
                },
              },
            },
            required: ['boxes'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{"boxes":[]}');
      return NextResponse.json(parsed);
    }

    // 模式 2：PRO 智慧辨識 (精準提取球員、年份系列、卡號、評級、稀有度特徵與定價)
    const recognizePrompt = `
你是一位世界頂級的球員卡與收藏卡專家（Trading Card Specialist / Grader）。
請仔細辨別圖片中的這張卡片（可能是裸卡 Raw Card，或是 PSA / BGS / CGC / SGC 評級鑑定殼）：
1. 球員姓名：請提取中英文全名（例如：Stephen Curry / 大谷翔平 / 盧卡·東契奇 Luka Doncic）。如果非運動員而是動漫或女孩卡，請填寫角色或人物名稱。
2. 運動分類：只能從 ["籃球", "棒球", "足球", "女孩卡", "TCG", "其他"] 中挑選最相符的一項。
3. 發行年份：例如 2023 或 2024（西元年整數）。
4. 卡片系列與製造商：例如 "Panini Prizm", "Topps Chrome", "Epoch", "BBM", "Pokemon" 等。
5. 卡號：例如 "#15", "#RC-1", "Refractor #77"。
6. 評級機構：如果是評級卡殼，識別公司（"PSA", "BGS", "CGC", "SGC"），如果是一般卡套或未送評填 "RAW"。
7. 評級分數：例如 "10", "9.5", "9", "8" 等，若無則填 "RAW"。
8. 稀有特徵標籤 (features)：陣列，請提取如 "RC"(新秀卡), "AUTO"(親筆簽名), "PATCH"(實戰裁片), "1/1"(全球限量唯一), "SP"(短印), "SSP", "Numbered(/99)" 等。
9. 建議定價 (suggestedPrice)：請評估該卡在卡牌市場的合理參考點數/新台幣價值（整數，如 500, 1500, 3000, 10000）。
10. 一句話簡介 (description)：一句吸引人的特色說明。

請以結構化 JSON 輸出。
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: recognizePrompt },
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: '球員或卡片完整名稱' },
            category: { 
              type: Type.STRING, 
              description: '籃球 | 棒球 | 足球 | 女孩卡 | TCG | 其他' 
            },
            year: { type: Type.INTEGER, description: '發行年份' },
            series: { type: Type.STRING, description: '卡片系列品牌' },
            cardNumber: { type: Type.STRING, description: '卡號' },
            grade: { type: Type.STRING, description: '評級機構與分數，如 PSA 10 或 RAW' },
            features: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '特徵標籤，如 RC, AUTO, PATCH, 1/1',
            },
            suggestedPrice: { type: Type.INTEGER, description: '建議售價（點數）' },
            description: { type: Type.STRING, description: '簡述' },
          },
          required: ['name', 'category', 'grade', 'features', 'suggestedPrice'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error('Scan cards error:', error);
    return NextResponse.json(
      { error: error?.message || '辨識失敗，請稍後再試' },
      { status: 500 }
    );
  }
}
