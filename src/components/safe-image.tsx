'use client';

import { useState, useEffect } from 'react';
import Image, { ImageProps } from 'next/image';
import { cn } from '@/lib/utils';
import { PLACEHOLDER_CARD_IMAGE } from '@/lib/placeholders';

interface SafeImageProps extends Omit<ImageProps, 'src'> {
  src?: any;
  fallbackSrc?: string;
}

function isValidSrc(source: unknown): boolean {
  if (!source) return false;
  if (typeof source === 'string') {
    return source.trim().length > 0;
  }
  if (typeof source === 'object' && 'src' in (source as Record<string, unknown>)) {
    const s = (source as Record<string, unknown>).src;
    return typeof s === 'string' && s.trim().length > 0;
  }
  return false;
}

function getGuaranteedFallback(fallback?: string): string {
  if (typeof fallback === 'string' && fallback.trim().length > 0) {
    return fallback.trim();
  }
  return PLACEHOLDER_CARD_IMAGE;
}

export function SafeImage({
  src,
  fallbackSrc = PLACEHOLDER_CARD_IMAGE,
  alt,
  className,
  priority = false,
  onError,
  ...props
}: SafeImageProps) {
  const safeFallback = getGuaranteedFallback(fallbackSrc);
  const initialValid = isValidSrc(src);
  const initialSrc = initialValid ? (typeof src === 'string' ? src.trim() : src) : safeFallback;

  const [imgSrc, setImgSrc] = useState(initialSrc);
  const [hasError, setHasError] = useState(!initialValid);

  useEffect(() => {
    if (isValidSrc(src)) {
      setImgSrc(typeof src === 'string' ? src.trim() : src);
      setHasError(false);
    } else {
      setImgSrc(safeFallback);
      setHasError(true);
    }
  }, [src, safeFallback]);

  const effectiveSrc = hasError || !isValidSrc(imgSrc) ? safeFallback : imgSrc;

  // Next.js triggers ReactDOM.preload for priority images.
  // Preload should only be active for actual web URLs or local paths, never for data URIs or empty strings.
  const isPreloadable = typeof effectiveSrc === 'string'
    ? (effectiveSrc.startsWith('http://') || effectiveSrc.startsWith('https://') || effectiveSrc.startsWith('/'))
    : Boolean(typeof effectiveSrc === 'object' && (effectiveSrc as Record<string, unknown>)?.src);

  const safePriority = Boolean(priority && isPreloadable);

  return (
    <Image
      {...props}
      src={effectiveSrc}
      alt={alt || 'Image'}
      className={cn(className)}
      priority={safePriority}
      onError={(e) => {
        if (!hasError) {
          setHasError(true);
          setImgSrc(safeFallback);
        }
        onError?.(e);
      }}
    />
  );
}
