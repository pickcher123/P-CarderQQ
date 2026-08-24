
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  History, 
  Building2, 
  ShieldCheck, 
  Library, 
  ChevronRight, 
  Sparkles, 
  Heart, 
  Scale, 
  Truck, 
  Award, 
  MessageCircle, 
  Mail, 
  ExternalLink,
  CheckCircle2,
  Zap
} from 'lucide-react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { SafeImage } from '@/components/safe-image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { SystemConfig } from '@/types/system';
import { motion } from 'framer-motion';

export default function AboutPage() {
  const firestore = useFirestore();
  const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
  const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);

  const fallbackOriginImage = PlaceHolderImages.find(img => img.id === 'about-origin');
  const originImageUrl = systemConfig?.aboutOriginImageUrl || fallbackOriginImage?.imageUrl || '';

  const coreFeatures = [
    {
      icon: ShieldCheck,
      title: "絕對公平與機率公開",
      desc: "堅持所有卡池與賞項機率100%公開透明，讓每一次抽卡都經得起驗證。",
      color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30"
    },
    {
      icon: Award,
      title: "正版品質保證",
      desc: "嚴選全球官方授權球員卡與珍稀評級卡，每一張皆為值得典藏的資產。",
      color: "text-amber-400 bg-amber-500/10 border-amber-500/30"
    },
    {
      icon: Truck,
      title: "實體寄送與靈活轉換",
      desc: "抽中即可選擇申請安全實體包裹寄送到府，或靈活 Buy Back 換取 P 點。",
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
    },
    {
      icon: Zap,
      title: "多元多元玩法體驗",
      desc: "包含即時單抽、直播團拆 (Group Break)、幸運福袋與拼卡競技殿堂。",
      color: "text-purple-400 bg-purple-500/10 border-purple-500/30"
    }
  ];

  return (
    <div className="container max-w-6xl py-10 md:py-16 space-y-16 relative overflow-hidden">
      {/* 背景光暈藝術效果 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-primary/15 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute top-[40%] right-[-10%] w-[400px] h-[300px] bg-amber-500/10 blur-[130px] pointer-events-none rounded-full" />

      {/* Hero 標題區 */}
      <div className="text-center space-y-5 relative z-10 max-w-3xl mx-auto">
        <motion.h1 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-headline text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white drop-shadow-[0_0_25px_rgba(6,182,212,0.35)]"
        >
          關於 <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-200 to-amber-300">P+CARDER</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-slate-300 text-base sm:text-lg leading-relaxed font-medium"
        >
          這不只是一個數位抽卡平台，而是一群熱愛球員卡的藏家為夢想打造的榮耀殿堂。
        </motion.p>
      </div>

      {/* 核心故事區塊 */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
      >
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 space-y-5 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="inline-flex items-center gap-2 text-rose-400 font-bold text-sm bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
              <Heart className="w-4 h-4 fill-rose-500/30" /> 
              <span>品牌起源</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black font-headline text-white leading-tight">
              那一聲清脆的撕裂，是藏家心中最純粹的悸動
            </h2>

            <div className="space-y-4 text-slate-300 leading-relaxed text-sm sm:text-base font-normal">
              <p>
                還記得小時候，手裡緊握著累積已久的零用錢，屏息凝神撕開卡包的那一秒嗎？那一瞬間的期待與驚喜，是每一位球卡收藏家心中最難忘的熱血回憶。
              </p>
              <p>
                隨著時代演進，收藏的形式不斷創新，但那份「期待感與珍藏價值」不該改變。P+CARDER 的誕生，正是為了在數位時代中，將實體球卡體驗結合極致流暢的線上樂趣，讓每位卡友都能安心典藏屬於自己的夢幻卡款。
              </p>
            </div>
          </div>

          {/* 4 大核心特色 Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {coreFeatures.map((feat, idx) => (
              <div 
                key={idx}
                className="p-5 rounded-2xl bg-slate-900/40 backdrop-blur-md border border-white/5 space-y-2.5 hover:border-white/20 transition-all duration-300 group"
              >
                <div className={`p-2.5 w-fit rounded-xl border ${feat.color} group-hover:scale-105 transition-transform`}>
                  <feat.icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-base">{feat.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 形象圖片展示 */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="relative aspect-[4/5] max-w-md w-full rounded-3xl overflow-hidden border border-white/15 group shadow-2xl bg-slate-950 p-2">
            <div className="relative w-full h-full rounded-2xl overflow-hidden">
              {originImageUrl && (
                <SafeImage 
                  src={originImageUrl} 
                  alt="P+CARDER Origin" 
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  priority
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/10 text-xs text-slate-300">
                <p className="font-bold text-white flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-primary" /> 正版實品卡片嚴選
                </p>
                <p className="text-[11px] text-slate-400">所有大賞與稀有卡皆經專業鑑定與入庫保護，隨時可申請配送。</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <Separator className="bg-white/10" />

      {/* 品牌願景與品質宣示 */}
      <Card className="bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950/90 backdrop-blur-xl border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        <CardHeader className="p-6 md:p-10 pb-2 border-b border-white/5">
          <CardTitle className="font-headline text-2xl sm:text-3xl text-primary flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-amber-400" />
            我們的品牌願景
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 md:p-10 space-y-6 text-slate-300 leading-relaxed text-sm sm:text-base">
          <p>
            P+CARDER 致力於構建一個「玩家優先、安全信任」的數位卡牌生態系。我們不單單提供抽卡體驗，更致力於打造讓全台球卡收藏家自豪的交換與展覽平台。從專業直播團拆、高對決感拼卡，到每一份豐富的卡池配置，皆為滿足藏家對品質與刺激感的要求。
          </p>
          
          <div className="p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 space-y-2">
            <p className="text-cyan-300 font-bold text-lg sm:text-xl italic">
              「讓收藏回歸熱愛，讓每一抽都充滿真實價值。」
            </p>
            <p className="text-xs sm:text-sm text-slate-400">
              這是我們對所有卡友的承諾。無論您是資深評級卡藏家，或是剛踏入球卡領域的新人玩家，P+CARDER 隨時歡迎您的加入！
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center pt-2">
            <p className="text-xs sm:text-sm font-medium text-slate-400 italic">
              感謝您支持 P+CARDER，與我們一起開啟卡牌收藏新時代。
            </p>
            <Button variant="outline" asChild className="rounded-full border-primary/30 hover:bg-primary/10 text-primary hover:text-cyan-300">
              <Link href="/changelog">
                <History className="mr-2 h-4 w-4" /> 查看平台系統進化日誌
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 公司資訊 & 客服聯絡 & 權益保障 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 公司與聯絡資訊 */}
        <Card className="bg-slate-900/60 backdrop-blur-xl border-white/10 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between">
          <div>
            <CardHeader className="pb-4 border-b border-white/5">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2.5">
                <Building2 className="text-primary h-5 w-5" /> 營運公司資訊
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="flex justify-between items-center py-2 border-b border-white/5 text-sm">
                <span className="text-slate-400 font-medium">公司名稱</span>
                <span className="font-bold text-white">云希國際股份有限公司</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5 text-sm">
                <span className="text-slate-400 font-medium">統一編號</span>
                <span className="font-code text-cyan-400 font-black tracking-wider">90301251</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5 text-sm">
                <span className="text-slate-400 font-medium">官方 LINE@ 客服</span>
                <a 
                  href="https://line.me/R/ti/p/@288qqsyq" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-bold text-emerald-400 hover:underline flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> @288qqsyq <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex justify-between items-center py-2 text-sm">
                <span className="text-slate-400 font-medium">客服信箱</span>
                <a 
                  href="mailto:pickcher1234@gmail.com" 
                  className="text-slate-200 hover:text-primary flex items-center gap-1 font-mono text-xs bg-white/5 px-2.5 py-1 rounded-full border border-white/10"
                >
                  <Mail className="w-3.5 h-3.5 text-primary" /> pickcher1234@gmail.com
                </a>
              </div>
            </CardContent>
          </div>

          <div className="p-4 m-4 mt-0 bg-primary/5 rounded-2xl border border-primary/10 flex items-center justify-between text-xs text-slate-300">
            <span>有任何疑問或實體卡配送問題？</span>
            <Button size="sm" asChild className="rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8">
              <a href="https://line.me/R/ti/p/@288qqsyq" target="_blank" rel="noopener noreferrer">
                聯繫 LINE 客服
              </a>
            </Button>
          </div>
        </Card>

        {/* 權益保障與條款 */}
        <Card className="bg-slate-900/60 backdrop-blur-xl border-white/10 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between">
          <div>
            <CardHeader className="pb-4 border-b border-white/5">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2.5">
                <ShieldCheck className="text-emerald-400 h-5 w-5" /> 藏家權益與消費保障
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <p className="text-xs leading-relaxed text-slate-300 bg-white/5 p-3.5 rounded-2xl border border-white/5">
                <span className="font-bold text-amber-400">【數位內容退換說明】</span><br />
                依據消費者保護法第十九條第一項但書合理例外情事，本平台提供之數位線上抽卡與遊戲服務一經執行即完成，不適用七日鑑賞期無條件解約之規定。
              </p>
              <p className="text-xs leading-relaxed text-slate-300 bg-white/5 p-3.5 rounded-2xl border border-white/5">
                <span className="font-bold text-cyan-400">【實體商品瑕疵處理】</span><br />
                若兌換寄送之實體卡片商品有非人為因素之重大瑕疵（如嚴重折損、嚴重髒污），請於收到包裹七日內保留開箱影片，並透過官方 LINE@ 聯繫處理換貨或補償。
              </p>
            </CardContent>
          </div>

          <div className="p-4 m-4 mt-0 pt-0">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full rounded-2xl border-white/10 hover:bg-white/5 text-slate-200 text-xs font-bold flex items-center justify-center group h-11">
                  <Scale className="h-4 w-4 mr-2 text-primary" /> 查看完整服務與隱私條款 <ChevronRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl bg-slate-950/95 backdrop-blur-3xl border-white/15 rounded-3xl text-slate-200">
                <DialogHeader>
                  <DialogTitle className="text-xl sm:text-2xl font-black font-headline text-primary flex items-center gap-2.5">
                    <Scale className="h-6 w-6 text-primary" /> P+CARDER 服務條款與使用者規範
                  </DialogTitle>
                  <DialogDescription className="text-slate-400 text-xs">
                    請詳細閱讀以下平台服務規範，以保障您的會員權益。
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[60vh] pr-4 mt-2">
                  <div className="space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed pb-6">
                    <section className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                      <h4 className="font-bold text-white text-base flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" /> 1. 數位內容與線上抽卡服務
                      </h4>
                      <p className="text-slate-400">
                        本平台提供之線上抽卡、賞項兌換及拼卡競技等服務，屬於「非以有形媒介提供之數位內容」或「一經提供即為完成之線上服務」。依據《消費者保護法》第19條及《通訊交易解除權合理例外情事適用準則》第2條第5款規定，點數一經扣除並完成遊戲，服務即告完成，不適用七日鑑賞期無條件退貨。
                      </p>
                    </section>

                    <section className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                      <h4 className="font-bold text-white text-base flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" /> 2. 實體卡片商品與品質定義
                      </h4>
                      <p className="text-slate-400">
                        平台所發放之實體卡片均為官方正版授權商品或珍稀評級卡。卡片市場價格隨時間與行情波動，品質定義如下：
                      </p>
                      <ul className="list-disc list-inside ml-2 space-y-1 text-slate-400">
                        <li><strong className="text-white">重大瑕疵：</strong> 卡面嚴重破裂、大面積缺角、明顯摺痕。</li>
                        <li><strong className="text-white">非瑕疵範圍：</strong> 製程微小刮痕 (Surface Scratches)、印刷輕微偏位 (Centering)、正版評級卡盒微痕。</li>
                      </ul>
                    </section>

                    <section className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                      <h4 className="font-bold text-white text-base flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400" /> 3. 售後服務與開箱憑證
                      </h4>
                      <p className="text-slate-400">
                        若收到之實體商品有重大瑕疵或寄錯狀況，請於收到包裹後「7日內」聯繫官方 LINE@ 客服，並附上完整未剪輯之開箱錄影影片作為憑證。經團隊核實後，將安排換貨或點數補助。
                      </p>
                    </section>

                    <section className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                      <h4 className="font-bold text-white text-base flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-400" /> 4. 點數管理與帳號安全
                      </h4>
                      <p className="text-slate-400">
                        平台點數 (P點) 僅限於本平台內部抽賞與購買使用，不可私下轉讓或要求兌換等值現金。若發現利用系統漏洞、惡意刷點或不正當軟體操作，本平台有權終止服務並回收相關異常資產。
                      </p>
                    </section>

                    <p className="pt-2 text-primary font-bold italic text-center text-xs">
                      條款版本：2026年08月05日 最新修訂
                    </p>
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>
        </Card>
      </div>

      {/* 底部標語 */}
      <div className="text-center pt-6 flex flex-col items-center">
        <p className="text-xs text-slate-500 font-headline uppercase tracking-[0.3em]">
          P+CARDER Digital Vault • Authentic Trading Card Platform
        </p>
      </div>
    </div>
  );
}

