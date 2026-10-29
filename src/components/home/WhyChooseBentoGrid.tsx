'use client';

import React from 'react';
import { 
  ShieldCheck, 
  Cpu, 
  Zap, 
  Gift, 
  ArrowRight, 
  Lock, 
  CheckCircle2, 
  Sparkles, 
  Layers, 
  Package, 
  Award,
  Flame,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

interface WhyChooseBentoGridProps {
  onCommunityJoin?: () => void;
  isCommunityClaimed?: boolean;
  isClaimingCommunity?: boolean;
}

export function WhyChooseBentoGrid({
  onCommunityJoin,
  isCommunityClaimed = false,
  isClaimingCommunity = false
}: WhyChooseBentoGridProps) {
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = React.useState(0);

  React.useEffect(() => {
    if (!carouselApi) return;
    setCurrentSlide(carouselApi.selectedScrollSnap());
    carouselApi.on("select", () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    });
  }, [carouselApi]);

  const totalMobileSlides = 5;

  return (
    <section className="py-12 sm:py-20 md:py-24 container px-3 sm:px-4 max-w-7xl mx-auto relative overflow-hidden">
      {/* 科技背景環境流光與細緻網格 */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-50" />

      {/* 區塊標題區 */}
      <div className="text-center mb-8 sm:mb-14 space-y-3 sm:space-y-4 relative z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono font-bold tracking-widest uppercase">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>Next-Gen Trading Card Platform</span>
        </div>
        <h2 className="text-2xl sm:text-4xl md:text-5xl font-black font-headline tracking-tight text-white drop-shadow-sm">
          為什麼選擇 <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-400 drop-shadow-[0_0_25px_rgba(245,158,11,0.4)]">P+Carder</span>
        </h2>
        <p className="text-xs sm:text-base text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
          以「公開驗證演算法」、「權威實體存證」與「次世代開包技術」，重塑球卡藏友的信賴標準
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 1. 手機版：左右滑動輪播 (與最新消息體驗一致，支援手指滑動與指示條) */}
      {/* ========================================================================= */}
      <div className="block md:hidden relative z-10 w-full">
        <Carousel 
          setApi={setCarouselApi}
          opts={{ align: "start", loop: false }} 
          className="w-full relative"
        >
          <CarouselContent className="-ml-3">
            {/* Slide 1: PSA / BGS 100% 官方正品實體存證 */}
            <CarouselItem className="pl-3 basis-[88%] xs:basis-[84%] flex flex-col">
              <div className="h-full rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-slate-900/90 border border-amber-500/30 p-5 flex flex-col justify-between relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
                <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10 flex flex-col h-full justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[10px] font-mono font-bold text-amber-400 tracking-wider uppercase">Vault Guarantee</div>
                          <div className="text-xs text-slate-400 font-medium">權威機構官方評級</div>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-slate-500">01 / VAULT</span>
                    </div>

                    <h3 className="text-lg font-black text-white font-headline tracking-tight mb-2">
                      100% 實體存證 · PSA/BGS 雙重驗證
                    </h3>
                    <p className="text-slate-300/80 text-xs leading-relaxed mb-3">
                      所有大獎卡均實體入庫與數位建檔，每張鑑定卡均有官方編號可查，存放於恆溫恆濕防潮保險庫。
                    </p>
                  </div>

                  <div className="bg-slate-950/90 rounded-xl border border-slate-800/90 p-3.5 flex items-center gap-3">
                    <div className="w-14 h-20 rounded-lg bg-gradient-to-b from-slate-800 to-slate-900 border border-amber-400/60 p-1 shadow-md shrink-0 flex flex-col justify-between items-center text-center">
                      <span className="text-[7px] font-black bg-amber-400 text-slate-950 px-1 rounded uppercase">PSA 10</span>
                      <Award className="w-5 h-5 text-amber-400" />
                      <span className="text-[7px] font-mono text-slate-300">#794829</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1 font-bold text-amber-300 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>原廠防偽封裝 · 官網即查</span>
                      </div>
                      <div className="flex items-center gap-1 font-bold text-amber-300 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>保險庫實體封存 · 可快遞到府</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CarouselItem>

            {/* Slide 2: 全公開機率演算法 · 杜絕黑箱 */}
            <CarouselItem className="pl-3 basis-[88%] xs:basis-[84%] flex flex-col">
              <div className="h-full rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-slate-900/90 border border-cyan-500/30 p-5 flex flex-col justify-between relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
                <div className="absolute -top-16 -right-16 w-48 h-48 bg-cyan-500/15 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10 flex flex-col h-full justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                          <Cpu className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[10px] font-mono font-bold text-cyan-400 tracking-wider uppercase">Provably Fair</div>
                          <div className="text-xs text-slate-400 font-medium">公開隨機數架構</div>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-slate-500">02 / RNG</span>
                    </div>

                    <h3 className="text-lg font-black text-white font-headline tracking-tight mb-2">
                      全公開機率演算法 · 杜絕黑箱
                    </h3>
                    <p className="text-slate-300/80 text-xs leading-relaxed mb-3">
                      所有卡池大獎餘量、單抽爆率即時公示，抽卡結果皆由隨機數引擎獨立生成。
                    </p>
                  </div>

                  <div className="bg-slate-950/90 rounded-xl border border-slate-800/90 p-3 space-y-2">
                    <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between">
                      <span>4-STEP VERIFIED FLOW</span>
                      <span className="text-cyan-400 font-bold">100% UNBIASED</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-center">
                      <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col items-center">
                        <Package className="w-3.5 h-3.5 text-slate-400 mb-0.5" />
                        <span className="text-[9px] font-bold text-slate-200">1. 選池</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-cyan-950/50 border border-cyan-500/40 flex flex-col items-center">
                        <Zap className="w-3.5 h-3.5 text-cyan-400 mb-0.5 animate-pulse" />
                        <span className="text-[9px] font-bold text-cyan-300">2. 挑籤</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col items-center">
                        <Layers className="w-3.5 h-3.5 text-amber-400 mb-0.5" />
                        <span className="text-[9px] font-bold text-slate-200">3. 開箱</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col items-center">
                        <Lock className="w-3.5 h-3.5 text-emerald-400 mb-0.5" />
                        <span className="text-[9px] font-bold text-slate-200">4. 存證</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CarouselItem>

            {/* Slide 3: 硬核運行指標 */}
            <CarouselItem className="pl-3 basis-[88%] xs:basis-[84%] flex flex-col">
              <div className="h-full rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-slate-900/90 border border-slate-800/90 p-5 flex flex-col justify-between relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
                <div className="relative z-10 flex flex-col h-full justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="text-[10px] font-mono font-bold text-slate-400 tracking-wider uppercase">Performance Specs</div>
                      <span className="text-[11px] font-mono font-bold text-slate-500">03 / SPECS</span>
                    </div>
                    <h3 className="text-lg font-black text-white font-headline mb-3">硬核運行指標</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/90 flex items-center justify-between">
                      <div>
                        <div className="text-[9px] text-slate-400 font-medium">開卡響應延遲</div>
                        <div className="text-lg font-black font-mono text-cyan-400">0.02s</div>
                      </div>
                      <div className="text-right text-[10px] text-slate-400 font-mono">極速 60FPS 特效</div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/90 flex items-center justify-between">
                      <div>
                        <div className="text-[9px] text-slate-400 font-medium">大獎剩餘披露率</div>
                        <div className="text-lg font-black font-mono text-amber-400">100%</div>
                      </div>
                      <div className="text-right text-[10px] text-slate-400 font-mono">即時數據連線</div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/90 flex items-center justify-between">
                      <div>
                        <div className="text-[9px] text-slate-400 font-medium">實體卡庫安全標準</div>
                        <div className="text-lg font-black font-mono text-emerald-400">24H 恆溫防潮</div>
                      </div>
                      <div className="text-right text-[10px] text-slate-400 font-mono">專業獨立保險櫃</div>
                    </div>
                  </div>
                </div>
              </div>
            </CarouselItem>

            {/* Slide 4: 多元玩法 · 拆卡自由 */}
            <CarouselItem className="pl-3 basis-[88%] xs:basis-[84%] flex flex-col">
              <div className="h-full rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-slate-900/90 border border-fuchsia-500/30 p-5 flex flex-col justify-between relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
                <div className="absolute -top-16 -right-16 w-48 h-48 bg-fuchsia-500/15 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10 flex flex-col h-full justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-fuchsia-500/15 text-fuchsia-400 border border-fuchsia-500/30">
                          <Flame className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-fuchsia-400 uppercase">Interactive Modes</span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-slate-500">04 / MODES</span>
                    </div>
                    <h3 className="text-lg font-black text-white font-headline mb-1">多元玩法 · 拆卡自由</h3>
                    <p className="text-slate-300/80 text-xs leading-relaxed">
                      打破實體卡盒門檻，支援多元拆卡機制與資產流轉。
                    </p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                      <span className="font-bold text-slate-200 flex items-center gap-1.5 text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400" />
                        即時拼卡 (Team Break)
                      </span>
                      <span className="text-[10px] text-slate-400">小額拼頂卡</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                      <span className="font-bold text-slate-200 flex items-center gap-1.5 text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        限量福袋 (Lucky Bag)
                      </span>
                      <span className="text-[10px] text-slate-400">含保底機制</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                      <span className="font-bold text-slate-200 flex items-center gap-1.5 text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        卡片以點回購 / 直寄
                      </span>
                      <span className="text-[10px] text-slate-400">資產靈活掌控</span>
                    </div>
                  </div>
                </div>
              </div>
            </CarouselItem>

            {/* Slide 5: VIP 藏友特權與官方 LINE 社群福利 */}
            <CarouselItem className="pl-3 basis-[88%] xs:basis-[84%] flex flex-col">
              <div className="h-full rounded-2xl bg-gradient-to-br from-emerald-950/80 via-slate-950/95 to-slate-900/90 border border-emerald-500/40 p-5 flex flex-col justify-between relative overflow-hidden shadow-[0_10px_30px_rgba(16,185,129,0.2)]">
                <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10 flex flex-col h-full justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 font-mono tracking-wider uppercase">
                        <Sparkles className="w-3 h-3" />
                        <span>VIP PRIVILEGE</span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-emerald-500">05 / VIP</span>
                    </div>
                    <h3 className="text-base font-black text-white font-headline leading-snug mb-1">
                      加入官方 LINE 社群 · 領免費抽卡券
                    </h3>
                    <p className="text-slate-300/80 text-[11px] leading-relaxed">
                      掌握大獎出卡快報、不定期折扣碼與卡展快速入場券！
                    </p>
                  </div>

                  {onCommunityJoin && (
                    <Button
                      type="button"
                      onClick={onCommunityJoin}
                      disabled={isClaimingCommunity}
                      className={cn(
                        "w-full py-2.5 h-auto rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-lg",
                        isCommunityClaimed
                          ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                          : "bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                      )}
                    >
                      <Gift className={cn("w-3.5 h-3.5", isCommunityClaimed ? "text-emerald-400" : "text-slate-950")} />
                      <span>
                        {isClaimingCommunity 
                          ? '領取中...' 
                          : isCommunityClaimed 
                            ? '已領取 · 前往社群交流' 
                            : '加入社群領抽卡券'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CarouselItem>
          </CarouselContent>

          {/* 手機專用滑動指示圓點 (Dots) - 完全與最新消息樣式一致 */}
          <div className="flex justify-center items-center gap-1.5 mt-4">
            {Array.from({ length: totalMobileSlides }).map((_, dotIdx) => (
              <button
                key={dotIdx}
                type="button"
                onClick={() => carouselApi?.scrollTo(dotIdx)}
                aria-label={`切換至特點 ${dotIdx + 1}`}
                className={cn(
                  "h-1.5 transition-all duration-300 rounded-full",
                  currentSlide === dotIdx 
                    ? "w-6 bg-gradient-to-r from-amber-400 to-yellow-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]" 
                    : "w-1.5 bg-slate-700/80 hover:bg-slate-600"
                )}
              />
            ))}
          </div>
        </Carousel>
      </div>

      {/* ========================================================================= */}
      {/* 2. 電腦與平板版 (md: 及以上)：維持發布會級 12 欄 Bento Grid 視覺矩陣 */}
      {/* ========================================================================= */}
      <div className="hidden md:grid md:grid-cols-12 gap-4 sm:gap-5 relative z-10">
        
        {/* 1. 核心旗艦大板塊：PSA / BGS 100% 官方正品實體存證 (佔 7 欄) */}
        <div className="md:col-span-7 rounded-3xl bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-slate-900/90 border border-amber-500/25 p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden group shadow-[0_10px_40px_rgba(0,0,0,0.6)] hover:border-amber-400/50 transition-all duration-500">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-amber-500/15 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/25 transition-all duration-500" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.08),transparent_50%)]" />

          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[11px] font-mono font-bold text-amber-400 tracking-wider uppercase">Authenticity Guarantee</div>
                  <div className="text-xs text-slate-400 font-medium">權威機構官方評級</div>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500">01 / VAULT</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-black text-white font-headline tracking-tight group-hover:text-amber-200 transition-colors mb-3">
              100% 實體卡片存證 · PSA/BGS 雙重驗證
            </h3>
            <p className="text-slate-300/80 text-sm sm:text-base leading-relaxed max-w-xl mb-6">
              所有卡池核心大獎卡均完成實體入庫與數位建檔，每張鑑定卡均有官方編號可查，實體存放於專屬恆溫恆濕防潮保險庫，杜絕假卡與調包。
            </p>

            {/* 實體鑑定卡 3D 質感模擬預覽卡塊 */}
            <div className="bg-slate-950/80 rounded-2xl border border-slate-800/90 p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 group-hover:border-amber-500/40 transition-colors">
              <div className="w-20 h-28 sm:w-24 sm:h-32 rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-amber-400/60 p-1.5 shadow-[0_0_25px_rgba(245,158,11,0.2)] shrink-0 flex flex-col justify-between relative overflow-hidden">
                <div className="bg-amber-400/90 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded text-center tracking-tighter uppercase">
                  PSA 10 GEM MT
                </div>
                <div className="h-full flex items-center justify-center my-1">
                  <Award className="w-8 h-8 text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                </div>
                <div className="text-[8px] font-mono text-center text-slate-300 bg-slate-950/90 py-0.5 rounded border border-white/5">
                  #79482910
                </div>
              </div>

              <div className="space-y-2 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs font-bold text-amber-300">
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 原廠防偽封裝</span>
                  <span className="text-slate-600">·</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 官方編號即時查驗</span>
                  <span className="text-slate-600">·</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 保險庫實體封存</span>
                </div>
                <p className="text-xs text-slate-400 leading-normal">
                  開出即自動存入您的「專屬數位卡夾」，可隨時申請物理快遞到府，由專業防震保險箱安全寄送。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. 演算法架構流程圖板塊：公平透明開卡驗證引擎 (佔 5 欄) */}
        <div className="md:col-span-5 rounded-3xl bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-slate-900/90 border border-cyan-500/25 p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden group shadow-[0_10px_40px_rgba(0,0,0,0.6)] hover:border-cyan-400/50 transition-all duration-500">
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/20 transition-all duration-500" />

          <div>
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
                  <Cpu className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[11px] font-mono font-bold text-cyan-400 tracking-wider uppercase">Provably Fair Engine</div>
                  <div className="text-xs text-slate-400 font-medium">公開隨機數架構</div>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500">02 / RNG</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white font-headline tracking-tight group-hover:text-cyan-200 transition-colors mb-2">
              全公開機率演算法 · 杜絕黑箱
            </h3>
            <p className="text-slate-300/80 text-xs sm:text-sm leading-relaxed mb-5">
              所有卡池大獎餘量、單抽爆率即時百分之百公示，抽卡結果皆由隨機數引擎獨立生成。
            </p>

            {/* 流程流向架構圖 */}
            <div className="space-y-2 bg-slate-950/90 rounded-2xl p-3.5 sm:p-4 border border-slate-800/80">
              <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between pb-2 border-b border-slate-800">
                <span>VERIFICATION FLOW</span>
                <span className="text-cyan-400 font-bold">100% UNBIASED</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 pt-1 text-center">
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center">
                  <Package className="w-4 h-4 text-slate-400 mb-1" />
                  <span className="text-[10px] font-bold text-slate-200">1. 選定卡池</span>
                  <span className="text-[8px] text-slate-500 font-mono">餘量公開</span>
                </div>
                <div className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-500/40 flex flex-col items-center justify-center relative">
                  <Zap className="w-4 h-4 text-cyan-400 mb-1 animate-pulse" />
                  <span className="text-[10px] font-bold text-cyan-300">2. 隨機挑號</span>
                  <span className="text-[8px] text-cyan-500/80 font-mono">加密運算</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center">
                  <Layers className="w-4 h-4 text-amber-400 mb-1" />
                  <span className="text-[10px] font-bold text-slate-200">3. 動態開箱</span>
                  <span className="text-[8px] text-slate-500 font-mono">60FPS 特效</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center">
                  <Lock className="w-4 h-4 text-emerald-400 mb-1" />
                  <span className="text-[10px] font-bold text-slate-200">4. 存證入庫</span>
                  <span className="text-[8px] text-slate-500 font-mono">隨時提領</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 性能規格卡群：3 個硬核指標 (佔 6 欄) */}
        <div className="md:col-span-6 rounded-3xl bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-slate-900/90 border border-slate-800/90 p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden group shadow-[0_10px_40px_rgba(0,0,0,0.6)] hover:border-slate-700 transition-all duration-300">
          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-[11px] font-mono font-bold text-slate-400 tracking-wider uppercase">Performance Specs</div>
              <span className="text-xs font-mono font-bold text-slate-500">03 / SPECS</span>
            </div>
            <h4 className="text-lg font-black text-white font-headline mb-4">硬核運行指標</h4>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/90 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400 font-medium">開卡響應延遲</div>
                <div className="text-xl sm:text-2xl font-black font-mono text-cyan-400 tracking-tight">0.02s</div>
              </div>
              <div className="text-right text-[11px] text-slate-400 font-mono">極速 60FPS 特效</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/90 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400 font-medium">大獎剩餘披露率</div>
                <div className="text-xl sm:text-2xl font-black font-mono text-amber-400 tracking-tight">100%</div>
              </div>
              <div className="text-right text-[11px] text-slate-400 font-mono">即時數據連線</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/90 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400 font-medium">實體卡庫安全標準</div>
                <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 tracking-tight">24H 恆溫</div>
              </div>
              <div className="text-right text-[11px] text-slate-400 font-mono">防潮獨立保險櫃</div>
            </div>
          </div>
        </div>

        {/* 4. 次世代玩法矩陣 (佔 6 欄) */}
        <div className="md:col-span-6 rounded-3xl bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-slate-900/90 border border-fuchsia-500/25 p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden group shadow-[0_10px_40px_rgba(0,0,0,0.6)] hover:border-fuchsia-400/50 transition-all duration-300">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-fuchsia-500/20 transition-all" />

          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="p-2.5 rounded-2xl bg-fuchsia-500/15 text-fuchsia-400 border border-fuchsia-500/30">
                <Flame className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-bold text-slate-500">04 / MODES</span>
            </div>
            <h4 className="text-lg font-black text-white font-headline mb-2 group-hover:text-fuchsia-200 transition-colors">
              多元玩法 · 拆卡自由
            </h4>
            <p className="text-slate-300/80 text-xs leading-relaxed mb-4">
              打破實體卡盒高昂門檻，支援單抽、福袋、多人合拆與即時回收。
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400" />
                即時拼卡 (Team Break)
              </span>
              <span className="text-[11px] text-slate-400">小額拼頂卡</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                限量福袋 (Lucky Bag)
              </span>
              <span className="text-[11px] text-slate-400">含保底機制</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                卡片以點回購 / 直寄
              </span>
              <span className="text-[11px] text-slate-400">資產靈活掌控</span>
            </div>
          </div>
        </div>

        {/* 6. VIP 藏友特權與官方 LINE 社群福利 (佔滿整行 12 欄) */}
        <div className="md:col-span-12 rounded-3xl bg-gradient-to-r from-emerald-950/70 via-slate-950/95 to-slate-900/90 border border-emerald-500/40 p-6 sm:p-8 flex flex-col lg:flex-row items-center justify-between gap-6 relative overflow-hidden group shadow-[0_15px_50px_rgba(16,185,129,0.15)]">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-500" />
          
          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 max-w-3xl">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 font-black shadow-[0_0_25px_rgba(16,185,129,0.5)] shrink-0">
              <Gift className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 font-mono tracking-wider uppercase">
                <Sparkles className="w-3.5 h-3.5" />
                <span>COMMUNITY EXCLUSIVE PRIVILEGE</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white font-headline">
                加入官方 LINE 藏友社群 · 免費領取「專屬抽卡券」1 張
              </h3>
              <p className="text-xs sm:text-sm text-slate-300/80 leading-relaxed">
                與全台數千位資深卡友即時交流、搶先掌握最新大獎出卡快報、不定期社群專屬折扣碼與卡展快速入場券！
              </p>
            </div>
          </div>

          <div className="relative z-10 shrink-0 w-full lg:w-auto">
            {onCommunityJoin && (
              <Button
                type="button"
                onClick={onCommunityJoin}
                disabled={isClaimingCommunity}
                className={cn(
                  "w-full lg:w-auto px-8 py-3.5 h-auto rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xl",
                  isCommunityClaimed
                    ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                    : "bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:from-emerald-300 hover:to-teal-300 text-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.4)] active:scale-95"
                )}
              >
                <Gift className={cn("w-4 h-4", isCommunityClaimed ? "text-emerald-400" : "text-slate-950")} />
                <span>
                  {isClaimingCommunity 
                    ? '領取中...' 
                    : isCommunityClaimed 
                      ? '已領取專屬券 · 前往社群交流' 
                      : '立即加入官方社群 · 領免費抽卡券'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

      </div>
    </section>
  );
}
