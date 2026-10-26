'use client';

import { SafeImage } from '@/components/safe-image';

type CardPreviewItemProps = {
  name: string;
  imageUrl: string;
  priority?: boolean;
};

export function CardPreviewItem({ name, imageUrl, priority = false }: CardPreviewItemProps) {
  return (
    <div className="group w-full aspect-[2.5/3.5] relative rounded-lg overflow-hidden border border-white/20 bg-gradient-to-b from-slate-750/70 via-slate-800/50 to-slate-900/70 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)]">
        {/* 典藏透光底板層 */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(245,158,11,0.12),transparent_70%)] pointer-events-none" />
        <SafeImage
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 768px) 30vw, (max-width: 1200px) 15vw, 10vw"
            className="object-contain p-1 transition-transform duration-300 group-hover:scale-105 relative z-10 drop-shadow-[0_4px_10px_rgba(0,0,0,0.3)]"
            priority={priority}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white/5 via-transparent to-transparent pointer-events-none z-10" />
    </div>
  );
}
