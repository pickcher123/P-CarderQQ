'use client';

import { SafeImage } from '@/components/safe-image';
import { cn } from '@/lib/utils';

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
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-2">
            <p className="text-xs font-bold text-white truncate drop-shadow-md">{name}</p>
        </div>
    </div>
  );
}
