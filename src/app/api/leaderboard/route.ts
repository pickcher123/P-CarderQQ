import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

interface PublicLeaderboardEntry {
  id: string;
  username: string;
  userLevel: string;
  totalSpent: number;
  photoURL?: string;
}

let cachedData: { ts: number; entries: PublicLeaderboardEntry[] } | null = null;
const CACHE_TTL_MS = 2 * 60 * 1000;

/**
 * 伺服器端公開榮耀排行榜 API（僅回傳安全公開欄位，不暴露 Email／電話／地址，一般會員亦可正常讀取）
 */
export async function GET() {
  try {
    if (cachedData && Date.now() - cachedData.ts < CACHE_TTL_MS) {
      return NextResponse.json({ users: cachedData.entries, cached: true });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ users: [] });
    }

    const snap = await db
      .collection('users')
      .orderBy('totalSpent', 'desc')
      .limit(10)
      .get();

    const entries: PublicLeaderboardEntry[] = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        username: String(d.username || '匿名收藏家'),
        userLevel: String(d.userLevel || '新手收藏家'),
        totalSpent: Number(d.totalSpent) || 0,
        photoURL: typeof d.photoURL === 'string' ? d.photoURL : undefined,
      };
    });

    cachedData = { ts: Date.now(), entries };
    return NextResponse.json({ users: entries });
  } catch (err) {
    console.error('[leaderboard] error:', err);
    return NextResponse.json({ users: [] }, { status: 500 });
  }
}
