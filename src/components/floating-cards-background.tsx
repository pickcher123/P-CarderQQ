'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, limit } from 'firebase/firestore';

import { PLACEHOLDER_CARD_IMAGES } from '@/lib/placeholders';

const FALLBACK_IMAGES = PLACEHOLDER_CARD_IMAGES;

interface CardData {
    id: string;
    imageUrl: string;
}

export function FloatingCardsBackground() {
  const firestore = useFirestore();
  const cardsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'allCards'), limit(50));
  }, [firestore]);

  const { data: dbCards } = useCollection<CardData>(cardsQuery);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  useEffect(() => {
    // 觸控裝置跳過 mousemove 監聽以節省 CPU
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      mouseX.set((clientX / innerWidth) - 0.5);
      mouseY.set((clientY / innerHeight) - 0.5);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  // Create random positions and types for cards
  const cards = useMemo(() => {
    const images = (dbCards && dbCards.length > 0) 
      ? dbCards.map(c => c.imageUrl) 
      : FALLBACK_IMAGES;

    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
    const count = isMobile ? 4 : 7;
    
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      image: images[i % images.length],
      x: Math.random() * 90 + 5,
      y: Math.random() * 85 + 5,
      rotate: Math.random() * 50 - 25,
      scale: 0.35 + Math.random() * 0.45,
      delay: Math.random() * 4,
      duration: 16 + Math.random() * 10,
      floatRange: 25 + Math.random() * 35,
      depth: 0.6 + Math.random() * 1.6,
      opacity: 0.16 + Math.random() * 0.14,
    }));
  }, [dbCards]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none" style={{ perspective: '1000px' }}>
      {/* Background Gradients for subtle depth without obscuring bottom floor details */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent z-[1]" />
      
      {/* Floating Cards Container */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {cards.map((card) => (
          <FloatingCard 
            key={card.id} 
            card={card} 
            springX={springX} 
            springY={springY} 
          />
        ))}
      </div>

      {/* Decorative large circles for depth */}
      <div className="absolute top-1/4 -left-20 w-[450px] h-[450px] bg-primary/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[80px] pointer-events-none" />

      {/* Subtle bottom soft blend that doesn't abruptly cut the floor platform */}
      <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-slate-950/60 via-slate-950/20 to-transparent pointer-events-none z-[2]" />
    </div>
  );
}

function FloatingCard({ card, springX, springY }: { card: any, springX: any, springY: any }) {
  const moveX = useTransform(springX, (v: number) => v * 120 * card.depth);
  const moveY = useTransform(springY, (v: number) => v * 120 * card.depth);

  return (
    <motion.div
      className="absolute rounded-xl overflow-hidden border border-white/20 shadow-xl"
      style={{
        left: `${card.x}%`,
        top: `${card.y}%`,
        width: `${175 * card.scale}px`,
        aspectRatio: '2/3',
        opacity: card.opacity,
        x: moveX,
        y: moveY,
        willChange: 'transform',
      }}
      initial={{ opacity: 0, scale: card.scale, rotate: card.rotate }}
      animate={{
        opacity: [card.opacity, card.opacity * 1.4, card.opacity],
        rotate: [card.rotate - 6, card.rotate + 6, card.rotate - 6],
        translateY: [-card.floatRange, card.floatRange, -card.floatRange],
      }}
      transition={{
        opacity: { duration: 6, repeat: Infinity, ease: "linear" },
        rotate: { duration: card.duration, repeat: Infinity, ease: "easeInOut" },
        translateY: { duration: card.duration, repeat: Infinity, ease: "easeInOut", delay: card.delay },
      }}
    >
      <Image
        src={card.image}
        alt=""
        fill
        className="object-cover h-full w-full brightness-110 contrast-105"
        sizes="160px"
        referrerPolicy="no-referrer"
      />
    </motion.div>
  );
}
