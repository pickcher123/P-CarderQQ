import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

const GEMINI_VISION_MODEL = 'gemini-4-hydrogen';

interface NormalizedBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
  label?: string;
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error('伺服器未配置 GEMINI_API_KEY，請至 Settings > Secrets 確認金鑰設定'), {
      statusCode: 500,
    });
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function safeParseJson<T>(rawText: string | undefined, fallback: T): T {
  if (!rawText) return fallback;
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // 清除可能夾帶的 Markdown 程式碼區塊標記
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim()) as T;
      } catch {
        // continue
      }
    }
    // 嘗試擷取最外層 JSON 物件或陣列
    const startObj = trimmed.indexOf('{');
    const endObj = trimmed.lastIndexOf('}');
    if (startObj !== -1 && endObj > startObj) {
      try {
        return JSON.parse(trimmed.slice(startObj, endObj + 1)) as T;
      } catch {
        // continue
      }
    }
    return fallback;
  }
}

async function callWithRetry<T>(fn: () => Promise<T>, maxRetries: number = 1): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err?.status || err?.statusCode || 0;
      const msg = String(err?.message || '');
      const isRetryable =
        status === 429 ||
        status >= 500 ||
        /timeout|network|fetch failed|UNAVAILABLE|INTERNAL/i.test(msg);
      if (attempt < maxRetries && isRetryable) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function formatGeminiError(error: any): { message: string; status: number } {
  const rawStatus = Number(error?.status || error?.statusCode || 0);
  const rawMessage = String(error?.message || 'AI 處理失敗，請稍後再試');

  if (rawStatus === 403 || /PERMISSION_DENIED/i.test(rawMessage)) {
    return {
      status: 403,
      message: 'Gemini API 金鑰權限不足，請至 Settings > Secrets 確認 API Key 設定。',
    };
  }
  if (rawStatus === 400 && /API_KEY_INVALID/i.test(rawMessage)) {
    return {
      status: 400,
      message: 'Gemini API 金鑰無效，請至 Settings > Secrets 重新設定。',
    };
  }
  if (rawStatus === 429 || /RESOURCE_EXHAUSTED|quota/i.test(rawMessage)) {
    return {
      status: 429,
      message: 'AI 呼叫頻率已達上限，請稍候幾秒後再重試。',
    };
  }
  if (rawStatus === 404 || /NOT_FOUND/i.test(rawMessage)) {
    return {
      status: 502,
      message: `AI 模型暫時無法存取 (${GEMINI_VISION_MODEL})：${rawMessage}`,
    };
  }
  return {
    status: rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500,
    message: rawMessage,
  };
}

/**
 * 清理、合併誤拆標籤、去重並依行/列排序偵測到的邊界框 (座標系: 0~1000)
 */
