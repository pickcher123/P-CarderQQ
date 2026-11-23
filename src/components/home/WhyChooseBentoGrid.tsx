'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Gift, ShieldCheck } from 'lucide-react';
import { SafeImage } from '@/components/safe-image';
import { cn } from '@/lib/utils';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';

interface WhyChooseBentoGridProps {
  onCommunityJoin?: () => void;
  isCommunityClaimed?: boolean;
  isClaimingCommunity?: boolean;
}

interface PillarCardItem {
  num: string;
  tag: string;
  title: string;
  subtitle: string;
  image: string;
  href?: string;
  actionLabel?: string;
  isCommunity?: boolean;
}

const PILLAR_ITEMS: PillarCardItem[] = [
  {
    num: '01',
    tag: 'IN-STOCK VAULT',
    title: '100% 實體現貨在庫',
    subtitle: '恆溫防潮保險庫建檔封存，絕不先賣後買',
    image: '/images/why-choose/vault-stock.jpg',
    href: '/draw',
    actionLabel: '逛逛現貨卡池',
  },
  {
    num: '02',
    tag: 'PROVABLY FAIR',
    title: '全公開機率獨立驗證',
    subtitle: '後端加密抽獎＋雜湊種子，每一抽皆可複算',
    image: '/images/why-choose/provably-fair.jpg',
    href: '/fairness',
    actionLabel: '線上公平驗證',
  },
  {
    num: '03',
    tag: 'FLEXIBLE PLAY',
    title: '多元玩法・自由買回',
    subtitle: '一番賞、拼卡、福袋直寄到府或一鍵換點',
    image: '/images/why-choose/flexible-play.jpg',
    href: '/bet',
    actionLabel: '探索多元玩法',
  },
  {
    num: '04',
    tag: 'VIP REWARDS',
    title: '官方社群專屬福利',
    subtitle: '即時出卡快報與活動碼，加入免費領抽卡券',
    image: '/images/why-choose/vip-community.jpg',
    isCommunity: true,
  },
];

export function WhyChooseBentoGrid({
  onCommunityJoin,
  isCommunityClaimed = false,
  isClaimingCommunity = false,
}: WhyChooseBentoGridProps) {
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = React.useState(0);

  React.useEffect(() => {
    if (!carouselApi) return;
    setCurrentSlide(carouselApi.selectedScrollSnap());
    const onSelect = () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    };
    carouselApi.on('select', onSelect);
    return () => {
      carouselApi.off('select', onSelect);
    };
  }, [carouselApi]);

  const renderCard = (item: PillarCardItem) => {
    const inner = (
      <div className="group h-full rounded-2xl bg-[#0a0f1c] border border-white/[0.08] hover:border-amber-300/45 overflow-hidden flex flex-col transition-[border-color,transform] duration-200 shadow-[0_16px_40px_rgba(0,0,0,0.55)]">
        {/* 頂部香檳金極細微光線 */}
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-amber-300/45 to-transparent" />

        {/* 主視覺圖像區（4:3 統一暗黑曜石 × 香檳金系列） */}
        <div className="relative w-full aspect-[4/3] overflow-hidden bg-[#0a0f1c]">
          <SafeImage
            src={item.image}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 82vw, (max-width: 1024px) 48vw, 25vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
          {/* 底部平滑融色漸層 */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0a0f1c] via-[#0a0f1c]/55 to-transparent pointer-events-none" />
          {/* 左上角極簡編號角標 */}
          <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-[#0a0f1c]/80 backdrop-blur-md border border-amber-300/30 text-[10px] font-mono font-bold text-[#FDE68A] tracking-widest tabular-nums">
            {item.num}
          </div>
        </div>

        {/* 極簡文字與行動列 */}
        <div className="px-4 pb-4 pt-1 flex-1 flex flex-col justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-[15px] sm:text-base font-black text-white tracking-tight leading-snug group-hover:text-[#FDE68A] transition-colors">
              {item.title}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
              {item.subtitle}
            </p>
          </div>

          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs font-bold">
            {item.isCommunity ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5',
                  isCommunityClaimed ? 'text-emerald-300' : 'text-[#FDE68A]'
                )}
              >
                <Gift className="w-3.5 h-3.5" />
                <span>
                  {isClaimingCommunity
                    ? '處理中...'
                    : isCommunityClaimed
                    ? '已領取・前往社群'
                    : '加入免費領抽卡券'}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[#FDE68A]/90 group-hover:text-[#FDE68A] transition-colors">
                {item.num === '02' && <ShieldCheck className="w-3.5 h-3.5 text-cyan-300" />}
                <span>{item.actionLabel}</span>
              </span>
            )}
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#FDE68A] group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>
      </div>
    );

    if (item.isCommunity && onCommunityJoin) {
      return (
        <button
          key={item.num}
          type="button"
          onClick={onCommunityJoin}
          disabled={isClaimingCommunity}
          className="block w-full h-full text-left cursor-pointer outline-none"
        >
          {inner}
        </button>
      );
    }

    if (item.href) {
      return (
        <Link key={item.num} href={item.href} className="block w-full h-full outline-none">
          {inner}
        </Link>
      );
    }

    return <div key={item.num} className="w-full h-full">{inner}</div>;
  };

  return (
    <section className="py-10 sm:py-16 container px-3 sm:px-4 max-w-6xl mx-auto relative">
      {/* 精簡區塊標題 */}
      <div className="text-center mb-7 sm:mb-10 space-y-2">
        <h2 className="text-2xl sm:text-3xl font-black font-headline tracking-tight text-white">
          為什麼選擇 <span className="text-[#FDE68A]">P+Carder</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
          實體在庫・公開驗證・自由買回，給藏家最純粹透明的開卡體驗
        </p>
      </div>

      {/* 手機版：流暢橫向滑動圖卡 */}
      <div className="block md:hidden relative w-full">
        <Carousel
          setApi={setCarouselApi}
          opts={{ align: 'start', loop: false }}
          className="w-full relative"
        >
          <CarouselContent className="-ml-3">
            {PILLAR_ITEMS.map((item) => (
              <CarouselItem key={item.num} className="pl-3 basis-[82%] xs:basis-[76%]">
                {renderCard(item)}
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* 分頁圓點指示 */}
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {PILLAR_ITEMS.map((item, idx) => (
            <button
              key={item.num}
              type="button"
              onClick={() => carouselApi?.scrollTo(idx)}
              aria-label={`切換至第 ${idx + 1} 項`}
              className={cn(
                'h-1.5 rounded-full transition-all duration-200',
                currentSlide === idx ? 'w-5 bg-[#FDE68A]' : 'w-1.5 bg-white/20'
              )}
            />
          ))}
        </div>
      </div>

      {/* 桌面版：四欄統一視覺畫廊 */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {PILLAR_ITEMS.map((item) => renderCard(item))}
      </div>
    </section>
  );
}
