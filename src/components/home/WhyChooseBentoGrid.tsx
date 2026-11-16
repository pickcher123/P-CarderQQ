'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Cpu,
  Zap,
  Gift,
  ArrowRight,
  Lock,
  CheckCircle2,
  Flame,
  Search,
  FileCheck,
  Award,
  MessageCircle,
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
    <section className="py-12 sm:py-20 container px-3 sm:px-4 max-w-7xl mx-auto relative overflow-hidden">
      {/* 柔和環境微光 */}
      <div className="absolute top-0 right-1/4 w-[480px] h-[480px] bg-amber-500/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/4 w-[480px] h-[480px] bg-cyan-500/8 rounded-full blur-[140px] pointer-events-none" />

      {/* 區塊標題區 */}
      <div className="text-center mb-8 sm:mb-12 space-y-2.5 relative z-10">
        <h2 className="text-2xl sm:text-4xl font-bold font-headline tracking-tight text-white">
          為什麼選擇 <span className="text-amber-400">P+Carder</span>
        </h2>
        <p className="text-xs sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
          公開驗證演算法、實體現貨入庫與多元拆卡機制，打造透明安心的球卡收藏體驗
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 1. 手機版：左右滑動字卡 (4 張完整對應指示圓點) */}
      {/* ========================================================================= */}
      <div className="block md:hidden relative z-10 w-full">
        <Carousel
          setApi={setCarouselApi}
          opts={{ align: 'start', loop: false }}
          className="w-full relative"
        >
          <CarouselContent className="-ml-3">
            {/* 01. 100% 實體現貨在庫 */}
            <CarouselItem className="pl-3 basis-[88%] xs:basis-[84%] flex flex-col">
              <div className="h-full rounded-2xl bg-slate-900/90 border border-amber-500/25 p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <span className="text-xs text-amber-300 font-semibold">現貨入庫 · 恆溫保護</span>
                    </div>
                    <span className="text-xs font-code font-bold text-slate-500">01</span>
                  </div>

                  <h3 className="text-lg font-bold text-white font-headline tracking-tight mb-1.5">
                    100% 實體現貨在庫
                  </h3>
                  <p className="text-slate-300/85 text-xs leading-relaxed">
                    堅持「有現貨才上架」，每張鑑定卡與單卡皆已完成數位建檔，並妥善存放於恆溫防潮保險庫。
                  </p>
                </div>

                <div className="bg-slate-950/80 rounded-xl border border-slate-800/90 p-3.5 flex items-center gap-3">
                  <div className="w-12 h-16 rounded-lg bg-slate-900 border border-amber-400/50 p-1 shrink-0 flex flex-col justify-between items-center text-center">
                    <span className="text-[8px] font-bold bg-amber-400 text-slate-950 px-1 rounded">PSA 10</span>
                    <Award className="w-4 h-4 text-amber-400" />
                    <span className="text-[8px] font-code text-slate-400">現貨</span>
                  </div>
                  <div className="space-y-1 text-xs text-slate-200">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>官方防偽封裝 · 編號可查</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>防震包裝直寄到府</span>
                    </div>
                  </div>
                </div>
              </div>
            </CarouselItem>

            {/* 02. 公開可驗證演算法 */}
            <CarouselItem className="pl-3 basis-[88%] xs:basis-[84%] flex flex-col">
              <div className="h-full rounded-2xl bg-slate-900/90 border border-cyan-500/30 p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                        <Cpu className="w-5 h-5" />
                      </div>
                      <span className="text-xs text-cyan-300 font-semibold">SHA-256 公平驗證</span>
                    </div>
                    <span className="text-xs font-code font-bold text-slate-500">02</span>
                  </div>

                  <h3 className="text-lg font-bold text-white font-headline tracking-tight mb-1.5">
                    全公開機率 · 每抽皆可驗證
                  </h3>
                  <p className="text-slate-300/85 text-xs leading-relaxed">
                    抽取前預先鎖定伺服器雜湊值，結合玩家端隨機種子，開獎後完整公開數據供隨時複驗。
                  </p>
                </div>

                <div className="bg-slate-950/85 rounded-xl border border-slate-800 p-3 space-y-2.5">
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex flex-col items-center">
                      <Lock className="w-3.5 h-3.5 text-amber-400 mb-1" />
                      <span className="text-[11px] font-semibold text-slate-200">抽前鎖定</span>
                    </div>
                    <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/30 flex flex-col items-center">
                      <Zap className="w-3.5 h-3.5 text-cyan-400 mb-1" />
                      <span className="text-[11px] font-semibold text-cyan-300">共同隨機</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex flex-col items-center">
                      <FileCheck className="w-3.5 h-3.5 text-emerald-400 mb-1" />
                      <span className="text-[11px] font-semibold text-slate-200">公開複算</span>
                    </div>
                  </div>

                  <Link
                    href="/fairness"
                    className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-semibold transition-colors"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>前往公平驗證中心</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </CarouselItem>

            {/* 03. 多元玩法與靈活資產 */}
            <CarouselItem className="pl-3 basis-[88%] xs:basis-[84%] flex flex-col">
              <div className="h-full rounded-2xl bg-slate-900/90 border border-rose-500/25 p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/25">
                        <Flame className="w-5 h-5" />
                      </div>
                      <span className="text-xs text-rose-300 font-semibold">多元拆卡模式</span>
                    </div>
                    <span className="text-xs font-code font-bold text-slate-500">03</span>
                  </div>

                  <h3 className="text-lg font-bold text-white font-headline tracking-tight mb-1.5">
                    多元玩法 · 卡片靈活處置
                  </h3>
                  <p className="text-slate-300/85 text-xs leading-relaxed">
                    降低高價實體卡盒門檻，抽出的卡片可隨時申請寄出，或直接轉換為 P+ 紅利點數。
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                    <span className="font-semibold text-slate-200">拼卡與命運轉盤</span>
                    <span className="text-rose-300 font-medium">1/10 成本自選挑戰</span>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                    <span className="font-semibold text-slate-200">限量福袋與直播團拆</span>
                    <span className="text-slate-400">公開配對開拆</span>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                    <span className="font-semibold text-slate-200">實體寄送 / 轉點折抵</span>
                    <span className="text-slate-400">自由選擇</span>
                  </div>
                </div>
              </div>
            </CarouselItem>

            {/* 04. 官方 LINE 社群福利 */}
            <CarouselItem className="pl-3 basis-[88%] xs:basis-[84%] flex flex-col">
              <div className="h-full rounded-2xl bg-slate-900/90 border border-emerald-500/30 p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <MessageCircle className="w-5 h-5" />
                      </div>
                      <span className="text-xs text-emerald-300 font-semibold">卡友交流社群</span>
                    </div>
                    <span className="text-xs font-code font-bold text-slate-500">04</span>
                  </div>

                  <h3 className="text-lg font-bold text-white font-headline tracking-tight mb-1.5">
                    加入官方 LINE 社群領抽卡券
                  </h3>
                  <p className="text-slate-300/85 text-xs leading-relaxed">
                    即時接收大獎出卡快報、限定活動通知與卡展交流資訊，首次加入還可領取免費抽卡券。
                  </p>
                </div>

                {onCommunityJoin && (
                  <Button
                    type="button"
                    onClick={onCommunityJoin}
                    disabled={isClaimingCommunity}
                    className={cn(
                      'w-full py-2.5 h-auto rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all',
                      isCommunityClaimed
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
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
                    ? 'w-6 bg-amber-400'
                    : 'w-1.5 bg-slate-700/80 hover:bg-slate-600'
                )}
              />
            ))}
          </div>
        </Carousel>
      </div>

      {/* ========================================================================= */}
      {/* 2. 桌面與平板版 (md 以上)：12 欄對稱 Bento Grid */}
      {/* ========================================================================= */}
      <div className="hidden md:grid md:grid-cols-12 gap-5 relative z-10">
        {/* 01. 100% 實體現貨在庫 (7 欄) */}
        <div className="md:col-span-7 rounded-3xl bg-slate-900/90 border border-amber-500/25 p-7 flex flex-col justify-between relative overflow-hidden hover:border-amber-400/50 transition-colors">
          <div>
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-amber-300 font-semibold">現貨在庫 · 專業保存</span>
              </div>
              <span className="text-xs font-code font-bold text-slate-500">01</span>
            </div>

            <h3 className="text-2xl font-bold text-white font-headline tracking-tight mb-2.5">
              100% 實體卡片在庫，嚴謹恆溫保護
            </h3>
            <p className="text-slate-300/85 text-sm leading-relaxed max-w-xl mb-6">
              堅持「有在庫才上架，絕不先賣後買」。所有卡片均已實體入庫並完成數位建檔，存放於恆溫恆濕防潮保險庫，確保每張卡片維持最佳狀態。
            </p>
          </div>

          <div className="bg-slate-950/80 rounded-2xl border border-slate-800/90 p-4 sm:p-5 flex items-center gap-4">
            <div className="w-20 h-26 rounded-xl bg-slate-900 border border-amber-400/50 p-2 shrink-0 flex flex-col justify-between items-center text-center">
              <span className="bg-amber-400 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded w-full">
                PSA / BGS
              </span>
              <ShieldCheck className="w-7 h-7 text-amber-400 my-1.5" />
              <span className="text-[10px] font-code text-emerald-400 font-semibold">實體在席</span>
            </div>

            <div className="space-y-2 text-left">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-amber-300">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 現貨先審後上
                </span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 24 小時防潮封存
                </span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 高規格防震寄送
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                開出後立即存入個人收藏庫，申請出貨時採用防潮卡膜、卡磚與防震包裝安心送達。
              </p>
            </div>
          </div>
        </div>

        {/* 02. 公開可驗證演算法 (5 欄) */}
        <div className="md:col-span-5 rounded-3xl bg-slate-900/90 border border-cyan-500/30 p-7 flex flex-col justify-between relative overflow-hidden hover:border-cyan-400/50 transition-colors">
          <div>
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  <Cpu className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-cyan-300 font-semibold">SHA-256 公平驗證</span>
              </div>
              <span className="text-xs font-code font-bold text-slate-500">02</span>
            </div>

            <h3 className="text-2xl font-bold text-white font-headline tracking-tight mb-2.5">
              全公開機率，每一抽皆可獨立驗證
            </h3>
            <p className="text-slate-300/85 text-sm leading-relaxed mb-6">
              每次抽取前預先加密鎖定伺服器種子，結合玩家端隨機種子共同決定結果；開獎後完整公開原始數據，隨時可線上複算核驗。
            </p>
          </div>

          <div className="space-y-3 bg-slate-950/85 rounded-2xl p-4 border border-slate-800">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center">
                <Lock className="w-4 h-4 text-amber-400 mb-1" />
                <span className="text-xs font-semibold text-slate-200">1. 抽前預鎖</span>
                <span className="text-[10px] text-slate-500 font-code">Server Hash</span>
              </div>
              <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex flex-col items-center">
                <Zap className="w-4 h-4 text-cyan-400 mb-1" />
                <span className="text-xs font-semibold text-cyan-300">2. 共同隨機</span>
                <span className="text-[10px] text-cyan-400/80 font-code">Client Seed</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center">
                <FileCheck className="w-4 h-4 text-emerald-400 mb-1" />
                <span className="text-xs font-semibold text-slate-200">3. 公開複算</span>
                <span className="text-[10px] text-emerald-400 font-code">100% 吻合</span>
              </div>
            </div>

            <Link
              href="/fairness"
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 hover:text-white transition-colors text-xs font-semibold"
            >
              <span className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-cyan-400" />
                線上輸入 Hash / Seed 即時驗證開獎結果
              </span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </Link>
          </div>
        </div>

        {/* 03. 多元玩法與靈活資產 (7 欄) */}
        <div className="md:col-span-7 rounded-3xl bg-slate-900/90 border border-rose-500/25 p-7 flex flex-col justify-between relative overflow-hidden hover:border-rose-400/50 transition-colors">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/25">
                  <Flame className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-rose-300 font-semibold">多元拆卡模式</span>
              </div>
              <span className="text-xs font-code font-bold text-slate-500">03</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-white font-headline tracking-tight mb-2">
              多元玩法，卡片去留自由決定
            </h3>
            <p className="text-slate-300/85 text-sm leading-relaxed mb-5">
              支援主題抽賞、1/10 自選拼卡、命運轉盤、限量福袋與直播團拆，抽中卡片可申請宅配或即時轉換為紅利點數。
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="text-xs font-bold text-slate-100">自選拼卡 · 轉盤</div>
              <div className="text-[11px] text-rose-300 font-medium">1/10 成本挑戰目標</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="text-xs font-bold text-slate-100">限量福袋 · 團拆</div>
              <div className="text-[11px] text-amber-300 font-medium">保底配置公開拆盒</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="text-xs font-bold text-slate-100">直寄或轉點折抵</div>
              <div className="text-[11px] text-emerald-300 font-medium">資產靈活運用</div>
            </div>
          </div>
        </div>

        {/* 04. 官方 LINE 社群福利 (5 欄) */}
        <div className="md:col-span-5 rounded-3xl bg-slate-900/90 border border-emerald-500/30 p-7 flex flex-col justify-between relative overflow-hidden hover:border-emerald-400/50 transition-colors">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-emerald-300 font-semibold">官方玩家社群</span>
              </div>
              <span className="text-xs font-code font-bold text-slate-500">04</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-white font-headline tracking-tight mb-2">
              加入官方 LINE 社群領免費抽卡券
            </h3>
            <p className="text-slate-300/85 text-sm leading-relaxed mb-5">
              第一時間掌握大獎出卡快報、不定期專屬活動碼與卡展資訊，首次加入社群即可領取免費抽卡券 1 張。
            </p>
          </div>

          {onCommunityJoin && (
            <Button
              type="button"
              onClick={onCommunityJoin}
              disabled={isClaimingCommunity}
              className={cn(
                'w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer',
                isCommunityClaimed
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
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
