'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Search,
  Gift,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  const totalMobileSlides = 4;

  return (
    <section className="py-12 sm:py-20 container px-3 sm:px-4 max-w-6xl mx-auto relative">
      {/* 區塊標題區 */}
      <div className="text-center mb-8 sm:mb-12 space-y-2.5">
        <h2 className="text-2xl sm:text-4xl font-bold font-headline tracking-tight text-white">
          為什麼選擇 <span className="text-amber-300">P+Carder</span>
        </h2>
        <p className="text-xs sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
          公開驗證演算法、實體現貨入庫與多元拆卡機制，打造透明安心的球卡收藏體驗
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 1. 手機版：左右滑動字卡 (統一深邃黑金架構，無巢狀卡片) */}
      {/* ========================================================================= */}
      <div className="block md:hidden relative w-full">
        <Carousel
          setApi={setCarouselApi}
          opts={{ align: 'start', loop: false }}
          className="w-full relative"
        >
          <CarouselContent className="-ml-3">
            {/* 01. 100% 實體現貨在庫 */}
            <CarouselItem className="pl-3 basis-[88%] xs:basis-[84%] flex flex-col">
              <div className="h-full rounded-2xl bg-[#0a0f1c]/95 border border-white/[0.08] border-t-2 border-t-amber-400/60 p-5 flex flex-col justify-between space-y-5">
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white font-headline tracking-tight">
                    100% 實體卡片在庫，嚴謹恆溫保護
                  </h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    堅持「有在庫才上架，絕不先賣後買」。所有卡片均已完成數位建檔，存放於恆溫恆濕防潮保險庫。
                  </p>
                </div>

                <div className="pt-4 border-t border-white/[0.08] space-y-2 text-xs text-slate-200">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span>PSA / BGS 鑑定與單卡現貨先審後上</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span>24 小時防潮封存，防震包裝直寄到府</span>
                  </div>
                </div>
              </div>
            </CarouselItem>

            {/* 02. SHA-256 公平驗證 */}
            <CarouselItem className="pl-3 basis-[88%] xs:basis-[84%] flex flex-col">
              <div className="h-full rounded-2xl bg-[#0a0f1c]/95 border border-white/[0.08] border-t-2 border-t-cyan-400/60 p-5 flex flex-col justify-between space-y-5">
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white font-headline tracking-tight">
                    全公開機率，每一抽皆可獨立驗證
                  </h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    抽取前加密鎖定伺服器種子，結合玩家端隨機種子共同決定結果，開獎後公開原始數據隨時複算。
                  </p>
                </div>

                <div className="pt-4 border-t border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                    <span>1. Server Hash</span>
                    <span className="text-slate-600">→</span>
                    <span className="text-cyan-300">2. Client Seed</span>
                    <span className="text-slate-600">→</span>
                    <span className="text-emerald-300">3. 公開複算</span>
                  </div>

                  <Link
                    href="/fairness"
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-slate-100 text-xs font-medium transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Search className="w-3.5 h-3.5 text-cyan-300" />
                      線上輸入 Hash / Seed 驗證
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </Link>
                </div>
              </div>
            </CarouselItem>

            {/* 03. 多元玩法與靈活資產 */}
            <CarouselItem className="pl-3 basis-[88%] xs:basis-[84%] flex flex-col">
              <div className="h-full rounded-2xl bg-[#0a0f1c]/95 border border-white/[0.08] p-5 flex flex-col justify-between space-y-5">
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white font-headline tracking-tight">
                    多元玩法，卡片去留自由決定
                  </h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    支援主題抽賞、1/10 自選拼卡、命運轉盤、限量福袋與直播團拆，抽中卡片可申請宅配或轉為紅利。
                  </p>
                </div>

                <div className="pt-4 border-t border-white/[0.08] grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-slate-100">自選拼卡 · 轉盤</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">1/10 成本挑戰目標</div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-100">直寄或轉點折抵</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">卡片資產靈活運用</div>
                  </div>
                </div>
              </div>
            </CarouselItem>

            {/* 04. 官方 LINE 社群福利 */}
            <CarouselItem className="pl-3 basis-[88%] xs:basis-[84%] flex flex-col">
              <div className="h-full rounded-2xl bg-[#0a0f1c]/95 border border-white/[0.08] border-t-2 border-t-emerald-400/60 p-5 flex flex-col justify-between space-y-5">
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white font-headline tracking-tight">
                    加入官方 LINE 社群領免費抽卡券
                  </h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    第一時間掌握大獎出卡快報、專屬活動碼與卡展資訊，首次加入社群即可領取免費抽卡券 1 張。
                  </p>
                </div>

                {onCommunityJoin && (
                  <Button
                    type="button"
                    onClick={onCommunityJoin}
                    disabled={isClaimingCommunity}
                    className={cn(
                      'w-full h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer',
                      isCommunityClaimed
                        ? 'bg-white/[0.06] hover:bg-white/[0.1] text-slate-100 border border-white/[0.1]'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    )}
                  >
                    <Gift className={cn('w-3.5 h-3.5', isCommunityClaimed ? 'text-emerald-400' : 'text-slate-950')} />
                    <span>
                      {isClaimingCommunity
                        ? '領取中...'
                        : isCommunityClaimed
                          ? '已領取 · 前往社群交流'
                          : '加入社群領免費抽卡券'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </CarouselItem>
          </CarouselContent>

          {/* 手機版滑動指示圓點 */}
          <div className="flex justify-center items-center gap-1.5 mt-4">
            {Array.from({ length: totalMobileSlides }).map((_, dotIdx) => (
              <button
                key={dotIdx}
                type="button"
                onClick={() => carouselApi?.scrollTo(dotIdx)}
                aria-label={`切換至特點 ${dotIdx + 1}`}
                className={cn(
                  'h-1.5 transition-all duration-300 rounded-full',
                  currentSlide === dotIdx
                    ? 'w-6 bg-amber-300'
                    : 'w-1.5 bg-slate-700/80 hover:bg-slate-600'
                )}
              />
            ))}
          </div>
        </Carousel>
      </div>

      {/* ========================================================================= */}
      {/* 2. 桌面與平板版 (md 以上)：統一暗黑建築感版面（無巢狀卡片與重複編號標籤） */}
      {/* ========================================================================= */}
      <div className="hidden md:grid md:grid-cols-12 gap-5">
        {/* 左上：100% 實體現貨在庫 (7 欄) */}
        <div className="md:col-span-7 rounded-2xl bg-[#0a0f1c]/90 border border-white/[0.08] border-t-2 border-t-amber-400/55 p-7 lg:p-8 flex flex-col justify-between gap-7">
          <div className="space-y-3">
            <h3 className="text-xl lg:text-2xl font-bold text-white font-headline tracking-tight">
              100% 實體卡片在庫，嚴謹恆溫保護
            </h3>
            <p className="text-slate-300/80 text-sm leading-relaxed max-w-xl">
              堅持「有在庫才上架，絕不先賣後買」。所有鑑定卡與單卡皆已實體入庫並完成數位建檔，存放於恆溫恆濕防潮保險庫，確保每張卡片維持最佳狀態。
            </p>
          </div>

          <div className="pt-5 border-t border-white/[0.08] grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>PSA / BGS 實體在席</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                現貨先審後上，開出即存入個人收藏庫
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>24 小時防潮封存</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                專業恆溫倉儲控管，遠離潮濕與氧化風險
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>高規格防震寄送</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                申請出貨採用防潮卡膜、卡磚與防震包裝
              </p>
            </div>
          </div>
        </div>

        {/* 右上：SHA-256 公平驗證 (5 欄) */}
        <div className="md:col-span-5 rounded-2xl bg-[#0a0f1c]/90 border border-white/[0.08] border-t-2 border-t-cyan-400/55 p-7 lg:p-8 flex flex-col justify-between gap-7">
          <div className="space-y-3">
            <h3 className="text-xl lg:text-2xl font-bold text-white font-headline tracking-tight">
              全公開機率，每一抽皆可獨立驗證
            </h3>
            <p className="text-slate-300/80 text-sm leading-relaxed">
              每次抽取前預先加密鎖定伺服器種子，結合玩家端隨機種子共同決定結果；開獎後完整公開原始數據，隨時可線上複算核驗。
            </p>
          </div>

          <div className="pt-5 border-t border-white/[0.08] space-y-4">
            <div className="grid grid-cols-3 gap-2 text-left">
              <div>
                <div className="text-[11px] font-mono text-slate-500">01 · Server Hash</div>
                <div className="text-xs font-semibold text-slate-100 mt-0.5">抽前預鎖</div>
              </div>
              <div>
                <div className="text-[11px] font-mono text-cyan-400/90">02 · Client Seed</div>
                <div className="text-xs font-semibold text-cyan-200 mt-0.5">共同隨機</div>
              </div>
              <div>
                <div className="text-[11px] font-mono text-emerald-400/90">03 · Verified</div>
                <div className="text-xs font-semibold text-emerald-200 mt-0.5">100% 公開複算</div>
              </div>
            </div>

            <Link
              href="/fairness"
              className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] hover:border-cyan-400/40 text-slate-200 hover:text-white transition-colors text-xs font-medium"
            >
              <span className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-cyan-300" />
                線上輸入 Hash / Seed 即時驗證開獎結果
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </Link>
          </div>
        </div>

        {/* 左下：多元玩法與靈活資產 (7 欄) */}
        <div className="md:col-span-7 rounded-2xl bg-[#0a0f1c]/90 border border-white/[0.08] p-7 lg:p-8 flex flex-col justify-between gap-7">
          <div className="space-y-3">
            <h3 className="text-xl lg:text-2xl font-bold text-white font-headline tracking-tight">
              多元玩法，卡片去留自由決定
            </h3>
            <p className="text-slate-300/80 text-sm leading-relaxed max-w-xl">
              支援主題抽賞、1/10 自選拼卡、命運轉盤、限量福袋與直播團拆，抽中卡片可申請宅配到府或即時轉換為紅利點數。
            </p>
          </div>

          <div className="pt-5 border-t border-white/[0.08] grid grid-cols-3 divide-x divide-white/[0.08]">
            <div className="pr-4 space-y-1">
              <div className="text-xs font-semibold text-white">自選拼卡 · 轉盤</div>
              <div className="text-xs text-slate-400">1/10 成本挑戰目標神卡</div>
            </div>
            <div className="px-4 space-y-1">
              <div className="text-xs font-semibold text-white">限量福袋 · 團拆</div>
              <div className="text-xs text-slate-400">保底配置公開透明拆盒</div>
            </div>
            <div className="pl-4 space-y-1">
              <div className="text-xs font-semibold text-white">直寄或轉點折抵</div>
              <div className="text-xs text-slate-400">卡片資產彈性自由運用</div>
            </div>
          </div>
        </div>

        {/* 右下：官方 LINE 社群福利 (5 欄) */}
        <div className="md:col-span-5 rounded-2xl bg-[#0a0f1c]/90 border border-white/[0.08] border-t-2 border-t-emerald-400/55 p-7 lg:p-8 flex flex-col justify-between gap-7">
          <div className="space-y-3">
            <h3 className="text-xl lg:text-2xl font-bold text-white font-headline tracking-tight">
              加入官方 LINE 社群領免費抽卡券
            </h3>
            <p className="text-slate-300/80 text-sm leading-relaxed">
              第一時間掌握大獎出卡快報、不定期專屬活動碼與卡展資訊，首次加入社群即可領取免費抽卡券 1 張。
            </p>
          </div>

          {onCommunityJoin && (
            <Button
              type="button"
              onClick={onCommunityJoin}
              disabled={isClaimingCommunity}
              className={cn(
                'w-full h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer',
                isCommunityClaimed
                  ? 'bg-white/[0.05] hover:bg-white/[0.09] text-slate-100 border border-white/[0.1]'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              )}
            >
              <Gift className={cn('w-4 h-4', isCommunityClaimed ? 'text-emerald-400' : 'text-slate-950')} />
              <span>
                {isClaimingCommunity
                  ? '領取中...'
                  : isCommunityClaimed
                    ? '已領取 · 前往社群交流'
                    : '加入社群領免費抽卡券'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
