import { NextRequest, NextResponse } from 'next/server';
import firebaseConfigData from '@/../firebase-applet-config.json';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Cache-Control': 'no-store, max-age=0',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

function parseFirestoreFields(fields: any): any {
  if (!fields) return {};
  const res: any = {};
  for (const key of Object.keys(fields)) {
    const val = fields[key];
    if ('stringValue' in val) res[key] = val.stringValue;
    else if ('integerValue' in val) res[key] = Number(val.integerValue);
    else if ('doubleValue' in val) res[key] = Number(val.doubleValue);
    else if ('booleanValue' in val) res[key] = val.booleanValue;
    else if ('timestampValue' in val) res[key] = { seconds: Math.floor(new Date(val.timestampValue).getTime() / 1000) };
    else if ('arrayValue' in val) {
      res[key] = (val.arrayValue.values || []).map((v: any) => {
        if ('mapValue' in v) return parseFirestoreFields(v.mapValue.fields);
        if ('stringValue' in v) return v.stringValue;
        if ('integerValue' in v) return Number(v.integerValue);
        return v;
      });
    } else if ('mapValue' in val) {
      res[key] = parseFirestoreFields(val.mapValue.fields);
    }
  }
  return res;
}

async function handleFetchPools(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json';
    const showAll = searchParams.get('all') === 'true' || searchParams.get('includeDraft') === 'true';

    const projectId = firebaseConfigData?.projectId || 'studio-8439816843-ca6d5';
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

    // 1. 同步取得 cardPools 與 allCards (以無快取模式拉取最新即時資料)
    const [poolsRes, cardsRes] = await Promise.all([
      fetch(`${baseUrl}/cardPools?pageSize=100`, { cache: 'no-store' }).catch(() => null),
      fetch(`${baseUrl}/allCards?pageSize=500`, { cache: 'no-store' }).catch(() => null),
    ]);

    const poolsJson = poolsRes ? await poolsRes.json().catch(() => ({})) : {};
    const cardsJson = cardsRes ? await cardsRes.json().catch(() => ({})) : {};

    const allCardsMap = new Map<string, any>();
    if (cardsJson.documents && Array.isArray(cardsJson.documents)) {
      for (const doc of cardsJson.documents) {
        const id = doc.name.split('/').pop();
        const data = parseFirestoreFields(doc.fields);
        allCardsMap.set(id, { id, ...data });
      }
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const poolDocs = poolsJson.documents || [];

    const report = poolDocs
      .map((doc: any) => {
        const id = doc.name.split('/').pop();
        const data = parseFirestoreFields(doc.fields);
        return { id, ...data };
      })
      .filter((pool: any) => {
        if (showAll) return true;
        // 剩餘包數容錯檢查 (轉為 Number 比對)
        const remPacks = Number(pool.remainingPacks ?? 0);
        if (remPacks <= 0) return false;
        // 時間限制檢查
        const isStarted = !pool.startsAt || (pool.startsAt.seconds <= nowSeconds);
        const isNotExpired = !pool.expiresAt || (pool.expiresAt.seconds > nowSeconds);
        return isStarted && isNotExpired;
      })
      .map((pool: any) => {
        let legendaryCount = 0;
        const grandPrizes: any[] = [];

        // 計算卡片類大獎
        if (Array.isArray(pool.cards) && pool.cardRarities) {
          pool.cards.forEach((c: any) => {
            const rarity = pool.cardRarities[c.cardId];
            const cardData = allCardsMap.get(c.cardId);
            const qty = Number(c.quantity || 0);
            if (rarity === 'legendary' && qty > 0 && !cardData?.isSold) {
              legendaryCount += qty;
              grandPrizes.push({
                name: cardData?.name || '稀有大獎卡',
                cardId: c.cardId,
                remaining: qty,
              });
            }
          });
        }

        // 計算點數類大獎
        if (Array.isArray(pool.pointPrizes)) {
          pool.pointPrizes.forEach((p: any) => {
            const qty = Number(p.quantity || 0);
            if (p.rarity === 'legendary' && qty > 0) {
              legendaryCount += qty;
              grandPrizes.push({
                name: `${p.points} P+ 點數獎`,
                remaining: qty,
              });
            }
          });
        }

        const total = Number(pool.totalPacks || 1);
        const remaining = Number(pool.remainingPacks || 0);
        const ratio = total > 0 ? ((remaining / total) * 100).toFixed(1) + '%' : '0%';
        const legendaryProb = remaining > 0 ? ((legendaryCount / remaining) * 100).toFixed(2) + '%' : '0%';

        return {
          id: pool.id,
          name: pool.name || '精選卡池',
          category: pool.category || 'general',
          pricePerDraw: Number(pool.price || 0),
          stats: {
            totalPacks: total,
            remainingPacks: remaining,
            remainingRatio: ratio,
          },
          probabilities: {
            legendaryRemainingCount: legendaryCount,
            legendaryWinRate: legendaryProb,
          },
          grandPrizesInPool: grandPrizes,
          lastPrizeSet: !!pool.lastPrizeCardId,
        };
      });

    // 產生適合推播或機器人直接讀取的繁體中文摘要
    let formattedText = `🎰 【P+Carder 最新在席卡池情報】\n統計時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}\n目前開放卡池數量：${report.length} 個\n─────────────────\n`;

    if (report.length === 0) {
      formattedText += `目前暫無在席卡池，請留意最新上架公告！`;
    } else {
      report.forEach((p: any, idx: number) => {
        formattedText += `${idx + 1}. 【${p.name}】\n`;
        formattedText += `   💰 單抽：${p.pricePerDraw} 鑽\n`;
        formattedText += `   📦 剩餘：${p.stats.remainingPacks} / ${p.stats.totalPacks} 包 (剩餘率 ${p.stats.remainingRatio})\n`;
        formattedText += `   🔥 傳奇大獎爆率：${p.probabilities.legendaryWinRate} (大獎餘量 ${p.probabilities.legendaryRemainingCount} 張)\n`;
        if (p.grandPrizesInPool.length > 0) {
          formattedText += `   🏆 在池大獎：\n`;
          p.grandPrizesInPool.forEach((g: any) => {
            formattedText += `      - ${g.name} (剩餘 ${g.remaining})\n`;
          });
        }
        formattedText += `─────────────────\n`;
      });
    }

    if (format === 'text' || format === 'plain') {
      return new NextResponse(formattedText, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        code: 200,
        timestamp: new Date().toISOString(),
        activePoolsCount: report.length,
        count: report.length,
        data: report,
        pools: report, // 雙重相容 data 與 pools 命名
        textSummary: formattedText,
        message: `成功查詢 ${report.length} 個在席卡池`,
      },
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    );
  } catch (error: any) {
    console.error('Bot API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '查詢失敗',
        activePoolsCount: 0,
        data: [],
        pools: [],
      },
      {
        status: 500,
        headers: CORS_HEADERS,
      }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleFetchPools(req);
}

export async function POST(req: NextRequest) {
  return handleFetchPools(req);
}
