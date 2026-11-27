import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import dns from 'dns/promises';
import net from 'net';

// 記憶體快取去背處理後的圖片資料，避免重複運算
const matteCache = new Map<string, { buffer: Buffer; contentType: string }>();
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB 上限，防 OOM DoS

function isPrivateOrReservedIp(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();
  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map(Number);
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // Link-local / Cloud Metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // Multicast / Reserved
    return false;
  }
  if (net.isIPv6(normalized)) {
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('::ffff:')) {
      return isPrivateOrReservedIp(normalized.slice(7));
    }
    return false;
  }
  return true;
}

async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('INVALID_PROTOCOL');
  }
  if (parsed.username || parsed.password) {
    throw new Error('CREDENTIALS_NOT_ALLOWED');
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    throw new Error('BLOCKED_HOST');
  }

  // 若直接輸入 IP，檢查是否為私網或保留位址
  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) throw new Error('BLOCKED_IP');
    return parsed;
  }

  // 解析所有 DNS 紀錄，防範 DNS 指向內網 / Cloud Metadata (SSRF)
  const records = await dns.lookup(host, { all: true });
  if (!records.length) throw new Error('DNS_FAILED');
  for (const rec of records) {
    if (isPrivateOrReservedIp(rec.address)) {
      throw new Error('BLOCKED_RESOLVED_IP');
    }
  }
  return parsed;
}

/**
 * 圖片跨域代理與智慧卡片去背 API (Image Proxy & Auto-Matte API)
 * 已內建 SSRF 防護（阻擋內網/Metadata IP、重導向檢查、圖片 Content-Type 與 10MB 大小限制）
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get('url');
  const shouldMatte = searchParams.get('matte') === '1' || searchParams.get('matte') === 'true';

  if (!imageUrl || imageUrl.length > 2048) {
    return new NextResponse('Missing or invalid url parameter', { status: 400 });
  }

  try {
    const safeUrl = await assertSafePublicUrl(imageUrl);

    const cacheKey = `${safeUrl.toString()}_matte_${shouldMatte}`;
    if (matteCache.has(cacheKey)) {
      const cached = matteCache.get(cacheKey)!;
      return new NextResponse(new Uint8Array(cached.buffer), {
        status: 200,
        headers: {
          'Content-Type': cached.contentType,
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000',
        },
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    try {
      response = await fetch(safeUrl.toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0 (CardApp-ImageProxy/1.0)' },
        redirect: 'manual',
        signal: controller.signal,
      });

      // 若遇到 3xx 重導向，重新驗證目標 URL 是否仍為公開安全位址（最多追蹤 1 次）
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) return new NextResponse('Blocked redirect', { status: 400 });
        const redirectedUrl = new URL(location, safeUrl).toString();
        const safeRedirect = await assertSafePublicUrl(redirectedUrl);
        response = await fetch(safeRedirect.toString(), {
          headers: { 'User-Agent': 'Mozilla/5.0 (CardApp-ImageProxy/1.0)' },
          redirect: 'error',
          signal: controller.signal,
        });
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return new NextResponse(`Failed to fetch image: ${response.status}`, { status: response.status });
    }

    const rawContentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!rawContentType.startsWith('image/')) {
      return new NextResponse('Target resource is not an image', { status: 415 });
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_IMAGE_BYTES) {
      return new NextResponse('Image exceeds maximum allowed size', { status: 413 });
    }

    let contentType = rawContentType.split(';')[0].trim() || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      return new NextResponse('Image exceeds maximum allowed size', { status: 413 });
    }
    let finalBuffer: Buffer = Buffer.from(arrayBuffer);

    // 如果要求去背 (去掉卡片拍照時的黑底、暗色卡套/黑桌布邊界)
    if (shouldMatte) {
      try {
        const cmd = 'convert - -resize 640x -fuzz 38% -transparent black -trim png:-';
        const child = exec(cmd, {
          encoding: 'buffer',
          maxBuffer: 15 * 1024 * 1024,
          timeout: 15000,
        });

        const outputPromise = new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          child.stdout?.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          child.on('error', reject);
          child.on('close', (code) => {
            if (code === 0) resolve(Buffer.concat(chunks));
            else reject(new Error(`convert exited with code ${code}`));
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

    // 快取結果（最多快取 120 張）
    if (matteCache.size >= 120) {
      const firstKey = matteCache.keys().next().value;
      if (firstKey) matteCache.delete(firstKey);
    }
    matteCache.set(cacheKey, { buffer: finalBuffer, contentType });

    return new NextResponse(new Uint8Array(finalBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000',
      },
    });
  } catch (error: any) {
    const code = String(error?.message || '');
    if (['INVALID_PROTOCOL', 'CREDENTIALS_NOT_ALLOWED', 'BLOCKED_HOST', 'BLOCKED_IP', 'BLOCKED_RESOLVED_IP'].includes(code)) {
      return new NextResponse('Forbidden target URL', { status: 403 });
    }
    console.error('Image proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
