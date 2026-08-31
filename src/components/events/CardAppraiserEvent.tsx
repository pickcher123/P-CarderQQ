'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
    Eye, 
    Trophy, 
    Sparkles, 
    Flame, 
    Users, 
    User, 
    RotateCcw, 
    CheckCircle2, 
    AlertCircle, 
    Plus, 
    Crown, 
    ShieldCheck, 
    HelpCircle, 
    ArrowRight, 
    Timer, 
    DollarSign, 
    TrendingUp, 
    Swords, 
    Award,
    Share2,
    Volume2,
    VolumeX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface AppraiserCardItem {
    id: string;
    name: string;
    sportCategory: 'MLB' | 'NBA' | 'PTCG' | 'NFL' | 'WNBA' | 'SOCCER';
    year: string;
    brand: string;
    grade: string;
    highlight: string;
    realPriceUSD: number;
    realPriceNTD: number;
    description: string;
    auctionSource: string;
}

export const FAMOUS_CARDS_DATA: AppraiserCardItem[] = [
    {
        id: 'card-1',
        name: '2003-04 Topps Chrome LeBron James 新秀卡 #111',
        sportCategory: 'NBA',
        year: '2003',
        brand: 'Topps Chrome',
        grade: 'PSA 10 Gem Mint',
        highlight: '小皇帝生涯最經典主流 RC 折射鑑定滿分',
        realPriceUSD: 18500,
        realPriceNTD: 592000,
        description: '2003 梯選秀之王 LeBron James 最具指標性的 Chrome 系列新秀卡，PSA 10 滿分存世量極為珍稀。',
        auctionSource: 'PWCC Premier Auction 2024 近期成交'
    },
    {
        id: 'card-2',
        name: '2018 Bowman Chrome 大谷翔平 Rookie Auto 橘折 /25',
        sportCategory: 'MLB',
        year: '2018',
        brand: 'Bowman Chrome',
        grade: 'BGS 9.5 (Auto 10)',
        highlight: '天使隊新人年 1st 限量 25 張親筆簽名橘折',
        realPriceUSD: 36000,
        realPriceNTD: 1152000,
        description: '大谷翔平 MLB 首年簽名卡天花板之一，全壘打+MVP 歷史級巨星價值支撐。',
        auctionSource: 'Goldin Auctions 2024 結標'
    },
    {
        id: 'card-3',
        name: '1999 Pokemon Base Set 初版無暗影噴火龍 Holo',
        sportCategory: 'PTCG',
        year: '1999',
        brand: 'Wizards of the Coast',
        grade: 'PSA 9 Mint',
        highlight: '寶可夢卡牌界最高聖杯 1st Edition Shadowless',
        realPriceUSD: 22000,
        realPriceNTD: 704000,
        description: '1999 年初版無影噴火龍，無數藏家畢生夢幻逸品，PSA 9 拍賣市場長年熱門焦點。',
        auctionSource: 'Heritage Auctions 2024 結標'
    },
    {
        id: 'card-4',
        name: '2023-24 Panini Prizm Victor Wembanyama 銀折 RC #136',
        sportCategory: 'NBA',
        year: '2023',
        brand: 'Panini Prizm',
        grade: 'PSA 10 Gem Mint',
        highlight: '斑馬超級狀元新人年最主流 Silver Prizm 鑑定滿分',
        realPriceUSD: 1450,
        realPriceNTD: 46400,
        description: '現代籃球最受矚目超新星 Wembanyama 的標誌性銀折卡，卡展流通度第一名。',
        auctionSource: 'eBay Authenticity Guaranteed 近期結標'
    },
    {
        id: 'card-5',
        name: '1986-87 Fleer Michael Jordan 新秀卡 #57',
        sportCategory: 'NBA',
        year: '1986',
        brand: 'Fleer',
        grade: 'PSA 9 Mint',
        highlight: '籃球之神喬丹無可替代的最偉大新秀卡',
        realPriceUSD: 16000,
        realPriceNTD: 512000,
        description: '所有球卡收藏家的終極信仰，無可撼動的體育卡牌歷史最高象徵。',
        auctionSource: 'Robert Edward Auctions 2024 結標'
    },
    {
        id: 'card-6',
        name: '1996-97 Topps Chrome Kobe Bryant 新秀卡 #138',
        sportCategory: 'NBA',
        year: '1996',
        brand: 'Topps Chrome',
        grade: 'PSA 10 Gem Mint',
        highlight: '黑曼巴傳奇生涯首款 Topps Chrome 新秀卡',
        realPriceUSD: 6500,
        realPriceNTD: 208000,
        description: 'Kobe 菜鳥年最具升值保值力的傳奇卡款，PSA 10 滿分極度搶手。',
        auctionSource: 'PWCC Weekly Auction 近期結標'
    },
    {
        id: 'card-7',
        name: '2022 PTCG 寶可夢日版 莉莉艾 SR 繁中限定鑑定卡',
        sportCategory: 'PTCG',
        year: '2022',
        brand: 'Pokemon Card Game',
        grade: 'PSA 10 Gem Mint',
        highlight: '亞洲女性訓練家卡牌人氣霸主 滿分收藏',
        realPriceUSD: 3200,
        realPriceNTD: 102400,
        description: 'PTCG 亞洲卡展交易量最大的傳奇角色卡之一，卡況挑剔極具收藏溢價。',
        auctionSource: '秋葉原卡展現場國際成交價'
    }
];

