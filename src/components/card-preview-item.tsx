'use client';

import { SafeImage } from '@/components/safe-image';

type CardPreviewItemProps = {
  name: string;
  imageUrl: string;
  priority?: boolean;
};

export function CardPreviewItem({ name, imageUrl, priority = false }: CardPreviewItemProps) {
  return (
    <div className="group w-full aspect-[2.5/3.5] relative rounded-md overflow-hidden border bg-card">
        <SafeImage
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 768px) 30vw, (max-width: 1200px) 15vw, 10vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            priority={priority}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}
