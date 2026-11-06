import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 記憶體快取去背處理後的圖片資料，避免重複運算
const matteCache = new Map<string, { buffer: Buffer; contentType: string }>();

/**
 * 圖片跨域代理與智慧卡片去背 API (Image Proxy & Auto-Matte API)
 * 參數:
 * - url: 遠端圖片原始網址
 * - matte: 若為 1 或 true，自動執行卡片黑底移除、去黑邊與智慧外圍修剪
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get('url');
  const shouldMatte = searchParams.get('matte') === '1' || searchParams.get('matte') === 'true';

  if (!imageUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return new NextResponse('Invalid protocol', { status: 400 });
    }

    const cacheKey = `${imageUrl}_matte_${shouldMatte}`;
    if (matteCache.has(cacheKey)) {
      const cached = matteCache.get(cacheKey)!;
      return new NextResponse(new Uint8Array(cached.buffer), {
        status: 200,
        headers: {
          'Content-Type': cached.contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000',
        },
      });
    }

    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (CardApp-ImageProxy/1.0)',
      },
    });

    if (!response.ok) {
      return new NextResponse(`Failed to fetch image: ${response.status}`, { status: response.status });
    }

    let contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    let finalBuffer = Buffer.from(arrayBuffer);

    // 如果要求去背 (去掉卡片拍照時的黑底、暗色卡套/黑桌布邊界)
    if (shouldMatte) {
      try {
        // 使用 ImageMagick 進行高品質卡片黑底透明化與自動收邊
        // 1. 先將過大圖片縮放到適中解析度 (640px 寬)，大幅提升處理速度
        // 2. -fuzz 38% 容許暗黑至深灰藍的卡夾反光
        // 3. -transparent black 將黑色及深色背景轉為透明
        // 4. -trim 去除周邊透明多餘空白，讓卡片本體大幅放大
        const cmd = 'convert - -resize 640x -fuzz 38% -transparent black -trim png:-';
        
        const child = exec(cmd, {
          encoding: 'buffer',
          maxBuffer: 20 * 1024 * 1024,
        });

        const outputPromise = new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          child.stdout?.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          child.on('error', reject);
          child.on('close', (code) => {
            if (code === 0) {
              resolve(Buffer.concat(chunks));
            } else {
              reject(new Error(`convert exited with code ${code}`));
            }
          });
        });

        if (child.stdin) {
          child.stdin.write(finalBuffer);
          child.stdin.end();
        }

        const mattedBuffer = await outputPromise;
        if (mattedBuffer && mattedBuffer.length > 100) {
          finalBuffer = mattedBuffer;
          contentType = 'image/png';
        }
      } catch (matteErr) {
        console.warn('Image auto-matte fallback to original:', matteErr);
      }
    }

    // 快取結果（最多快取 150 張）
    if (matteCache.size > 150) {
      const firstKey = matteCache.keys().next().value;
      if (firstKey) matteCache.delete(firstKey);
    }
    matteCache.set(cacheKey, { buffer: finalBuffer, contentType });

    return new NextResponse(new Uint8Array(finalBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000',
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