export function CardAppraiserEvent() {
    const { toast } = useToast();
    
    // 模式選擇：單人競猜 / 雙人現場 PK
    const [gameMode, setGameMode] = useState<'solo' | 'duel'>('solo');
    const [currency, setCurrency] = useState<'NTD' | 'USD'>('NTD');

    // 遊戲題目進度
    const [questionIndex, setQuestionIndex] = useState<number>(0);
    const [cardList, setCardList] = useState<AppraiserCardItem[]>(FAMOUS_CARDS_DATA);
    const [timerSeconds, setTimerSeconds] = useState<number>(20);
    const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

    // 玩家猜價輸入
    const [soloGuessInput, setSoloGuessInput] = useState<string>('');
    const [duelPlayer1Name, setDuelPlayer1Name] = useState<string>('玩家 1 (主播/挑戰者)');
    const [duelPlayer2Name, setDuelPlayer2Name] = useState<string>('玩家 2 (現場觀眾)');
    const [duelPlayer1Guess, setDuelPlayer1Guess] = useState<string>('');
    const [duelPlayer2Guess, setDuelPlayer2Guess] = useState<string>('');

    // 揭曉狀態
    const [isRevealed, setIsRevealed] = useState<boolean>(false);
    const [soloScoreHistory, setSoloScoreHistory] = useState<{ cardName: string; real: number; guess: number; accuracy: number; points: number }[]>([]);

    // 自訂題目彈窗
    const [isCustomModalOpen, setIsCustomModalOpen] = useState<boolean>(false);
    const [customCardName, setCustomCardName] = useState('');
    const [customGrade, setCustomGrade] = useState('PSA 10');
    const [customHighlight, setCustomHighlight] = useState('');
    const [customPriceNTD, setCustomPriceNTD] = useState('');

    const currentCard = cardList[questionIndex] || cardList[0];

    // 計時器機制
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isTimerRunning && timerSeconds > 0) {
            interval = setInterval(() => {
                setTimerSeconds(prev => prev - 1);
            }, 1000);
        } else if (timerSeconds === 0 && isTimerRunning) {
            setIsTimerRunning(false);
            handleRevealPrice();
            toast({
                title: '⏰ 時間到！即時揭曉真實成交價！',
                description: '請查看本次競猜的精準度評級！'
            });
        }
        return () => clearInterval(interval);
    }, [isTimerRunning, timerSeconds]);

    // 開始新一題
    const handleStartQuestion = () => {
        setIsRevealed(false);
        setSoloGuessInput('');
        setDuelPlayer1Guess('');
        setDuelPlayer2Guess('');
        setTimerSeconds(20);
        setIsTimerRunning(true);
    };

    // 計算精準度公式
    const calculateAccuracy = (guess: number, real: number) => {
        if (guess <= 0 || real <= 0) return 0;
        const diff = Math.abs(guess - real);
        const ratio = diff / real;
        const accuracy = Math.max(0, Math.min(100, Math.round((1 - ratio) * 100)));
        return accuracy;
    };

    // 揭曉答案
    const handleRevealPrice = () => {
        setIsTimerRunning(false);
        setIsRevealed(true);

        const realVal = currency === 'NTD' ? currentCard.realPriceNTD : currentCard.realPriceUSD;

        if (gameMode === 'solo') {
            const guessVal = parseFloat(soloGuessInput.replace(/,/g, '')) || 0;
            const acc = calculateAccuracy(guessVal, realVal);
            const pts = Math.round(acc * 10);

            setSoloScoreHistory(prev => [
                ...prev,
                {
                    cardName: currentCard.name,
                    real: realVal,
                    guess: guessVal,
                    accuracy: acc,
                    points: pts
                }
            ]);

            if (acc >= 90) {
                confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
            }
        } else {
            const p1Val = parseFloat(duelPlayer1Guess.replace(/,/g, '')) || 0;
            const p2Val = parseFloat(duelPlayer2Guess.replace(/,/g, '')) || 0;
            const diff1 = Math.abs(p1Val - realVal);
            const diff2 = Math.abs(p2Val - realVal);

            if (diff1 < diff2) {
                confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
            } else if (diff2 < diff1) {
                confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
            }
        }
    };

    // 下一題
    const handleNextQuestion = () => {
        const nextIdx = (questionIndex + 1) % cardList.length;
        setQuestionIndex(nextIdx);
        setIsRevealed(false);
        setSoloGuessInput('');
        setDuelPlayer1Guess('');
        setDuelPlayer2Guess('');
        setTimerSeconds(20);
        setIsTimerRunning(true);
    };

    // 快速填入倍率按鈕
    const handleQuickAddValue = (target: 'solo' | 'p1' | 'p2', amount: number) => {
        if (target === 'solo') {
            const current = parseFloat(soloGuessInput.replace(/,/g, '')) || 0;
            setSoloGuessInput((current + amount).toLocaleString());
        } else if (target === 'p1') {
            const current = parseFloat(duelPlayer1Guess.replace(/,/g, '')) || 0;
            setDuelPlayer1Guess((current + amount).toLocaleString());
        } else {
            const current = parseFloat(duelPlayer2Guess.replace(/,/g, '')) || 0;
            setDuelPlayer2Guess((current + amount).toLocaleString());
        }
    };

    // 自訂卡片加入
    const handleAddCustomCard = () => {
        if (!customCardName || !customPriceNTD) {
            toast({ title: '請填寫卡片名稱與拍賣價格', variant: 'destructive' });
            return;
        }
        const priceNum = parseFloat(customPriceNTD.replace(/,/g, '')) || 50000;
        const newCard: AppraiserCardItem = {
            id: 'custom-' + Date.now(),
            name: customCardName,
            sportCategory: 'NBA',
            year: new Date().getFullYear().toString(),
            brand: 'Custom Exhibition Set',
            grade: customGrade || 'PSA 10',
            highlight: customHighlight || '卡展現場實體展售卡片',
            realPriceNTD: priceNum,
            realPriceUSD: Math.round(priceNum / 32),
            description: '卡展攤位現場特選競猜卡片。',
            auctionSource: '卡展現場攤位真實行情'
        };

        setCardList([newCard, ...cardList]);
        setQuestionIndex(0);
        setIsCustomModalOpen(false);
        toast({
            title: '✨ 已成功上架自訂競猜卡片！',
            description: `「${newCard.name}」已設為目前競猜題目！`
        });
    };

    const targetPrice = currency === 'NTD' ? currentCard.realPriceNTD : currentCard.realPriceUSD;
    const currencyUnit = currency === 'NTD' ? 'NT$ (新台幣)' : 'USD (美金)';

    return (
        <div className="space-y-6">
            {/* 頂部橫幅 */}
            <div className="p-5 sm:p-7 rounded-3xl bg-gradient-to-br from-slate-900/95 via-[#0b191a]/95 to-slate-950/95 border-2 border-emerald-500/40 shadow-[0_0_40px_rgba(16,185,129,0.2)] backdrop-blur-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                                <Eye className="w-5 h-5" />
                            </span>
                            <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs px-2.5 shadow-md">
                                卡展互動必備 🌟
                            </Badge>
                            <Badge className="bg-slate-800 text-slate-300 border-white/10 text-xs font-mono">
                                題庫進度：第 {questionIndex + 1} / {cardList.length} 題
                            </Badge>
                        </div>

                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
                            👑 卡展估價王・神之眼價格大競猜
                        </h2>

                        <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
                            考驗卡迷鑑賞實力！現場展示 PSA 10 頂級球星卡與神級動漫卡，限時猜出近期國際拍賣成交天價！
                        </p>
                    </div>

                    {/* 模式與幣別切換 */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* 幣別切換 */}
                        <div className="flex items-center bg-slate-950/80 p-1 rounded-2xl border border-white/10">
                            <button
                                onClick={() => setCurrency('NTD')}
                                className={cn(
                                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                                    currency === 'NTD' ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"
                                )}
                            >
                                台幣 (NTD)
                            </button>
                            <button
                                onClick={() => setCurrency('USD')}
                                className={cn(
                                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                                    currency === 'USD' ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"
                                )}
                            >
                                美金 (USD)
                            </button>
                        </div>

                        {/* 遊戲模式切換 */}
                        <div className="flex items-center bg-slate-950/80 p-1 rounded-2xl border border-white/10">
                            <button
                                onClick={() => { setGameMode('solo'); setIsRevealed(false); }}
                                className={cn(
                                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                                    gameMode === 'solo' ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"
                                )}
                            >
                                <User className="w-3.5 h-3.5" /> 單人考驗
                            </button>
                            <button
                                onClick={() => { setGameMode('duel'); setIsRevealed(false); }}
                                className={cn(
                                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                                    gameMode === 'duel' ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"
                                )}
                            >
                                <Swords className="w-3.5 h-3.5" /> 雙人 PK 對決
                            </button>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsCustomModalOpen(true)}
                            className="rounded-xl border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-xs font-bold"
                        >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            攤位自訂卡片
                        </Button>
                    </div>
                </div>
            </div>

            {/* 題目展示卡與估價互動區 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* 左側：卡片特寫與權威評級資料展示 (5 Cols) */}
                <div className="lg:col-span-5 space-y-4">
                    <div className="p-6 rounded-3xl bg-slate-900/90 border-2 border-emerald-500/30 shadow-xl backdrop-blur-xl relative overflow-hidden">
                        {/* 頂部分類與年份 */}
                        <div className="flex items-center justify-between mb-4">
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-xs font-bold px-2.5">
                                {currentCard.sportCategory} 頂級名卡
                            </Badge>
                            <Badge className="bg-slate-800 text-slate-300 font-mono text-xs">
                                發行年份：{currentCard.year}
                            </Badge>
                        </div>

                        {/* 鑑定卡頂級評級金標 */}
                        <div className="my-4 p-4 rounded-2xl bg-gradient-to-br from-amber-500/20 via-slate-950 to-slate-900 border-2 border-amber-400/50 shadow-inner text-center">
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <Crown className="w-5 h-5 text-amber-400 animate-pulse" />
                                <span className="text-sm font-black text-amber-300 uppercase tracking-wider">
                                    {currentCard.grade}
                                </span>
                            </div>
                            <h3 className="text-lg sm:text-xl font-black text-white leading-tight">
                                {currentCard.name}
                            </h3>
                            <p className="text-xs text-amber-200/80 mt-1 font-mono">
                                {currentCard.highlight}
                            </p>
                        </div>

                        {/* 卡片背景與真實拍賣情報 */}
                        <div className="space-y-2.5 text-xs text-slate-300 bg-slate-950/70 p-4 rounded-2xl border border-white/10">
                            <div className="flex items-start gap-2">
                                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <div>
                                    <span className="text-slate-400 block font-mono text-[11px]">系列廠牌與版次</span>
                                    <span className="font-bold text-white">{currentCard.brand}</span>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <TrendingUp className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                                <div>
                                    <span className="text-slate-400 block font-mono text-[11px]">拍賣紀錄來源</span>
                                    <span className="font-bold text-cyan-300">{currentCard.auctionSource}</span>
                                </div>
                            </div>
                            <p className="text-slate-400 text-[11px] leading-relaxed pt-2 border-t border-white/10">
                                {currentCard.description}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 右側：估價輸入、倒數計時與揭曉結果區 (7 Cols) */}
                <div className="lg:col-span-7 space-y-4">
                    <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/90 border-2 border-white/15 shadow-xl backdrop-blur-xl flex flex-col justify-between min-h-[460px]">
                        {/* 頂部計時器與狀態 */}
                        <div className="flex items-center justify-between pb-4 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <Timer className={cn("w-6 h-6", isTimerRunning ? "text-amber-400 animate-spin" : "text-slate-400")} />
                                <div>
                                    <span className="text-xs text-slate-400 block font-mono">限時估價倒數</span>
                                    <span className={cn(
                                        "text-2xl font-black font-mono",
                                        timerSeconds <= 5 ? "text-rose-400 animate-ping" : "text-white"
                                    )}>
                                        00:{timerSeconds < 10 ? `0${timerSeconds}` : timerSeconds}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {!isTimerRunning && !isRevealed && (
                                    <Button
                                        onClick={handleStartQuestion}
                                        className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs h-10 px-4 shadow-md"
                                    >
                                        🚀 開始計時估價
                                    </Button>
                                )}

                                {isRevealed && (
                                    <Button
                                        onClick={handleNextQuestion}
                                        className="rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs h-10 px-5 shadow-md"
                                    >
                                        下一張神卡挑戰 <ArrowRight className="w-4 h-4 ml-1" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* 中間猜價輸入面板 */}
                        {!isRevealed ? (
                            <div className="py-6 space-y-6 my-auto">
                                {gameMode === 'solo' ? (
                                    /* 單人模式輸入 */
                                    <div className="space-y-4 max-w-md mx-auto text-center">
                                        <Label className="text-sm font-bold text-slate-200">
                                            請憑您的鑑賞眼光，輸入您認為的市場成交價 ({currencyUnit})：
                                        </Label>
                                        
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-xl">
                                                $
                                            </span>
                                            <Input
                                                placeholder="輸入預估價格..."
                                                value={soloGuessInput}
                                                onChange={(e) => setSoloGuessInput(e.target.value)}
                                                className="h-14 pl-10 pr-4 text-center font-mono font-black text-2xl bg-slate-950 border-2 border-emerald-500/40 text-emerald-300 rounded-2xl shadow-inner"
                                            />
                                        </div>

                                        {/* 快捷加價鍵 */}
                                        <div className="flex flex-wrap items-center justify-center gap-2">
                                            {[1000, 5000, 10000, 50000, 100000, 500000].map(val => (
                                                <button
                                                    key={val}
                                                    type="button"
                                                    onClick={() => handleQuickAddValue('solo', val)}
                                                    className="px-2.5 py-1 rounded-xl bg-slate-800 border border-white/10 text-xs font-mono text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-300 transition-all"
                                                >
                                                    +${val >= 10000 ? `${val / 10000}萬` : `${val.toLocaleString()}`}
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => setSoloGuessInput('')}
                                                className="px-2.5 py-1 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs font-mono text-rose-300 hover:bg-rose-900/40 transition-all"
                                            >
                                                歸零
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* 雙人現場 PK 模式輸入 */
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* 玩家 1 */}
                                        <div className="p-4 rounded-2xl bg-slate-950/80 border-2 border-cyan-500/40 space-y-3">
                                            <Input
                                                value={duelPlayer1Name}
                                                onChange={(e) => setDuelPlayer1Name(e.target.value)}
                                                className="bg-transparent border-0 font-black text-sm text-cyan-300 p-0 h-auto focus-visible:ring-0"
                                            />
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 font-bold">$</span>
                                                <Input
                                                    placeholder="玩家1 估價..."
                                                    value={duelPlayer1Guess}
                                                    onChange={(e) => setDuelPlayer1Guess(e.target.value)}
                                                    className="h-11 pl-8 text-center font-mono font-black text-lg bg-slate-900 border-cyan-500/40 text-cyan-300 rounded-xl"
                                                />
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {[5000, 20000, 100000].map(val => (
                                                    <button
                                                        key={val}
                                                        type="button"
                                                        onClick={() => handleQuickAddValue('p1', val)}
                                                        className="px-2 py-0.5 rounded-lg bg-slate-850 border border-white/10 text-[10px] font-mono text-slate-400 hover:text-cyan-300"
                                                    >
                                                        +${val / 1000}k
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 玩家 2 */}
                                        <div className="p-4 rounded-2xl bg-slate-950/80 border-2 border-rose-500/40 space-y-3">
                                            <Input
                                                value={duelPlayer2Name}
                                                onChange={(e) => setDuelPlayer2Name(e.target.value)}
                                                className="bg-transparent border-0 font-black text-sm text-rose-300 p-0 h-auto focus-visible:ring-0"
                                            />
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-400 font-bold">$</span>
                                                <Input
                                                    placeholder="玩家2 估價..."
                                                    value={duelPlayer2Guess}
                                                    onChange={(e) => setDuelPlayer2Guess(e.target.value)}
                                                    className="h-11 pl-8 text-center font-mono font-black text-lg bg-slate-900 border-rose-500/40 text-rose-300 rounded-xl"
                                                />
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {[5000, 20000, 100000].map(val => (
                                                    <button
                                                        key={val}
                                                        type="button"
                                                        onClick={() => handleQuickAddValue('p2', val)}
                                                        className="px-2 py-0.5 rounded-lg bg-slate-850 border border-white/10 text-[10px] font-mono text-slate-400 hover:text-rose-300"
                                                    >
                                                        +${val / 1000}k
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="text-center">
                                    <Button
                                        onClick={handleRevealPrice}
                                        className="h-12 px-10 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.4)]"
                                    >
                                        🎯 鎖定價格・即時揭曉真實行情！
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            /* 揭曉成果面板 */
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="py-4 space-y-4 my-auto"
                            >
                                {/* 真實價格大看板 */}
                                <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-950/60 via-slate-950 to-emerald-950/60 border-2 border-amber-400/60 text-center shadow-[0_0_40px_rgba(245,158,11,0.25)]">
                                    <span className="text-xs font-black uppercase tracking-widest text-amber-300 block mb-1">
                                        ★ 官方權威近期拍賣真實成交價 ★
                                    </span>
                                    <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono text-amber-400 tracking-tight">
                                        ${targetPrice.toLocaleString()} {currency}
                                    </div>
                                    <span className="text-xs text-slate-400 font-mono mt-1 block">
                                        折合約 {currency === 'NTD' ? `$${currentCard.realPriceUSD.toLocaleString()} USD` : `NT$${currentCard.realPriceNTD.toLocaleString()}`}
                                    </span>
                                </div>

                                {/* 玩家評分結果 */}
                                {gameMode === 'solo' ? (
                                    (() => {
                                        const guessVal = parseFloat(soloGuessInput.replace(/,/g, '')) || 0;
                                        const acc = calculateAccuracy(guessVal, targetPrice);
                                        const diff = Math.abs(guessVal - targetPrice);

                                        return (
                                            <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-2 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className="text-xs text-slate-400">您的估價：${guessVal.toLocaleString()}</span>
                                                    <span className="text-slate-500">|</span>
                                                    <span className="text-xs text-slate-400">誤差：${diff.toLocaleString()}</span>
                                                </div>

                                                <div className="flex items-center justify-center gap-3 pt-1">
                                                    <div className="text-lg font-black text-white">
                                                        精準度：<strong className={cn(acc >= 85 ? "text-emerald-400" : acc >= 60 ? "text-amber-400" : "text-rose-400")}>{acc}%</strong>
                                                    </div>
                                                    <Badge className={cn(
                                                        "text-xs px-3 py-1 font-black",
                                                        acc >= 90 ? "bg-amber-500 text-slate-950" :
                                                        acc >= 75 ? "bg-emerald-500 text-slate-950" :
                                                        "bg-slate-800 text-slate-300"
                                                    )}>
                                                        {acc >= 90 ? '👑 殿堂級神之眼' : acc >= 75 ? '💎 頂級收藏專家' : acc >= 50 ? '🔍 眼光好手' : '🌱 潛力卡友'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        );
                                    })()
                                ) : (
                                    (() => {
                                        const p1Val = parseFloat(duelPlayer1Guess.replace(/,/g, '')) || 0;
                                        const p2Val = parseFloat(duelPlayer2Guess.replace(/,/g, '')) || 0;
                                        const diff1 = Math.abs(p1Val - targetPrice);
                                        const diff2 = Math.abs(p2Val - targetPrice);
                                        const isP1Win = diff1 < diff2;
                                        const isTie = diff1 === diff2;

                                        return (
                                            <div className="grid grid-cols-2 gap-3 text-center">
                                                <div className={cn(
                                                    "p-4 rounded-2xl border-2 transition-all",
                                                    isP1Win ? "bg-cyan-950/60 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]" : "bg-slate-950/80 border-white/10 opacity-70"
                                                )}>
                                                    <span className="text-xs font-bold text-cyan-300 block mb-1">{duelPlayer1Name}</span>
                                                    <div className="text-lg font-mono font-black text-white">${p1Val.toLocaleString()}</div>
                                                    <span className="text-[11px] text-slate-400 block mt-1">誤差: ${diff1.toLocaleString()}</span>
                                                    {isP1Win && <Badge className="mt-2 bg-cyan-500 text-slate-950 font-black text-xs">👑 優勝勝出！</Badge>}
                                                </div>

                                                <div className={cn(
                                                    "p-4 rounded-2xl border-2 transition-all",
                                                    !isP1Win && !isTie ? "bg-rose-950/60 border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.3)]" : "bg-slate-950/80 border-white/10 opacity-70"
                                                )}>
                                                    <span className="text-xs font-bold text-rose-300 block mb-1">{duelPlayer2Name}</span>
                                                    <div className="text-lg font-mono font-black text-white">${p2Val.toLocaleString()}</div>
                                                    <span className="text-[11px] text-slate-400 block mt-1">誤差: ${diff2.toLocaleString()}</span>
                                                    {!isP1Win && !isTie && <Badge className="mt-2 bg-rose-500 text-slate-950 font-black text-xs">👑 優勝勝出！</Badge>}
                                                </div>
                                            </div>
                                        );
                                    })()
                                )}
                            </motion.div>
                        )}

                        {/* 底部歷史挑戰紀錄列 */}
                        {soloScoreHistory.length > 0 && gameMode === 'solo' && (
                            <div className="pt-3 border-t border-white/10 text-xs text-slate-400 flex items-center justify-between">
                                <span>已挑戰 {soloScoreHistory.length} 題</span>
                                <span>累計積分：<strong className="text-emerald-400 font-mono">{soloScoreHistory.reduce((a, b) => a + b.points, 0)}</strong> 分</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 自訂卡片彈窗 */}
            <Dialog open={isCustomModalOpen} onOpenChange={setIsCustomModalOpen}>
                <DialogContent className="sm:max-w-md bg-slate-900/95 border-2 border-emerald-500/40 rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                            <Plus className="w-5 h-5 text-emerald-400" />
                            攤位自訂競猜卡片上架
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400">
                            輸入攤位現場展售的卡片資訊與真實行情，供現場參觀者互動競猜：
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3.5 py-3 text-xs">
                        <div className="space-y-1">
                            <Label className="text-slate-300">卡片名稱與年份</Label>
                            <Input
                                placeholder="例如：2023 大谷翔平 道奇金屬親簽卡"
                                value={customCardName}
                                onChange={(e) => setCustomCardName(e.target.value)}
                                className="bg-slate-950 border-white/10 text-white"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-slate-300">鑑定評級</Label>
                                <Input
                                    placeholder="例如：PSA 10 / BGS 9.5"
                                    value={customGrade}
                                    onChange={(e) => setCustomGrade(e.target.value)}
                                    className="bg-slate-950 border-white/10 text-white"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-slate-300">真實行情價 (NTD)</Label>
                                <Input
                                    placeholder="例如：35000"
                                    value={customPriceNTD}
                                    onChange={(e) => setCustomPriceNTD(e.target.value)}
                                    className="bg-slate-950 border-white/10 text-emerald-300 font-mono font-bold"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-slate-300">卡片亮點描述 (選填)</Label>
                            <Input
                                placeholder="例如：限量 10 張金折、現場特價"
                                value={customHighlight}
                                onChange={(e) => setCustomHighlight(e.target.value)}
                                className="bg-slate-950 border-white/10 text-white"
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex justify-between">
                        <Button variant="outline" onClick={() => setIsCustomModalOpen(false)} className="rounded-xl border-white/10 text-xs">
                            取消
                        </Button>
                        <Button onClick={handleAddCustomCard} className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                            立即加入題庫
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