function postProcessDetectedBoxes(rawItems: any[]): NormalizedBox[] {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return [];

  // 1. 解析 box_2d: [ymin, xmin, ymax, xmax] 或獨立欄位
  const parsed: NormalizedBox[] = [];
  for (const item of rawItems) {
    let ymin: number;
    let xmin: number;
    let ymax: number;
    let xmax: number;

    if (Array.isArray(item?.box_2d) && item.box_2d.length === 4) {
      [ymin, xmin, ymax, xmax] = item.box_2d.map(Number);
    } else {
      ymin = Number(item?.ymin);
      xmin = Number(item?.xmin);
      ymax = Number(item?.ymax);
      xmax = Number(item?.xmax);
    }

    if (
      !Number.isFinite(ymin) ||
      !Number.isFinite(xmin) ||
      !Number.isFinite(ymax) ||
      !Number.isFinite(xmax)
    ) {
      continue;
    }

    // 修正可能顛倒的座標
    if (ymin > ymax) [ymin, ymax] = [ymax, ymin];
    if (xmin > xmax) [xmin, xmax] = [xmax, xmin];

    const clampedXmin = Math.max(0, Math.min(995, Math.round(xmin)));
    const clampedYmin = Math.max(0, Math.min(995, Math.round(ymin)));
    const clampedXmax = Math.max(clampedXmin + 5, Math.min(1000, Math.round(xmax)));
    const clampedYmax = Math.max(clampedYmin + 5, Math.min(1000, Math.round(ymax)));

    const w = clampedXmax - clampedXmin;
    const h = clampedYmax - clampedYmin;

    // 過濾極小雜點（寬度 < 4% 或高度 < 4%）
    if (w < 40 || h < 40) continue;

    parsed.push({
      ymin: clampedYmin,
      xmin: clampedXmin,
      ymax: clampedYmax,
      xmax: clampedXmax,
      label: typeof item?.label === 'string' ? item.label : undefined,
    });
  }

  if (parsed.length === 0) return [];

  // 2. 若是多卡圖，濾除覆蓋幾乎整張畫面的外層容器框（保留單卡近拍大框）
  const withoutCanvasFrame =
    parsed.length > 1
      ? parsed.filter((b) => {
          const w = b.xmax - b.xmin;
          const h = b.ymax - b.ymin;
          return !(w > 920 && h > 920);
        })
      : parsed;

  const working = withoutCanvasFrame.length > 0 ? withoutCanvasFrame : parsed;

  // 3. 若 AI 意外將鑑定卡上方的矮標籤條與下方卡面拆成兩塊，自動安全合併
  const consumed = new Set<number>();
  for (let i = 0; i < working.length; i++) {
    const top = working[i];
    const topH = top.ymax - top.ymin;
    const topW = top.xmax - top.xmin;
    // 只有很扁的橫條（寬明顯大於高，且高度小於整圖 14%）才視為疑似被拆開的鑑定標籤
    if (topH > 140 || topW / Math.max(1, topH) < 1.6) continue;

    for (let j = 0; j < working.length; j++) {
      if (i === j || consumed.has(j)) continue;
      const body = working[j];
      const bodyH = body.ymax - body.ymin;
      if (bodyH < topH * 1.4) continue;

      const overlapLeft = Math.max(top.xmin, body.xmin);
      const overlapRight = Math.min(top.xmax, body.xmax);
      const overlapW = Math.max(0, overlapRight - overlapLeft);
      const minW = Math.min(topW, body.xmax - body.xmin);
      const verticalGap = body.ymin - top.ymax;

      if (overlapW / Math.max(1, minW) > 0.65 && verticalGap >= -25 && verticalGap <= 45) {
        body.xmin = Math.min(top.xmin, body.xmin);
        body.ymin = Math.min(top.ymin, body.ymin);
        body.xmax = Math.max(top.xmax, body.xmax);
        body.ymax = Math.max(top.ymax, body.ymax);
        consumed.add(i);
        break;
      }
    }
  }

  const merged = working.filter((_, idx) => !consumed.has(idx));

  // 4. 去除重複框與被完整包覆的內部子框（例如同時框到外殼與內部球員頭像）
  //    由大到小排序，確保優先保留外層完整卡框，並正確處理面積相等的重複框
  const sortedByArea = [...merged].sort((a, b) => {
    const areaA = (a.xmax - a.xmin) * (a.ymax - a.ymin);
    const areaB = (b.xmax - b.xmin) * (b.ymax - b.ymin);
    return areaB - areaA;
  });

  const kept: NormalizedBox[] = [];
  for (const box of sortedByArea) {
    const area = (box.xmax - box.xmin) * (box.ymax - box.ymin);
    const isDuplicateOrNested = kept.some((existing) => {
      const existingArea = (existing.xmax - existing.xmin) * (existing.ymax - existing.ymin);
      const ix1 = Math.max(box.xmin, existing.xmin);
      const iy1 = Math.max(box.ymin, existing.ymin);
      const ix2 = Math.min(box.xmax, existing.xmax);
      const iy2 = Math.min(box.ymax, existing.ymax);
      if (ix2 <= ix1 || iy2 <= iy1) return false;
      const interArea = (ix2 - ix1) * (iy2 - iy1);
      const containment = interArea / Math.max(1, area);
      const iou = interArea / Math.max(1, area + existingArea - interArea);
      return containment > 0.68 || iou > 0.58;
    });
    if (!isDuplicateOrNested) {
      kept.push(box);
    }
  }

  // 5. 依視覺排組排序：動態判斷同一排（中心 Y 差距小於較小框高度的 45%），由上而下、由左而右
  const rows: NormalizedBox[][] = [];
  const byCenterY = [...kept].sort(
    (a, b) => (a.ymin + a.ymax) / 2 - (b.ymin + b.ymax) / 2
  );

  for (const box of byCenterY) {
    const centerY = (box.ymin + box.ymax) / 2;
    const h = box.ymax - box.ymin;
    let placed = false;
    for (const row of rows) {
      const rowAvgY =
        row.reduce((sum, r) => sum + (r.ymin + r.ymax) / 2, 0) / row.length;
      const rowMinH = Math.min(...row.map((r) => r.ymax - r.ymin));
      if (Math.abs(centerY - rowAvgY) < Math.min(h, rowMinH) * 0.48) {
        row.push(box);
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.push([box]);
    }
  }

  rows.sort((rowA, rowB) => {
    const avgA = rowA.reduce((s, b) => s + b.ymin, 0) / rowA.length;
    const avgB = rowB.reduce((s, b) => s + b.ymin, 0) / rowB.length;
    return avgA - avgB;
  });

  const finalBoxes: NormalizedBox[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.xmin - b.xmin);
    finalBoxes.push(...row);
  }

  return finalBoxes;
}

