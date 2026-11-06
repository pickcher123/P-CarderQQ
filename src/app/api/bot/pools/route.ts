import { NextResponse } from 'next/server';
import firebaseConfigData from '@/../firebase-applet-config.json';

export const dynamic = 'force-dynamic';

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

/**
 * @fileOverview 機器人專用 API 端點：即時查詢在線開放卡池
 * 支援 GET 請求，自動計算剩餘包數、大獎剩餘、傳奇命中率
 */
export async function GET() {
  try {
    const projectId = firebaseConfigData?.projectId || 'studio-8439816843-ca6d5';
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

    // 1. 同步取得 cardPools 與 allCards
    const [poolsRes, cardsRes] = await Promise.all([
      fetch(`${baseUrl}/cardPools?pageSize=100`, { cache: 'no-store' }),
      fetch(`${baseUrl}/allCards?pageSize=500`, { cache: 'no-store' }),
    ]);

    const poolsJson = await poolsRes.json();
    const cardsJson = await cardsRes.json();

    const allCardsMap = new Map<string, any>();
    if (cardsJson.documents) {
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
        // 剩餘包數檢查
        if ((pool.remainingPacks ?? 0) <= 0) return false;
        // 時間限制檢查
        const isStarted = !pool.startsAt || (pool.startsAt.seconds <= nowSeconds);
        const isNotExpired = !pool.expiresAt || (pool.expiresAt.seconds > nowSeconds);
        return isStarted && isNotExpired;
      })
      .map((pool: any) => {
        let legendaryCount = 0;
        const grandPrizes: any[] = [];

        // 計算卡片類大獎
        if (pool.cards && pool.cardRarities) {
          pool.cards.forEach((c: any) => {
            const rarity = pool.cardRarities[c.cardId];
            const cardData = allCardsMap.get(c.cardId);
            if (rarity === 'legendary' && c.quantity > 0 && !cardData?.isSold) {
              legendaryCount += c.quantity;
              grandPrizes.push({
                name: cardData?.name || '未知卡片',
                remaining: c.quantity,
              });
            }
          });
        }

        // 計算點數類大獎
        if (pool.pointPrizes) {
          pool.pointPrizes.forEach((p: any) => {
            if (p.rarity === 'legendary' && p.quantity > 0) {
              legendaryCount += p.quantity;
              grandPrizes.push({
                name: `${p.points} P+ 點數獎`,
                remaining: p.quantity,
              });
            }
          });
        }

        const total = pool.totalPacks || 1;
        const remaining = pool.remainingPacks || 0;
        const ratio = ((remaining / total) * 100).toFixed(1) + '%';
        const legendaryProb = remaining > 0 ? ((legendaryCount / remaining) * 100).toFixed(2) + '%' : '0%';

        return {
          id: pool.id,
          name: pool.name,
          category: pool.category || 'general',
          pricePerDraw: pool.price || 0,
          stats: {
            totalPacks: total,
            remainingPacks: remaining,
            remainingRatio: ratio,
          },
          probabilities: {
            legendaryWinRate: legendaryProb,
          },
          grandPrizesInPool: grandPrizes,
          lastPrizeSet: !!pool.lastPrizeCardId,
        };
      });

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        activePoolsCount: report.length,
        data: report,
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('Bot API Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
