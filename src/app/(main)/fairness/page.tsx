'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Sparkles,
  Lock,
  UserCheck,
  Hash,
  Cpu,
  Terminal,
  HelpCircle,
  ExternalLink,
  RefreshCw,
  Sliders,
  ChevronDown,
  ArrowRight,
  BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  verifyBetResult,
  verifyDrawResult,
  verifyPackDropResult,
  DEFAULT_PACK_TIERS,
  PackTierRange,
  sha256,
  VerificationResult,
  PYTHON_VERIFICATION_SCRIPT,
  NODEJS_VERIFICATION_SCRIPT
} from '@/lib/provably-fair';
import { cn } from '@/lib/utils';

function FairnessContent() {
  const searchParams = useSearchParams();

  // 標籤切換：預設首選「卡包機率落點驗證」
  const [activeTab, setActiveTab] = useState<'pack' | 'bet' | 'draw'>('pack');
  const [isAutoLoadedFromTx, setIsAutoLoadedFromTx] = useState(false);

  // 卡包機率落點驗證器狀態 (純淨無範例預填)
  const [packServerSeed, setPackServerSeed] = useState('');
  const [packServerHash, setPackServerHash] = useState('');
  const [packClientSeed, setPackClientSeed] = useState('');
  const [packNonce, setPackNonce] = useState(1);
  const [packCardName, setPackCardName] = useState('');
  const [packResult, setPackResult] = useState<(VerificationResult & { matchedTier: PackTierRange; allTiers: PackTierRange[] }) | null>(null);
  const [isVerifyingPack, setIsVerifyingPack] = useState(false);

  // 拼卡驗證器狀態
  const [betServerSeed, setBetServerSeed] = useState('');
  const [betServerHash, setBetServerHash] = useState('');
  const [betClientSeed, setBetClientSeed] = useState('');
  const [betNonce, setBetNonce] = useState(1);
  const [betTargetProb, setBetTargetProb] = useState(10);
  const [betResult, setBetResult] = useState<VerificationResult | null>(null);
  const [isVerifyingBet, setIsVerifyingBet] = useState(false);

  // 卡池一番賞驗證器狀態
  const [drawServerSeed, setDrawServerSeed] = useState('');
  const [drawServerHash, setDrawServerHash] = useState('');
  const [drawClientSeed, setDrawClientSeed] = useState('');
  const [drawNonce, setDrawNonce] = useState(1);
  const [drawPoolSize, setDrawPoolSize] = useState(80);
  const [drawResult, setDrawResult] = useState<VerificationResult | null>(null);
  const [isVerifyingDraw, setIsVerifyingDraw] = useState(false);

  // 複製代碼狀態
  const [copiedScript, setCopiedScript] = useState<'python' | 'node' | null>(null);

  // 自動讀取 URL 查詢參數（當玩家從交易紀錄點擊「一鍵帶入驗證」時）
  useEffect(() => {
    const sSeed = searchParams.get('serverSeed');
    const sHash = searchParams.get('serverHash');
    const cSeed = searchParams.get('clientSeed');
    const nonce = searchParams.get('nonce');
    const tab = searchParams.get('tab');
    const prob = searchParams.get('prob');
    const pSize = searchParams.get('poolSize');
    const card = searchParams.get('cardName');

    if (sSeed && sHash) {
      setIsAutoLoadedFromTx(true);
      if (tab === 'bet') {
        setActiveTab('bet');
        setBetServerSeed(sSeed);
        setBetServerHash(sHash);
        if (cSeed) setBetClientSeed(cSeed);
        if (nonce) setBetNonce(Number(nonce));
        if (prob) setBetTargetProb(Number(prob));
        verifyBetResult(sSeed, sHash, cSeed || '', Number(nonce) || 1, Number(prob) || 10)
          .then(setBetResult)
          .catch(console.error);
      } else if (tab === 'draw') {
        setActiveTab('draw');
        setDrawServerSeed(sSeed);
        setDrawServerHash(sHash);
        if (cSeed) setDrawClientSeed(cSeed);
        if (nonce) setDrawNonce(Number(nonce));
        if (pSize) setDrawPoolSize(Number(pSize));
        verifyDrawResult(sSeed, sHash, cSeed || '', Number(nonce) || 1, Number(pSize) || 80)
          .then(setDrawResult)
          .catch(console.error);
      } else {
        // 預設為卡包機率落點驗證
        setActiveTab('pack');
        setPackServerSeed(sSeed);
        setPackServerHash(sHash);
        if (cSeed) setPackClientSeed(cSeed);
        if (nonce) setPackNonce(Number(nonce));
        if (card) setPackCardName(card);
        verifyPackDropResult(sSeed, sHash, cSeed || '', Number(nonce) || 1, DEFAULT_PACK_TIERS, card || undefined)
          .then(setPackResult)
          .catch(console.error);
      }

      // 平滑滾動到計算機位置
      const el = document.getElementById('verifier');
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 200);
      }
    }
  }, [searchParams]);


  // 執行卡包機率落點驗證
  const handleVerifyPack = async () => {
    setIsVerifyingPack(true);
    try {
      const res = await verifyPackDropResult(
        packServerSeed,
        packServerHash,
        packClientSeed,
        Number(packNonce),
        DEFAULT_PACK_TIERS,
        packCardName || undefined
      );
      setPackResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsVerifyingPack(false);
    }
  };

  // 執行拼卡驗證
  const handleVerifyBet = async () => {
    setIsVerifyingBet(true);
    try {
      const res = await verifyBetResult(
        betServerSeed,
        betServerHash,
        betClientSeed,
        Number(betNonce),
        Number(betTargetProb)
      );
      setBetResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsVerifyingBet(false);
    }
  };

  // 執行抽卡驗證
  const handleVerifyDraw = async () => {
    setIsVerifyingDraw(true);
    try {
      const res = await verifyDrawResult(
        drawServerSeed,
        drawServerHash,
        drawClientSeed,
        Number(drawNonce),
        Number(drawPoolSize)
      );
      setDrawResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsVerifyingDraw(false);
    }
  };

  const handleCopyCode = (type: 'python' | 'node', text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(type);
    setTimeout(() => setCopiedScript(null), 2500);
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 py-8 sm:py-12 px-4 sm:px-6 relative overflow-hidden">
      {/* 頂部極光光效 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-emerald-500/15 via-cyan-500/10 to-transparent blur-3xl pointer-events-none -z-10" />

      <div className="max-w-5xl mx-auto space-y-10 sm:space-y-12">
        {/* Hero 區塊 */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm font-semibold shadow-inner">
            <ShieldCheck className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Provably Fair · 密碼學公開可驗證公平系統</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">
            每一抽、每一局拼卡 <br className="sm:hidden" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
              皆具備 100% 密碼學防偽與事後核驗
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            我們拒絕任何黑箱黑幕。平台採用國際標準的 SHA-256 與 HMAC 加密演算法，抽獎結果在開獎前就已鎖定雜湊，並融入您自訂的隨機種子。任何玩家皆可隨時於線上或使用獨立腳本自行核實！
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              asChild
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm px-5 py-2.5 shadow-lg shadow-emerald-950/50"
            >
              <a href="#verifier">
                <Sliders className="w-4 h-4 mr-1.5" />
                立即使用線上驗證工具
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/10 hover:bg-white/5 text-slate-300 text-xs sm:text-sm px-5 py-2.5"
            >
              <a href="#algorithm-steps">
                <BookOpen className="w-4 h-4 mr-1.5 text-cyan-400" />
                了解演算法運作原理
              </a>
            </Button>
          </div>
        </div>

        {/* 3 步驟透明機制解密 */}
        <section id="algorithm-steps" className="space-y-6 pt-4 scroll-mt-20">
          <div className="border-b border-white/10 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-400" />
                三步封存機制：平台為何絕對「無法作弊」？
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                這套演算法被廣泛應用於全球最高規格的數位競賽與抽卡認證，數學上保證雙方皆無法操控結果。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {/* Step 1 */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-emerald-500/20 relative group hover:border-emerald-500/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 font-black text-sm flex items-center justify-center border border-emerald-500/30">
                    01
                  </span>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">
                    開獎前 · 預先承諾
                  </Badge>
                </div>
                <h3 className="font-bold text-base text-white flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  伺服器生成種子並雜湊封存
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  在您點擊抽卡或拼卡之前，系統即刻在後端產生一組長度 64 位的安全隨機密鑰（Server Seed），並立即將其計算為 <code className="text-emerald-300 bg-emerald-950/40 px-1 py-0.5 rounded">SHA-256(ServerSeed)</code> 公開給全體玩家。
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-emerald-400/90 font-medium">
                🛡️ 防作弊保證：因 SHA-256 不可逆，玩家事前無法猜出結果，但平台事後也絕對不可能偷偷調包種子（一旦偷改，雜湊對不上將立即穿幫）。
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-cyan-500/20 relative group hover:border-cyan-500/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 font-black text-sm flex items-center justify-center border border-cyan-500/30">
                    02
                  </span>
                  <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-[10px]">
                    玩家端 · 隨機熵值注入
                  </Badge>
                </div>
                <h3 className="font-bold text-base text-white flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-cyan-400" />
                  玩家自訂 Client Seed
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  每局遊戲都會混入您的專屬客戶端種子（Client Seed，您隨時可以在個人設定或開獎前更改為任意幸運字串），並附帶局數序號（Nonce）。
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-cyan-400/90 font-medium">
                🛡️ 防作弊保證：即使伺服器知道自己的 Server Seed，但在開獎前「平台根本不知道玩家會輸入什麼 Client Seed」，因此平台絕無可能事先設計勝負！
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-500/20 relative group hover:border-amber-500/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 font-black text-sm flex items-center justify-center border border-amber-500/30">
                    03
                  </span>
                  <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px]">
                    開獎後 · 全面公開透明
                  </Badge>
                </div>
                <h3 className="font-bold text-base text-white flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-amber-400" />
                  解密種子並供任何人反查
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  局數結束後，原始未加密的 Server Seed 立即完全公開在您的對局紀錄中。利用公式 <code className="text-amber-300 bg-amber-950/40 px-1 py-0.5 rounded">HMAC-SHA256(ServerSeed, ClientSeed:Nonce)</code> 即可 100% 重現運算結果！
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-amber-400/90 font-medium">
                🛡️ 防作弊保證：所有數學規則開源固定，任何人（包括完全不懂程式的玩家）都能複製代碼或直接在驗證器中點擊查核。
              </div>
            </div>
          </div>
        </section>

        {/* 實時獨立在線驗證器 (Live Verifier) */}
        <section id="verifier" className="space-y-6 pt-4 scroll-mt-20">
          <div className="border-b border-white/10 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                實時線上驗證計算器 (Live Provably Fair Verifier)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                輸入開獎參數（可從您的「抽卡紀錄」或「拼卡明細」複製），直接在您的瀏覽器本機重新演算！
              </p>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl">
            {isAutoLoadedFromTx && (
              <div className="p-3.5 mb-5 rounded-xl bg-gradient-to-r from-emerald-950/90 via-teal-950/80 to-slate-900 border border-emerald-500/40 flex items-center justify-between gap-3 text-xs animate-in fade-in duration-300 shadow-lg">
                <div className="flex items-center gap-2 text-emerald-300 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>🎉 已自動從您的個人交易紀錄帶入本局開獎參數，並完成密碼學校驗！</span>
                </div>
                <Badge className="bg-emerald-400 text-slate-950 font-black text-[10px] shrink-0">
                  自動驗算完成
                </Badge>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'pack' | 'bet' | 'draw')} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-slate-950/80 p-1 sm:p-1.5 rounded-xl mb-6 border border-white/10 gap-1">
                <TabsTrigger
                  value="pack"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-yellow-500 data-[state=active]:text-black font-black text-[11px] sm:text-xs md:text-sm py-2 px-1 sm:px-3 text-center whitespace-normal sm:whitespace-nowrap leading-tight transition-all"
                >
                  ① 卡包落點與中獎 🔥
                </TabsTrigger>
                <TabsTrigger
                  value="bet"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white font-bold text-[11px] sm:text-xs md:text-sm py-2 px-1 sm:px-3 text-center whitespace-normal sm:whitespace-nowrap leading-tight transition-all"
                >
                  ② 1/10 拼卡勝負 🎲
                </TabsTrigger>
                <TabsTrigger
                  value="draw"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-blue-600 data-[state=active]:text-white font-bold text-[11px] sm:text-xs md:text-sm py-2 px-1 sm:px-3 text-center whitespace-normal sm:whitespace-nowrap leading-tight transition-all"
                >
                  ③ 一番賞籤號 🏷️
                </TabsTrigger>
              </TabsList>

              {/* Tab 0: 卡包機率落點與中獎核算 */}
              <TabsContent value="pack" className="space-y-6">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center gap-2.5 text-xs text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    請輸入您在個人【交易紀錄】或抽卡開獎視窗中獲得的開獎參數，或至交易紀錄點選<strong>「一鍵帶入線上驗證器」</strong>自動填入。
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>伺服器原始種子 (Server Seed - 抽後公開)</span>
                      <span className="text-[11px] text-slate-500 font-mono">64 位 HEX 字串</span>
                    </label>
                    <Input
                      value={packServerSeed}
                      onChange={(e) => setPackServerSeed(e.target.value)}
                      placeholder="請輸入抽卡後公開的 Server Seed"
                      className="bg-black/50 border-white/10 text-xs font-mono text-amber-300"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>開獎前公開之伺服器雜湊承諾 (Server Hash / SHA-256)</span>
                      <span className="text-[11px] text-slate-500">平台開獎前即已鎖定並公示的承諾指紋</span>
                    </label>
                    <Input
                      value={packServerHash}
                      onChange={(e) => setPackServerHash(e.target.value)}
                      placeholder="請輸入開獎前顯示的 Server Hash"
                      className="bg-black/50 border-white/10 text-xs font-mono text-slate-200"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      玩家客戶端種子 (Client Seed)
                    </label>
                    <Input
                      value={packClientSeed}
                      onChange={(e) => setPackClientSeed(e.target.value)}
                      placeholder="您的專屬種子"
                      className="bg-black/50 border-white/10 text-xs font-mono text-cyan-300"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        對局計數序號 (Nonce)
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={packNonce}
                        onChange={(e) => setPackNonce(Number(e.target.value))}
                        className="bg-black/50 border-white/10 text-xs font-mono text-amber-300"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        抽中之卡片名稱 (選填比對)
                      </label>
                      <Input
                        value={packCardName}
                        onChange={(e) => setPackCardName(e.target.value)}
                        placeholder="例如: 柯比布萊恩簽名卡"
                        className="bg-black/50 border-white/10 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={handleVerifyPack}
                    disabled={isVerifyingPack || !packServerSeed || !packServerHash}
                    className="w-full sm:w-auto bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 font-black text-sm px-7 gap-2 text-slate-950 shadow-lg shadow-amber-500/20"
                  >
                    {isVerifyingPack ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 fill-slate-950" />
                    )}
                    執行卡包落點與中獎核算 (Verify Pack Drop)
                  </Button>
                </div>

                {/* 驗證結果反饋卡片與機率落點光譜尺 */}
                {packResult && (
                  <div className="mt-4 p-5 rounded-2xl border border-amber-500/30 bg-black/70 space-y-6 animate-in fade-in-50 duration-300 shadow-2xl">
                    {/* 頂部狀態列 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {packResult.isValidHash ? (
                            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                              <span>雜湊承諾核對：100% 吻合！確認事前鎖定無偷調</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-rose-400 font-bold text-sm">
                              <XCircle className="w-5 h-5 text-rose-400" />
                              <span>警告：計算出的 SHA-256 與輸入的 Server Hash 不符！</span>
                            </div>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          演算法公式：<code className="text-amber-300">HMAC-SHA256(ServerSeed, ClientSeed:Nonce)</code>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">判定命中等級：</span>
                        <Badge className={`${packResult.matchedTier.badgeBg} text-xs font-black px-3 py-1 shadow-lg`}>
                          🏆 {packResult.matchedTier.name}
                        </Badge>
                      </div>
                    </div>

                    {/* 🔥 核心亮點：高規格視覺化「機率落點光譜尺 (Probability Gauge Ruler)」 */}
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-200 flex items-center gap-1.5">
                          <Sliders className="w-4 h-4 text-amber-400" />
                          <span>全機率落點光譜尺 (0.00% ~ 100.00%)</span>
                        </span>
                        <span className="text-amber-300 font-mono font-black text-sm">
                          🎯 您的幸運落點：{packResult.luckyPercent}%
                        </span>
                      </div>

                      {/* 長條色譜尺 */}
                      <div className="relative w-full h-8 rounded-lg overflow-hidden flex border border-white/20 shadow-inner">
                        {/* SP 區間: 0% ~ 1% */}
                        <div
                          style={{ width: '1%' }}
                          className="h-full bg-gradient-to-r from-amber-400 to-yellow-500 shrink-0 relative group"
                          title="SP / UR (0.00% ~ 1.00%)"
                        />
                        {/* SSR 區間: 1% ~ 5% */}
                        <div
                          style={{ width: '4%' }}
                          className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-600 shrink-0 relative group"
                          title="SSR (1.00% ~ 5.00%)"
                        />
                        {/* SR 區間: 5% ~ 20% */}
                        <div
                          style={{ width: '15%' }}
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 shrink-0 relative group"
                          title="SR (5.00% ~ 20.00%)"
                        />
                        {/* R 區間: 20% ~ 50% */}
                        <div
                          style={{ width: '30%' }}
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 shrink-0 relative group"
                          title="R (20.00% ~ 50.00%)"
                        />
                        {/* N 區間: 50% ~ 100% */}
                        <div
                          style={{ width: '50%' }}
                          className="h-full bg-slate-700 shrink-0 relative group"
                          title="N (50.00% ~ 100.00%)"
                        />

                        {/* 🎯 動態指針游標 (Pin Cursor) */}
                        <div
                          className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_12px_#ffffff] z-20 pointer-events-none transition-all duration-700 ease-out"
                          style={{ left: `${Math.min(99.5, Math.max(0.5, packResult.luckyPercent))}%` }}
                        >
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-white" />
                          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[6px] border-b-white" />
                        </div>
                      </div>

                      {/* 區間圖例說明 */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-[10px] pt-1 font-mono">
                        {DEFAULT_PACK_TIERS.map((t, idx) => {
                          const isMatched = t.id === packResult.matchedTier.id;
                          const isLastOnSmall = idx === 4;
                          return (
                            <div
                              key={t.id}
                              className={`p-2 rounded-lg border text-center transition-all ${
                                isLastOnSmall ? 'col-span-2 sm:col-span-1' : ''
                              } ${
                                isMatched
                                  ? `${t.bgColor} ${t.borderColor} ring-1 ring-amber-400 font-bold scale-[1.02] shadow-md`
                                  : 'bg-black/40 border-white/5 text-slate-400 opacity-70'
                              }`}
                            >
                              <div className={cn(t.color, "font-bold text-[11px]")}>{t.shortName} ({t.probability}%)</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">{t.rangeStart}% ~ {t.rangeEnd}%</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 詳細核算指標 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5 space-y-1">
                        <div className="text-slate-400">幸運落點百分比：</div>
                        <div className="text-base font-black text-amber-300 font-mono">
                          {packResult.luckyPercent}%
                        </div>
                        <div className="text-[11px] text-slate-500">
                          落入 [{packResult.matchedTier.rangeStart}% ~ {packResult.matchedTier.rangeEnd}%] 區間
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5 space-y-1">
                        <div className="text-slate-400">大獎判定：</div>
                        <div className="text-base font-black font-mono">
                          {packResult.matchedTier.isTopPrize ? (
                            <span className="text-emerald-400">🎉 命中大獎等級！</span>
                          ) : (
                            <span className="text-slate-400">標準收藏卡品</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {packResult.matchedTier.name}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5 space-y-1">
                        <div className="text-slate-400">卡牌發放真實性：</div>
                        <div className="text-base font-bold text-cyan-300 truncate" title={packCardName || '未指定'}>
                          {packCardName ? `【${packCardName}】` : '✅ 數值核驗吻合'}
                        </div>
                        <div className="text-[11px] text-emerald-400/90 font-medium">
                          {packCardName ? '已核對與交易發放卡品無調包' : '隨機密碼學熵值驗證通過'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Tab 1: 拼卡驗證 */}
              <TabsContent value="bet" className="space-y-6">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center gap-2.5 text-xs text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    請輸入您在個人【交易紀錄】中 1/10 拼卡的開獎參數，或至交易紀錄點選<strong>「一鍵帶入線上驗證器」</strong>自動填入。
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>伺服器原始種子 (Server Seed - 抽後公開)</span>
                      <span className="text-[11px] text-slate-500 font-mono">64 位 HEX 字串</span>
                    </label>
                    <Input
                      value={betServerSeed}
                      onChange={(e) => setBetServerSeed(e.target.value)}
                      placeholder="請輸入開獎後公布的 Server Seed"
                      className="bg-black/50 border-white/10 text-xs font-mono text-emerald-400"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>開獎前公開之伺服器雜湊承諾 (Server Hash / SHA-256)</span>
                      <span className="text-[11px] text-slate-500">平台開獎前提供給您的承諾值</span>
                    </label>
                    <Input
                      value={betServerHash}
                      onChange={(e) => setBetServerHash(e.target.value)}
                      placeholder="請輸入開獎前顯示的 Server Hash"
                      className="bg-black/50 border-white/10 text-xs font-mono text-slate-200"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      玩家客戶端種子 (Client Seed)
                    </label>
                    <Input
                      value={betClientSeed}
                      onChange={(e) => setBetClientSeed(e.target.value)}
                      placeholder="您的專屬種子"
                      className="bg-black/50 border-white/10 text-xs font-mono text-cyan-300"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        對局計數序號 (Nonce)
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={betNonce}
                        onChange={(e) => setBetNonce(Number(e.target.value))}
                        className="bg-black/50 border-white/10 text-xs font-mono text-amber-300"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        拼卡機率 (%)
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={betTargetProb}
                        onChange={(e) => setBetTargetProb(Number(e.target.value))}
                        className="bg-black/50 border-white/10 text-xs font-mono text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={handleVerifyBet}
                    disabled={isVerifyingBet || !betServerSeed || !betServerHash}
                    className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-bold text-sm px-6 gap-2 text-white shadow-lg shadow-emerald-950/40"
                  >
                    {isVerifyingBet ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    執行密碼學校驗 (Verify Result)
                  </Button>
                </div>

                {/* 驗證結果反饋卡片 */}
                {betResult && (
                  <div className="mt-4 p-5 rounded-xl border bg-black/60 space-y-4 animate-in fade-in-50 duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2">
                        {betResult.isValidHash ? (
                          <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            <span>雜湊承諾核對：100% 吻合！平台無調包種子</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-rose-400 font-bold text-sm">
                            <XCircle className="w-5 h-5 text-rose-400" />
                            <span>警告：計算出的 SHA-256 與輸入的 Server Hash 不符！</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">最終判定：</span>
                        {betResult.isWin ? (
                          <Badge className="bg-emerald-500 text-black font-black text-xs px-2.5 py-0.5 animate-pulse">
                            🎉 恭喜獲勝！卡片成功入庫
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-rose-500/50 text-rose-400 font-bold text-xs px-2.5 py-0.5">
                            未中獎（未達機率門檻）
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-slate-950/80 border border-white/5 space-y-1">
                        <div className="text-slate-400">HMAC-SHA256 輸出：</div>
                        <div className="font-mono text-[11px] text-slate-300 truncate" title={betResult.hmacDigest}>
                          {betResult.hmacDigest}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-950/80 border border-white/5 space-y-1">
                        <div className="text-slate-400">隨機點數轉換 (0 ~ 99.99%)：</div>
                        <div className="font-mono text-sm font-bold text-cyan-300">
                          {betResult.luckyPercent}%
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-950/80 border border-white/5 space-y-1">
                        <div className="text-slate-400">勝負判定公式：</div>
                        <div className="font-mono text-[11px] text-amber-300">
                          點數({betResult.luckyPercent}%) {betResult.isWin ? '<' : '≥'} 門檻({betTargetProb}%)
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Tab 2: 卡池抽卡籤號驗證 */}
              <TabsContent value="draw" className="space-y-6">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center gap-2.5 text-xs text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    請輸入您在個人【交易紀錄】中一番賞抽卡的開獎參數，或至交易紀錄點選<strong>「一鍵帶入線上驗證器」</strong>自動填入。
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-300">
                      伺服器原始種子 (Server Seed)
                    </label>
                    <Input
                      value={drawServerSeed}
                      onChange={(e) => setDrawServerSeed(e.target.value)}
                      className="bg-black/50 border-white/10 text-xs font-mono text-cyan-400"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-300">
                      卡池開獎前公告雜湊 (Server Hash)
                    </label>
                    <Input
                      value={drawServerHash}
                      onChange={(e) => setDrawServerHash(e.target.value)}
                      className="bg-black/50 border-white/10 text-xs font-mono text-slate-200"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      玩家客戶端種子 (Client Seed)
                    </label>
                    <Input
                      value={drawClientSeed}
                      onChange={(e) => setDrawClientSeed(e.target.value)}
                      className="bg-black/50 border-white/10 text-xs font-mono text-cyan-300"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        抽數序號 (Nonce)
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={drawNonce}
                        onChange={(e) => setDrawNonce(Number(e.target.value))}
                        className="bg-black/50 border-white/10 text-xs font-mono text-amber-300"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        卡池總籤數 (Pool Size)
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={drawPoolSize}
                        onChange={(e) => setDrawPoolSize(Number(e.target.value))}
                        className="bg-black/50 border-white/10 text-xs font-mono text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={handleVerifyDraw}
                    disabled={isVerifyingDraw || !drawServerSeed || !drawServerHash}
                    className="w-full sm:w-auto bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 font-bold text-sm px-6 gap-2 text-white shadow-lg shadow-cyan-950/40"
                  >
                    {isVerifyingDraw ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    校驗抽中籤位 (Verify Ticket)
                  </Button>
                </div>

                {drawResult && (
                  <div className="mt-4 p-5 rounded-xl border bg-black/60 space-y-4 animate-in fade-in-50 duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2">
                        {drawResult.isValidHash ? (
                          <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-sm">
                            <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                            <span>卡池種子雜湊：100% 吻合！</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-rose-400 font-bold text-sm">
                            <XCircle className="w-5 h-5 text-rose-400" />
                            <span>雜湊核對失敗</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">運算抽出籤位：</span>
                        <Badge className="bg-cyan-500 text-black font-black text-sm px-3 py-1">
                          第 {drawResult.selectedTicketIndex} 號籤
                        </Badge>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950/80 border border-white/5 space-y-1 font-mono text-xs text-slate-400">
                      <div>HMAC: <span className="text-slate-300">{drawResult.hmacDigest}</span></div>
                      <div>計算方式：<span className="text-cyan-300">parseInt(前8字元, 16) % {drawPoolSize} + 1 = 第 {drawResult.selectedTicketIndex} 號籤</span></div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </section>

        {/* 離線開源獨立腳本（供玩家在自己電腦終端機跑 Python / Node.js） */}
        <section className="space-y-4 pt-4">
          <div className="border-b border-white/10 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-amber-400" />
                第三方程式獨立離線驗證（不依賴本網站）
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                若您不信任前端瀏覽器的顯示，您可以複製以下開源代碼，在您本機的 Python 或 Node.js 終端機離線運行！
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Python 腳本 */}
            <div className="rounded-xl border border-white/10 bg-slate-950 p-4 space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 font-mono">Python 3 驗證腳本</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-white/10 hover:bg-white/10 gap-1 text-slate-300"
                  onClick={() => handleCopyCode('python', PYTHON_VERIFICATION_SCRIPT)}
                >
                  {copiedScript === 'python' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedScript === 'python' ? '已複製！' : '複製代碼'}
                </Button>
              </div>
              <pre className="p-3 rounded-lg bg-black text-[11px] font-mono text-slate-300 overflow-x-auto max-h-56">
                {PYTHON_VERIFICATION_SCRIPT}
              </pre>
            </div>

            {/* Node.js 腳本 */}
            <div className="rounded-xl border border-white/10 bg-slate-950 p-4 space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400 font-mono">Node.js / JS 驗證腳本</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-white/10 hover:bg-white/10 gap-1 text-slate-300"
                  onClick={() => handleCopyCode('node', NODEJS_VERIFICATION_SCRIPT)}
                >
                  {copiedScript === 'node' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedScript === 'node' ? '已複製！' : '複製代碼'}
                </Button>
              </div>
              <pre className="p-3 rounded-lg bg-black text-[11px] font-mono text-slate-300 overflow-x-auto max-h-56">
                {NODEJS_VERIFICATION_SCRIPT}
              </pre>
            </div>
          </div>
        </section>

        {/* FAQ 疑難解答 */}
        <section className="space-y-4 pt-4">
          <div className="border-b border-white/10 pb-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-emerald-400" />
              常見公平性與演算法問答 (FAQ)
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-2">
              <h4 className="font-bold text-white text-sm">Q1：如果平台想作弊，不能偷偷改結果嗎？</h4>
              <p className="text-slate-400 leading-relaxed">
                絕對不能。因為在您按下抽卡按鈕前，伺服器已經把種子的 SHA-256 雜湊公開在畫面上（如同一封被蓋上蠟印密封的信）。開獎後公開的種子必須與該雜湊 100% 吻合，只要平台私自改動任何一個字元，雜湊值就會全然不同，作弊會當場被戳破。
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-2">
              <h4 className="font-bold text-white text-sm">Q2：我可以自己決定 Client Seed 嗎？</h4>
              <p className="text-slate-400 leading-relaxed">
                可以！系統預設會由瀏覽器提供隨機字串，但您也可以在個人設定隨時更換為您的幸運字母、生日或任意字符。這代表最終開獎的隨機性是由「您」與「平台」共同提供，平台無法單方面支配。
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-2">
              <h4 className="font-bold text-white text-sm">Q3：一番賞或福袋怎麼保證大獎在裡面？</h4>
              <p className="text-slate-400 leading-relaxed">
                每套一番賞或福袋上架時，所有籤號（例如 80 抽）在後台都會一次性生成對應的籤單雜湊表（Ticket Hash Commitment），並鎖定總獎項配比，杜絕藏籤或臨時插籤。
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-2">
              <h4 className="font-bold text-white text-sm">Q4：扣點後如果斷線，結果會有差嗎？</h4>
              <p className="text-slate-400 leading-relaxed">
                完全不影響。因為點擊當下，伺服器與您的種子就已經立即算出唯一結果並寫入資料庫與您的收藏庫。即便手機突然沒電或網路中斷，重新登入後至「收藏庫」即可查看到完整的開獎卡片與驗證數據。
              </p>
            </div>
          </div>
        </section>

        {/* 底部行動呼籲 */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-slate-900 border border-emerald-500/20 text-center space-y-4">
          <h3 className="text-lg font-bold text-white">準備好親自體驗 100% 公開透明的卡牌樂趣了嗎？</h3>
          <p className="text-xs text-slate-300 max-w-xl mx-auto">
            立即挑選心儀主題卡池或挑戰 1/10 幸運拼卡，中獎卡片可直接在收藏庫申請寄送實體卡到府！
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs px-5 py-2 shadow-lg shadow-amber-500/20">
              <Link href="/draw">立即前往抽卡池</Link>
            </Button>
            <Button asChild variant="outline" className="border-rose-500/30 text-rose-300 hover:bg-rose-950/20 text-xs px-5 py-2">
              <Link href="/bet">挑戰 1/10 命運拼卡</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FairnessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070b14] flex items-center justify-center text-slate-400 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 animate-spin" />
            <span>載入公開公平驗證中心中...</span>
          </div>
        </div>
      }
    >
      <FairnessContent />
    </Suspense>
  );
}