export async function POST(req: NextRequest) {
  try {
    const {
      image, // base64 data string (with or without data:image/...;base64, prefix)
      backImage, // optional back-side base64 data string for dual-side recognition
      mode = 'recognize', // 'recognize' | 'detect' | 'ocr_slab' | 'price_estimate'
      cardList = [],
    } = await req.json();

    if (!image && mode !== 'price_estimate') {
      return NextResponse.json({ error: '未提供圖片資料' }, { status: 400 });
    }

    const ai = getAiClient();

    // 提取乾淨的 base64 與 mimeType
    let base64Data = image || '';
    let mimeType = 'image/jpeg';
    if (image && typeof image === 'string' && image.startsWith('data:')) {
      const matches = image.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        base64Data = matches[2];
      }
    }

    let backBase64Data = '';
    let backMimeType = 'image/jpeg';
    if (backImage && typeof backImage === 'string') {
      if (backImage.startsWith('data:')) {
        const backMatches = backImage.match(/^data:([^;]+);base64,(.+)$/);
        if (backMatches) {
          backMimeType = backMatches[1];
          backBase64Data = backMatches[2];
        }
      } else {
        backBase64Data = backImage;
      }
    }

    if (mode === 'detect') {
      // 模式 1：自動偵測單卡／多卡精準物理邊界框 (使用 Gemini 原生 box_2d 座標系 0~1000)
      const detectPrompt = `You are a precision trading card & graded slab bounding-box detector.
Detect EVERY individual trading card, toploader, magnetic one-touch case, or graded slab (PSA / BGS / CGC / SGC / ARS) in this image.

STRICT DETECTION RULES:
1. GRADED SLABS (PSA / BGS / CGC / SGC / ARS): Each box_2d MUST tightly wrap the ENTIRE outer clear plastic slab from the very top edge above the grade label down to the very bottom edge of the slab, and from the outer left edge to the outer right edge. NEVER split the top label from the card artwork, and NEVER crop only the inner card while cutting off the label.
2. RAW CARDS / TOPLOADERS / SLEEVES / MAGNETIC CASES: Tightly hug the exact 4 physical outer edges of the card or holder, excluding surrounding desk, table, scanner glass, fingers, or background shadows.
3. MULTI-CARD SCANS OR PHOTOS (2, 3, 4, 6, 8, 9+ cards): Output ONE separate box_2d for EACH individual card. NEVER merge adjacent cards into one box, and NEVER output an outer bounding box covering multiple cards or the whole scanner bed.
4. SINGLE CARD PHOTOS: Even if a single card fills 70%-99% of the image, output 1 tight box_2d matching its exact physical outer edges.
5. COORDINATE SYSTEM: Return box_2d as [ymin, xmin, ymax, xmax] with integers normalized to 0..1000 (0 = top/left edge of image, 1000 = bottom/right edge of image).
6. Double-check that every card in the image is accounted for without missing any card or creating duplicate overlapping boxes.
7. Order cards row-by-row from top to bottom, and left to right within each row.`;

      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model: GEMINI_VISION_MODEL,
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType,
                },
              },
              { text: detectPrompt },
            ],
          },
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                boxes: {
                  type: Type.ARRAY,
                  description: 'Detected individual trading cards or graded slabs.',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      box_2d: {
                        type: Type.ARRAY,
                        description:
                          'Tight bounding box [ymin, xmin, ymax, xmax] normalized to 0..1000 integers.',
                        items: { type: Type.INTEGER },
                      },
                      label: {
                        type: Type.STRING,
                        description: 'Short type label, e.g. PSA Slab, BGS Slab, Magnetic Case, Card.',
                      },
                    },
                    required: ['box_2d'],
                  },
                },
              },
              required: ['boxes'],
            },
          },
        })
      );

      const parsed = safeParseJson<{ boxes?: any[] }>(response.text, { boxes: [] });
      const rawBoxes = Array.isArray(parsed.boxes) ? parsed.boxes : [];
      const filteredBoxes = postProcessDetectedBoxes(rawBoxes);

      return NextResponse.json({
        boxes: filteredBoxes,
        source: 'gemini',
        model: GEMINI_VISION_MODEL,
      });
    }

    if (mode === 'price_estimate') {
      // 模式 3：卡價行情智慧查詢（優先聯網檢索 eBay / 130point / PWCC / Goldin 近期成交紀錄，失敗時自動降級純模型估價）
      const today = new Date().toISOString().split('T')[0];
      const pricePrompt = `
你是一位精通全球球員卡拍賣市場（eBay Sold、130point、PWCC、Goldin、CardLadder 與台灣各大卡店行情）的資深估價師。
今天是 ${today}，美金匯率約 1 USD = 32.5 TWD。
請逐一查詢並評估以下卡片的近期真實成交行情（優先搜尋 eBay Sold / 130point 近期同卡號、同平行版、同評級的成交價），再換算為新台幣 TWD 建議售價：

卡片清單：
${JSON.stringify(cardList, null, 2)}

【嚴格估價原則】：
1. 優先比對完全相同的年份、系列、平行版（Refractor / Silver / Gold / Numbered / Auto / Kaboom / Stained Glass 等）與評級等級（PSA 10、PSA 9、PSA 8.5、BGS 9.5、RAW）。
2. 評級價差必須合理：PSA 10 通常高於 PSA 9 約 1.8~3.5 倍；PSA 8.5 / PSA 8 接近或略高於 RAW 裸卡；親筆簽名（AUTO）與 RC 新秀標誌具有顯著溢價。
3. suggestedPrice 請給出「單一新台幣整數建議售價」（例如 4500、12800，尾數取整至十位或百位，最低不低於 50）。
4. priceRange 請同時標註台幣與美金參考區間，格式例如："NT$ 4,200 ~ 5,500 (US$ 130 ~ 170)"。
5. rationale 請用繁體中文精簡說明（35~80 字），指出參考的市場成交區間、評級／簽名溢價與球員近期行情。

請僅輸出標準 JSON 物件，格式為 { "estimates": [{ "id": "...", "suggestedPrice": 4500, "priceRange": "...", "rationale": "..." }] }。
`;

      const priceResponseSchema = {
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
              required: ['id', 'suggestedPrice', 'priceRange', 'rationale'],
            },
          },
        },
        required: ['estimates'],
      };

      let usedLiveSearch = false;
      let responseText: string | undefined;

      try {
        const searchResp = await callWithRetry(() =>
          ai.models.generateContent({
            model: GEMINI_VISION_MODEL,
            contents: pricePrompt,
            config: {
              tools: [{ googleSearch: {} }],
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: priceResponseSchema,
            },
          })
        );
        responseText = searchResp.text;
        usedLiveSearch = true;
      } catch (searchErr) {
        console.warn('[scan-cards] Google Search price grounding fallback:', searchErr);
        const fallbackResp = await callWithRetry(() =>
          ai.models.generateContent({
            model: GEMINI_VISION_MODEL,
            contents: pricePrompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: priceResponseSchema,
            },
          })
        );
        responseText = fallbackResp.text;
      }

      const parsedPrice = safeParseJson<{ estimates?: any[] }>(responseText, { estimates: [] });
      const normalizedEstimates = (Array.isArray(parsedPrice.estimates) ? parsedPrice.estimates : []).map((e: any) => ({
        id: String(e.id || ''),
        suggestedPrice: Math.max(50, Math.round(Number(e.suggestedPrice) || 100)),
        priceRange: String(e.priceRange || ''),
        rationale: String(e.rationale || ''),
      }));

      return NextResponse.json({
        estimates: normalizedEstimates,
        usedLiveSearch,
        model: GEMINI_VISION_MODEL,
      });
    }

    // 模式 2：PRO 智慧辨識 與 PSA/BGS 評級標籤文字精準抓取 (OCR) — 支援正反面雙圖聯判
    const isSlabOcrOnly = mode === 'ocr_slab';
    const hasBackImage = Boolean(backBase64Data);

    const recognizePrompt = `
你是一位世界頂級的球員卡與收藏卡專家（Trading Card Specialist / Grader / OCR 識別大師）。
${isSlabOcrOnly ? '【本次重點：請將最高注意力放在卡片最上方的 PSA / BGS / CGC / SGC / ARS 評級標籤文字、條碼旁證號與子分數 OCR 精準抄錄，一字不漏。】' : ''}
${hasBackImage ? '【本次提供正反面雙圖：第 1 張為卡片正面、第 2 張為卡片背面！請務必仔細判讀背面的卡號（例如 #216）、限量編號（例如 15/99、/25、1/1）、版權發行年份、品牌系列全稱與親簽／球衣真品保證文字，並與正面球星及評級標籤交叉整合，產出最精準的完整品名與估價。】' : ''}
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

    const recognizeParts: any[] = [
      {
        inlineData: {
          data: base64Data,
          mimeType,
        },
      },
    ];
    if (hasBackImage) {
      recognizeParts.push({
        inlineData: {
          data: backBase64Data,
          mimeType: backMimeType,
        },
      });
    }
    recognizeParts.push({ text: recognizePrompt });

    const response = await callWithRetry(() =>
      ai.models.generateContent({
        model: GEMINI_VISION_MODEL,
        contents: {
          parts: recognizeParts,
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: '球員或卡片完整名稱' },
              category: {
                type: Type.STRING,
                description: '籃球 | 棒球 | 足球 | 女孩卡 | 女優 | TCG | 其他',
              },
              year: { type: Type.INTEGER, description: '發行年份' },
              series: { type: Type.STRING, description: '卡片系列品牌' },
              cardNumber: { type: Type.STRING, description: '卡號' },
              grade: { type: Type.STRING, description: '評級機構與分數，如 PSA 10 或 RAW' },
              slabLabelText: {
                type: Type.STRING,
                description: 'PSA/BGS 評級標籤上完整的文字 (包含年份系列球員品名等級與證號)',
              },
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
      })
    );

    const parsed = safeParseJson(response.text, {});
    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error('Scan cards error:', error);
    const { message, status } = formatGeminiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
