
'use client';

import * as React from "react";
import { SafeImage } from "@/components/safe-image";
import Link from "next/link";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import Autoplay from "embla-carousel-autoplay";

interface Advertisement {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  isActive: boolean;
  order: number;
}

export function AdCarousel() {
  const firestore = useFirestore();
  const plugin = React.useRef(
    Autoplay({ delay: 4000, stopOnInteraction: true })
  );

  const adsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "advertisements"),
      where("isActive", "==", true),
      orderBy("order", "asc")
    );
  }, [firestore]);

  const { data: ads, isLoading } = useCollection<Advertisement>(adsQuery);

  if (isLoading) {
    return (
      <div className="container px-4">
        <Skeleton className="aspect-[21/9] w-full rounded-[2.5rem] bg-white/5" />
      </div>
    );
  }

  if (!ads || ads.length === 0) {
    return null;
  }

  return (
    <div className="container px-4 animate-fade-in-up">
      <Carousel
        plugins={[plugin.current]}
        className="w-full relative group"
        onMouseEnter={plugin.current.stop}
        onMouseLeave={plugin.current.reset}
      >
        <CarouselContent>
          {ads.map((ad) => (
            <CarouselItem key={ad.id}>
              <div className="relative aspect-[21/9] w-full overflow-hidden rounded-[1.5rem] md:rounded-[2.5rem] border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
                {ad.linkUrl ? (
                  <Link href={ad.linkUrl} className="block w-full h-full">
                    <SafeImage
                      src={ad.imageUrl}
                      alt={ad.title}
                      fill
                      className="object-cover transition-transform duration-700 hover:scale-105"
                      priority
                    />
                  </Link>
                ) : (
                  <SafeImage
                    src={ad.imageUrl}
                    alt={ad.title}
                    fill
                    className="object-cover"
                    priority
                  />
                )}
                {/* Overlay Text */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-4 left-6 md:bottom-8 md:left-12 max-w-[80%]">
                  <h3 className="font-headline text-lg md:text-3xl font-black text-white drop-shadow-2xl italic tracking-tighter">
                    {ad.title}
                  </h3>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {ads.length > 1 && (
          <>
            <CarouselPrevious className="left-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 border-white/10 text-white hover:bg-primary hover:border-primary" />
            <CarouselNext className="right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 border-white/10 text-white hover:bg-primary hover:border-primary" />
          </>
        )}
      </Carousel>
    </div>
  );
}
