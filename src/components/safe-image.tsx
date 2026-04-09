'use client';

import { useState, useEffect } from 'react';
import Image, { ImageProps } from 'next/image';
import { cn } from '@/lib/utils';

interface SafeImageProps extends ImageProps {
  fallbackSrc?: string;
}

export function SafeImage({ src, fallbackSrc = 'https://picsum.photos/seed/pcarder/800/1200', alt, className, ...props }: SafeImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [error, setError] = useState(false);

  useEffect(() => {
    setImgSrc(src);
    setError(false);
  }, [src]);

  return (
    <Image
      {...props}
      src={error ? fallbackSrc : imgSrc}
      alt={alt}
      className={cn(className)}
      onError={() => {
        if (!error) {
          setError(true);
        }
      }}
    />
  );
}
