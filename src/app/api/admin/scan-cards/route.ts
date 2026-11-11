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
請找出畫面中所有獨立卡片（包括裸卡、卡夾或 PSA/BGS/CGC 評級鑑定卡殼）的位置，回傳每張卡片的標準邊界框 (Bounding Box)。

【極度重要約束】：
1. 嚴禁框選整張大圖、背景或整個掃描儀面板（絕對不能回傳覆蓋整個圖片的大外框，例如 (0,0) 到 (1000,1000)）。
2. 每張卡片或評級鑑定殼必須框選完整的高度（從卡片/鑑定殼最頂部直到最底部，不可只框頂部標籤或只框中間球員）。
3. 每張卡片的座標請以 0 到 1000 的整數百分比表示：
   - ymin: 上邊界 (0-1000)
   - xmin: 左邊界 (0-1000)
   - ymax: 下邊界 (0-1000)
   - xmax: 右邊界 (0-1000)
4. 請依從左至右、從上至下的閱讀順序排列。
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
      let rawBoxes = parsed.boxes || [];

      // 後端嚴格過濾：過濾掉面積 > 70% 或長寬皆超過 800 的全圖/背景外框
      const filteredBoxes = rawBoxes.filter((b: any) => {
        const w = (b.xmax - b.xmin);
        const h = (b.ymax - b.ymin);
        const areaRatio = (w * h) / (1000 * 1000);
        if (w > 820 && h > 820) return false;
        if (areaRatio > 0.68) return false;
        if (w < 40 || h < 40) return false; // 排除太小雜點
        return true;
      });

      return NextResponse.json({ boxes: filteredBoxes });
    }

    if (mode === 'price_estimate') {
      // 模式 3：卡價行情智慧查詢 (估算 eBay / 130point / 台灣市場行情)
      const { cardList } = await req.json().catch(() => ({ cardList: [] }));
      const pricePrompt = `
你是一位精通全球球員卡拍賣市場（eBay, 130point, PWCC, Goldin, 台灣各大卡店）的資深估價師。
請根據以下卡片資訊（球員姓名、發行年份、系列品牌、卡號、特徵如簽名/RC/限量、以及 PSA/BGS 評級），
為每張卡片評估目前市場行情（以新台幣 TWD / 等值點數計價）：

卡片清單：
${JSON.stringify(cardList, null, 2)}

請綜合考量：
1. 球員知名度與歷史表現（例如梅西、大谷翔平、維尼修斯的高價值；以及潛力新星的行情）
2. 評級等級的溢價幅度（PSA 10 往往是 PSA 9 的 2~4 倍，若是 BGS 9.5 或金標更具價值，RAW 裸卡折價）
3. 是否包含簽名 (AUTO) 或球衣 PATCH、限量編號 (Numbered)

請以結構化 JSON 回傳每張卡片的建議售價 (suggestedPrice，整數) 與行情區間 (priceRange，例如 "NT$ 15,000 ~ 20,000") 與簡短依據 (rationale)。
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [{ role: 'user', parts: [{ text: pricePrompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              estimates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    suggestedPrice: { type: Type.INTEGER },
                    priceRange: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                  },
                  required: ['id', 'suggestedPrice', 'priceRange'],
                },
              },
            },
            required: ['estimates'],
          },
        },
      });

      const parsedPrice = JSON.parse(response.text || '{"estimates":[]}');
      return NextResponse.json(parsedPrice);
    }

    // 模式 2：PRO 智慧辨識 與 PSA/BGS 評級標籤文字精準抓取 (OCR)
    const isSlabOcrOnly = mode === 'ocr_slab';

    const recognizePrompt = `
你是一位世界頂級的球員卡與收藏卡專家（Trading Card Specialist / Grader / OCR 識別大師）。
請仔細辨別圖片中的這張卡片（可能是裸卡 Raw Card，或是 PSA / BGS / CGC / SGC / ARS 評級鑑定殼）：

【重要任務：精準抓取 PSA / BGS 評級標籤文字】
如果這張卡是 PSA 或 BGS 等評級鑑定卡（卡殼頂部有白色/紅色/金色標籤）：
1. slabLabelText（評級標籤完整文字）：請一字不漏地按順序將標籤上的所有文字完整讀出並合併為一行字串（包含年份、系列品牌、卡號、球員英文名、特徵版本/簽名、評級等級與鑑定證號）。例如：
   "2019 TOPPS MUSEUM COLL UCL #FAV-JR VINICIUS JR. FRAMED AUTOGRAPH-GOLD GEM MT 10 PSA 87211077"
   或 "2020 PANINI IMPECCABLE P/L #CC-GB GARETH BALE CANVAS CREATIONS AU-SILVER NM-MT 8 BGS 116172144"。若為裸卡則回傳空字串。
2. certNumber（鑑定認證編號）：標籤上的條碼旁或防偽編號（例如 "87211077", "116172144"）。若無則為空字串。
3. subgrades（BGS 四項子分數或簽名分數）：例如 "Centering: 9.5, Corners: 9.5, Edges: 9.0, Surface: 9.5, Auto: 10"。若無則為空字串。
4. formattedTitle（標準格式化品名）：依卡牌拍賣市場標準命名（格式：年份 + 系列品牌 + 卡號 + 球員名 + 平行版/簽名 + 評級），例如 "2019 Topps Museum UCL #FAV-JR Vinicius Jr. Framed Auto Gold PSA 10"。
5. grade（評級機構與分數）：例如 "PSA 10", "PSA 9", "BGS 9.5", "BGS 9", "CGC 10", "SGC 10"，若為未評級裸卡則填 "RAW"。

【卡片基本資料辨識】
6. 球員姓名 (name)：中英文全名（例如：Stephen Curry / 大谷翔平 / 維尼修斯 Vinicius Jr.）。
7. 運動分類 (category)：只能從 ["籃球", "棒球", "足球", "女孩卡", "女優", "TCG", "其他"] 中挑選最相符的一項。
8. 發行年份 (year)：例如 2019, 2023 或 2024（西元年整數）。
9. 卡片系列與製造商 (series)：例如 "Panini Prizm", "Topps Museum Collection", "Panini Chronicles", "Topps Chrome" 等。
10. 卡號 (cardNumber)：例如 "#FAV-JR", "#CC-GB", "#216"。
11. 稀有特徵標籤 (features)：陣列，例如 "RC", "AUTO", "PATCH", "1/1", "SP", "Numbered" 等。
12. 建議定價 (suggestedPrice)：請評估該卡在卡牌市場的合理參考點數/新台幣價值（整數，如 500, 1500, 6500, 18000）。
13. 一句話簡介 (description)：一句吸引人的特色說明。

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
              description: '籃球 | 棒球 | 足球 | 女孩卡 | 女優 | TCG | 其他' 
            },
            year: { type: Type.INTEGER, description: '發行年份' },
            series: { type: Type.STRING, description: '卡片系列品牌' },
            cardNumber: { type: Type.STRING, description: '卡號' },
            grade: { type: Type.STRING, description: '評級機構與分數，如 PSA 10 或 RAW' },
            slabLabelText: { type: Type.STRING, description: 'PSA/BGS 評級標籤上完整的文字 (包含年份系列球員品名等級與證號)' },
            certNumber: { type: Type.STRING, description: '鑑定證號 (Serial Number / Cert#)' },
            subgrades: { type: Type.STRING, description: 'BGS/CGC 小分或簽名分' },
            formattedTitle: { type: Type.STRING, description: '建議的標準卡牌拍賣品名' },
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
