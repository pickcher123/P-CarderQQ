import { NextRequest, NextResponse } from 'next/server';

export interface SevenElevenStoreResult {
  storeId: string;
  storeName: string;
  rawName: string;
  address: string;
  tel: string;
}

const EMAP_ENDPOINT = 'https://emap.pcsc.com.tw/EMapSDK.aspx';

// 10 分鐘記憶體快取，避免重複打 7-11 官方伺服器
const storeCache = new Map<string, { ts: number; stores: SevenElevenStoreResult[] }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

function parseGeoPositions(xml: string): SevenElevenStoreResult[] {
  const blocks = xml.match(/<GeoPosition>[\s\S]*?<\/GeoPosition>/gi) || [];
  const results: SevenElevenStoreResult[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const storeId = extractTag(block, 'POIID').replace(/\s+/g, '');
    const rawName = extractTag(block, 'POIName');
    const address = extractTag(block, 'Address');
    const tel = extractTag(block, 'Telno').replace(/\s+/g, '');

    if (!storeId || !rawName || seen.has(storeId)) continue;
    seen.add(storeId);

    const storeName = rawName.endsWith('門市') ? rawName : `${rawName}門市`;
    results.push({
      storeId,
      storeName,
      rawName,
      address,
      tel,
    });
  }

  return results;
}

async function queryEmap(params: Record<string, string>): Promise<SevenElevenStoreResult[]> {
  const body = new URLSearchParams({
    commandid: 'SearchStore',
    city: '',
    town: '',
    roadname: '',
    ID: '',
    StoreName: '',
    SpecialStore_Kind: '',
    leftMenuChecked: '',
    address: '',
    ...params,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(EMAP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (compatible; PCarderLogistics/1.0)',
      },
      body: body.toString(),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`7-11 eMap HTTP ${res.status}`);
    }

    const xml = await res.text();
    return parseGeoPositions(xml);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeQuery(raw: string): { isStoreId: boolean; cleaned: string } {
  const trimmed = raw.trim();
  const sixDigits = trimmed.match(/^\d{6}$/);
  if (sixDigits) {
    return { isStoreId: true, cleaned: sixDigits[0] };
  }

  const cleaned = trimmed
    .replace(/7-?11/gi, '')
    .replace(/7-?eleven/gi, '')
    .replace(/統一超商/g, '')
    .replace(/\(?\s*店號[:：\s]*\d{6}\s*\)?/g, '')
    .replace(/門市$/g, '')
    .replace(/店$/g, '')
    .trim();

  return { isStoreId: false, cleaned };
}

export async function GET(req: NextRequest) {
  const rawQuery = req.nextUrl.searchParams.get('q') || '';
  if (!rawQuery.trim()) {
    return NextResponse.json({ stores: [] });
  }

  const { isStoreId, cleaned } = normalizeQuery(rawQuery);
  if (!cleaned) {
    return NextResponse.json({ stores: [] });
  }

  const cacheKey = `${isStoreId ? 'id' : 'name'}:${cleaned}`;
  const cached = storeCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json({ stores: cached.stores, cached: true });
  }

  try {
    let stores: SevenElevenStoreResult[] = [];

    if (isStoreId) {
      stores = await queryEmap({ ID: cleaned });
    } else {
      stores = await queryEmap({ StoreName: cleaned });
      // 若用門市名稱查無結果，改以地址關鍵字補查一次
      if (stores.length === 0 && cleaned.length >= 2) {
        stores = await queryEmap({ address: cleaned });
      }
      // 精準完全相符的門市排最前面
      stores.sort((a, b) => {
        const aExact = a.rawName === cleaned ? 0 : 1;
        const bExact = b.rawName === cleaned ? 0 : 1;
        return aExact - bExact;
      });
    }

    const limited = stores.slice(0, 12);
    storeCache.set(cacheKey, { ts: Date.now(), stores: limited });

    return NextResponse.json({ stores: limited });
  } catch (err) {
    console.error('[711-store] lookup failed:', err);
    return NextResponse.json(
      { stores: [], error: '暫時無法連線至 7-11 門市資料庫，請稍後再試或改用官方電子地圖查詢。' },
      { status: 502 }
    );
  }
}
