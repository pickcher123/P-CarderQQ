'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
    Grid3X3, 
    Sparkles, 
    Flame, 
    Gift, 
    Trophy, 
    Crown, 
    RotateCcw, 
    Copy, 
    Volume2, 
    VolumeX, 
    ShieldCheck, 
    Zap, 
    Diamond, 
    Star, 
    Award, 
    Settings2, 
    Plus,
    Maximize,
    Minimize,
    CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export type BingoSymbol = 'CROWN' | 'FLAME' | 'LIGHTNING' | 'DIAMOND';

export interface GridTileItem {
    id: number; // 1 to 9
    title: string;
    boxTheme: string;
    gradientBg: string;
    borderColor: string;
    symbol: BingoSymbol;
    tier: 'S' | 'A' | 'B' | 'C';
    prizeName: string;
    isPunched: boolean;
    punchedAt?: string;
    player?: string;
}

export const DEFAULT_GRID_TILES: GridTileItem[] = [
    { id: 1, title: '金曜黃金卡盒', boxTheme: 'Gold Vault', gradientBg: 'from-amber-500/20 via-yellow-500/10 to-slate-950', borderColor: 'border-amber-400/60', symbol: 'CROWN', tier: 'S', prizeName: '2023 大谷翔平 MVP 限量球衣卡 PSA 10', isPunched: false },
    { id: 2, title: '黑曜星塵魔盒', boxTheme: 'Obsidian Box', gradientBg: 'from-purple-500/20 via-slate-900 to-slate-950', borderColor: 'border-purple-400/60', symbol: 'FLAME', tier: 'A', prizeName: 'Topps Chrome 棒球原箱拆盒包 (整盒)', isPunched: false },
    { id: 3, title: '璀璨鑽石神盒', boxTheme: 'Diamond Vault', gradientBg: 'from-cyan-500/20 via-blue-500/10 to-slate-950', borderColor: 'border-cyan-400/60', symbol: 'DIAMOND', tier: 'S', prizeName: 'Victor Wembanyama Prizm 新人親簽 PSA 9', isPunched: false },
    { id: 4, title: '翡翠秘境卡盒', boxTheme: 'Emerald Case', gradientBg: 'from-emerald-500/20 via-teal-500/10 to-slate-950', borderColor: 'border-emerald-400/60', symbol: 'LIGHTNING', tier: 'B', prizeName: 'PSA 原廠高級防刮卡磚 (2入組)', isPunched: false },
    { id: 5, title: '傳奇殿堂金盒', boxTheme: 'Legendary Coffer', gradientBg: 'from-amber-600/30 via-orange-500/20 to-slate-950', borderColor: 'border-amber-400/80', symbol: 'CROWN', tier: 'S', prizeName: '2003 LeBron James 復刻親簽卡磚 (核心大獎)', isPunched: false },
    { id: 6, title: '緋紅紅寶石盒', boxTheme: 'Ruby Chamber', gradientBg: 'from-rose-500/20 via-pink-500/10 to-slate-950', borderColor: 'border-rose-400/60', symbol: 'FLAME', tier: 'A', prizeName: 'Stephen Curry 冠軍賽簽名裁判特卡', isPunched: false },
    { id: 7, title: '星雲秘寶神磚', boxTheme: 'Nebula Vault', gradientBg: 'from-indigo-500/20 via-purple-500/10 to-slate-950', borderColor: 'border-indigo-400/60', symbol: 'DIAMOND', tier: 'B', prizeName: 'Panini Prizm 籃球精選特卡盲包 (3包入)', isPunched: false },
    { id: 8, title: '閃電雷霆卡磚', boxTheme: 'Thunder Break', gradientBg: 'from-yellow-500/20 via-amber-500/10 to-slate-950', borderColor: 'border-yellow-400/60', symbol: 'LIGHTNING', tier: 'B', prizeName: 'BGS 專屬磁吸展示架與防偽套', isPunched: false },
    { id: 9, title: '稜鏡幻彩盲盒', boxTheme: 'Prism Prism', gradientBg: 'from-teal-500/20 via-cyan-500/10 to-slate-950', borderColor: 'border-teal-400/60', symbol: 'CROWN', tier: 'A', prizeName: '寶可夢 151 強化擴充包 (日版整盒未拆)', isPunched: false },
];

const WINNING_LINES = [
    [0, 1, 2], // 橫1
    [3, 4, 5], // 橫2
    [6, 7, 8], // 橫3
    [0, 3, 6], // 直1
    [1, 4, 7], // 直2
    [2, 5, 8], // 直3
    [0, 4, 8], // 斜1
    [2, 4, 6], // 斜2
];

export function LuckyGridPunchEvent() {
    const { toast } = useToast();
    const [tiles, setTiles] = useState<GridTileItem[]>(DEFAULT_GRID_TILES);
    const [soundEnabled, setSoundEnabled] = useState(true);

    const [revealedTile, setRevealedTile] = useState<GridTileItem | null>(null);
    const [showRevealModal, setShowRevealModal] = useState(false);
    const [showBingoModal, setShowBingoModal] = useState(false);
    const [bingoLineInfo, setBingoLineInfo] = useState<{ lineName: string; symbol: string } | null>(null);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);

    // 檢查連線
    const checkBingo = (currentTiles: GridTileItem[]) => {
        for (const line of WINNING_LINES) {
            const [a, b, c] = line;
            const tileA = currentTiles[a];
            const tileB = currentTiles[b];
            const tileC = currentTiles[c];

            if (tileA.isPunched && tileB.isPunched && tileC.isPunched) {
                // 檢查符號是否相同
                if (tileA.symbol === tileB.symbol && tileB.symbol === tileC.symbol) {
                    return {
                        hasBingo: true,
                        symbol: tileA.symbol,
                        indices: line
                    };
                }
            }
        }
        return { hasBingo: false };
    };

    // 戳破單一盲盒
    const handlePunchTile = (tileId: number) => {
        const target = tiles.find(t => t.id === tileId);
        if (!target || target.isPunched) return;

        const timeStr = new Date().toLocaleTimeString('zh-TW');
        const updated = tiles.map(t => {
            if (t.id === tileId) {
                return {
                    ...t,
                    isPunched: true,
                    punchedAt: timeStr
                };
            }
            return t;
        });

        setTiles(updated);
        const punchedItem = { ...target, isPunched: true, punchedAt: timeStr };
        setRevealedTile(punchedItem);
        setShowRevealModal(true);

        if (punchedItem.tier === 'S' || punchedItem.tier === 'A') {
            confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
        }

        // 檢查連線
        const bingoResult = checkBingo(updated);
        if (bingoResult.hasBingo) {
            setTimeout(() => {
                setShowRevealModal(false);
                setBingoLineInfo({
                    lineName: '🌟 達成三連線 BINGO 大滿貫！',
                    symbol: bingoResult.symbol || '👑'
                });
                setShowBingoModal(true);
                confetti({ particleCount: 150, spread: 100, origin: { y: 0.5 } });
            }, 1200);
        }
    };

    // 隨機戳 1 格
    const handleRandomPunch = () => {
        const unpunched = tiles.filter(t => !t.isPunched);
        if (unpunched.length === 0) return;
        const randomTarget = unpunched[Math.floor(Math.random() * unpunched.length)];
        handlePunchTile(randomTarget.id);
    };

    // 隨機戳 3 格
    const handlePunchThree = () => {
        const unpunched = tiles.filter(t => !t.isPunched);
        if (unpunched.length === 0) return;
        const takeCount = Math.min(3, unpunched.length);
        const shuffled = [...unpunched].sort(() => Math.random() - 0.5).slice(0, takeCount);

        const timeStr = new Date().toLocaleTimeString('zh-TW');
        const targetIds = new Set(shuffled.map(t => t.id));

        const updated = tiles.map(t => {
            if (targetIds.has(t.id)) {
                return {
                    ...t,
                    isPunched: true,
                    punchedAt: timeStr
                };
            }
            return t;
        });

        setTiles(updated);
        setRevealedTile(shuffled[0]);
        setShowRevealModal(true);
        confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });

        const bingoResult = checkBingo(updated);
        if (bingoResult.hasBingo) {
            setTimeout(() => {
                setShowRevealModal(false);
                setBingoLineInfo({
                    lineName: '🌟 達成三連線 BINGO 大滿貫！',
                    symbol: bingoResult.symbol || '👑'
                });
                setShowBingoModal(true);
                confetti({ particleCount: 160, spread: 110, origin: { y: 0.5 } });
            }, 1200);
        }
    };

    // 一鍵重洗盲盒
    const handleResetGrid = () => {
        const shuffledSymbols: BingoSymbol[] = ['CROWN', 'CROWN', 'CROWN', 'FLAME', 'FLAME', 'LIGHTNING', 'LIGHTNING', 'DIAMOND', 'DIAMOND'];
        for (let i = shuffledSymbols.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledSymbols[i], shuffledSymbols[j]] = [shuffledSymbols[j], shuffledSymbols[i]];
        }

        const resetTiles = DEFAULT_GRID_TILES.map((t, idx) => ({
            ...t,
            symbol: shuffledSymbols[idx],
            isPunched: false,
            punchedAt: undefined
        }));

        setTiles(resetTiles);
        setRevealedTile(null);
        setShowRevealModal(false);
        setShowBingoModal(false);
        setIsResetModalOpen(false);
        toast({
            title: '🔄 九宮格盲盒已全部重新封箱洗牌！',
            description: '9 款神秘卡磚盒已就緒，可展開新一輪戳戳樂破箱！'
        });
    };

    const remainingCount = tiles.filter(t => !t.isPunched).length;

    const renderSymbolIcon = (sym: BingoSymbol) => {
        switch (sym) {
            case 'CROWN': return <Crown className="w-4 h-4 text-amber-400" />;
            case 'FLAME': return <Flame className="w-4 h-4 text-rose-400" />;
            case 'LIGHTNING': return <Zap className="w-4 h-4 text-yellow-400" />;
            case 'DIAMOND': return <Diamond className="w-4 h-4 text-cyan-400" />;
        }
    };

    return (
        <div className="space-y-6">
            {/* 頂部橫幅 */}
            <div className="p-5 sm:p-7 rounded-3xl bg-gradient-to-br from-slate-900/95 via-[#180d24]/95 to-slate-950/95 border-2 border-purple-500/40 shadow-[0_0_40px_rgba(168,85,247,0.2)] backdrop-blur-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-400/30">
                                <Grid3X3 className="w-5 h-5" />
                            </span>
                            <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black text-xs px-2.5 shadow-md">
                                卡展排隊爆款 🔥
                            </Badge>
                            <Badge className="bg-slate-800 text-slate-300 border-white/10 text-xs font-mono">
                                剩餘神秘盒：{remainingCount} / 9 格
                            </Badge>
                        </div>

                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
                            🎁 九宮格極速盲盒・連線大加碼
                        </h2>

                        {/* Bingo 加碼提示列 */}
                        <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-950/60 via-pink-950/40 to-slate-950/80 border border-purple-500/40 flex items-center justify-between gap-3 shadow-inner">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-[0_0_12px_rgba(168,85,247,0.6)] animate-pulse">
                                    <Star className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-300 block">
                                        🌟 賓果連線特別加碼 (Bingo Bonus)
                                    </span>
                                    <p className="text-xs sm:text-sm font-bold text-white truncate">
                                        戳破 3 格達成橫線、直線、斜線連線，額外獲贈【卡展限定・夢幻鑑定特卡磚】！
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 快捷操作按鈕 */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        <Button
                            size="sm"
                            onClick={handleRandomPunch}
                            disabled={remainingCount === 0}
                            className="rounded-xl font-black text-xs bg-purple-600 hover:bg-purple-500 text-white shadow-md"
                        >
                            <Sparkles className="w-3.5 h-3.5 mr-1" />
                            隨機戳 1 格
                        </Button>

                        <Button
                            size="sm"
                            onClick={handlePunchThree}
                            disabled={remainingCount < 3}
                            className="rounded-xl font-black text-xs bg-pink-600 hover:bg-pink-500 text-white shadow-md"
                        >
                            💥 連續戳 3 格 (連線挑戰)
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsResetModalOpen(true)}
                            className="rounded-xl border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40 text-xs"
                        >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            重置重封 9 格
                        </Button>
                    </div>
                </div>
            </div>

            {/* 3x3 九宮格破箱區 */}
            <div className="max-w-4xl mx-auto">
                <div className="grid grid-cols-3 gap-4 sm:gap-6">
                    {tiles.map((tile) => {
                        const isPunched = tile.isPunched;

                        return (
                            <motion.div
                                key={tile.id}
                                whileHover={!isPunched ? { scale: 1.03, y: -4 } : {}}
                                whileTap={!isPunched ? { scale: 0.96 } : {}}
                                onClick={() => !isPunched && handlePunchTile(tile.id)}
                                className={cn(
                                    "aspect-square rounded-3xl p-4 sm:p-6 flex flex-col justify-between items-center text-center transition-all select-none relative overflow-hidden",
                                    "border-2 backdrop-blur-xl shadow-xl",
                                    isPunched
                                        ? "bg-slate-950/80 border-white/10 opacity-60 cursor-default"
                                        : "bg-slate-900/90 hover:border-purple-400/80 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] cursor-pointer",
                                    tile.borderColor
                                )}
                            >
                                {/* 背景發光光暈 */}
                                <div className={cn(
                                    "absolute inset-0 bg-gradient-to-br opacity-50 pointer-events-none",
                                    tile.gradientBg
                                )} />

                                {!isPunched ? (
                                    <>
                                        {/* 頂部格號與徽章 */}
                                        <div className="w-full flex items-center justify-between text-xs font-mono relative z-10">
                                            <span className="w-7 h-7 rounded-lg bg-slate-950 border border-white/10 flex items-center justify-center font-black text-white">
                                                #{tile.id}
                                            </span>
                                            <span className="p-1 rounded-md bg-white/10">
                                                {renderSymbolIcon(tile.symbol)}
                                            </span>
                                        </div>

                                        {/* 中間盲盒主視覺 */}
                                        <div className="my-auto relative z-10 text-center">
                                            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/30 to-pink-500/20 border-2 border-purple-400/50 flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(168,85,247,0.4)] group-hover:rotate-6 transition-transform">
                                                <Gift className="w-7 h-7 sm:w-8 sm:h-8 text-purple-300" />
                                            </div>
                                            <h3 className="text-sm sm:text-base font-black text-white">
                                                {tile.title}
                                            </h3>
                                            <span className="text-[10px] text-purple-300 font-mono">
                                                {tile.boxTheme}
                                            </span>
                                        </div>

                                        {/* 底部戳破按鈕標籤 */}
                                        <div className="w-full relative z-10">
                                            <span className="w-full block py-1 text-[11px] font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl shadow-md uppercase tracking-wider">
                                                👊 點擊破箱戳開
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* 已戳破狀態 */}
                                        <div className="w-full flex items-center justify-between text-xs font-mono text-slate-500 relative z-10">
                                            <span>#{tile.id} 已開啟</span>
                                            <span>{renderSymbolIcon(tile.symbol)}</span>
                                        </div>

                                        <div className="my-auto relative z-10 text-center space-y-1">
                                            <div className={cn(
                                                "w-10 h-10 mx-auto rounded-xl flex items-center justify-center font-black text-sm shadow-md",
                                                tile.tier === 'S' ? "bg-amber-500 text-slate-950" :
                                                tile.tier === 'A' ? "bg-rose-500 text-white" :
                                                "bg-purple-500 text-white"
                                            )}>
                                                {tile.tier}賞
                                            </div>
                                            <p className="text-xs font-bold text-slate-200 line-clamp-2">
                                                {tile.prizeName}
                                            </p>
                                        </div>

                                        <span className="text-[10px] text-slate-500 font-mono relative z-10">
                                            {tile.punchedAt}
                                        </span>
                                    </>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* 開箱揭曉彈窗 */}
            <Dialog open={showRevealModal} onOpenChange={setShowRevealModal}>
                <DialogContent className="sm:max-w-md bg-slate-900/95 border-2 border-purple-500/50 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(168,85,247,0.3)] backdrop-blur-2xl text-center">
                    <DialogHeader>
                        <div className="mx-auto w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                            <Sparkles className="w-7 h-7 text-purple-300" />
                        </div>
                        <DialogTitle className="text-2xl font-black text-white">
                            🎉 盲盒破箱成功！
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400">
                            恭喜戳破 {revealedTile?.title}（#{revealedTile?.id} 號神盒），獲得以下獎品：
                        </DialogDescription>
                    </DialogHeader>

                    {revealedTile && (
                        <div className="p-4 rounded-2xl bg-slate-950/80 border-2 border-purple-400/40 my-3 text-center space-y-2">
                            <Badge className={cn(
                                "text-xs px-3 py-1 font-black",
                                revealedTile.tier === 'S' ? "bg-amber-500 text-slate-950" :
                                revealedTile.tier === 'A' ? "bg-rose-500 text-white" :
                                "bg-purple-500 text-white"
                            )}>
                                {revealedTile.tier} 級神獎
                            </Badge>
                            <h3 className="text-base sm:text-lg font-black text-white">
                                {revealedTile.prizeName}
                            </h3>
                            <div className="flex items-center justify-center gap-1.5 text-xs text-purple-300 font-mono">
                                <span>連線符號：</span>
                                {renderSymbolIcon(revealedTile.symbol)}
                                <span>({revealedTile.symbol})</span>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex justify-center">
                        <Button
                            onClick={() => setShowRevealModal(false)}
                            className="rounded-xl px-8 bg-purple-600 hover:bg-purple-500 text-white font-black text-sm"
                        >
                            確定收下獎品
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 🌟 BINGO 大滿貫連線加碼彈窗 */}
            <Dialog open={showBingoModal} onOpenChange={setShowBingoModal}>
                <DialogContent className="sm:max-w-lg bg-gradient-to-b from-purple-950/95 via-slate-900/95 to-slate-950/95 border-2 border-pink-500/60 rounded-3xl p-6 sm:p-8 shadow-[0_0_80px_rgba(236,72,153,0.5)] backdrop-blur-2xl text-center">
                    <DialogHeader>
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center mb-3 shadow-[0_0_30px_rgba(236,72,153,0.6)] animate-bounce">
                            <Star className="w-9 h-9 text-white" />
                        </div>
                        <DialogTitle className="text-2xl sm:text-3xl font-black text-white">
                            🌟 BINGO 連線大滿貫加碼！
                        </DialogTitle>
                        <DialogDescription className="text-xs text-pink-200">
                            恭喜完成 3 格符號完美連線！額外獲贈卡展全場限定加碼特賞：
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-5 rounded-2xl bg-slate-950/90 border-2 border-pink-400/40 my-4 shadow-inner">
                        <span className="text-xs font-black uppercase text-pink-300 tracking-widest block mb-1">
                            ★ 卡展連線大獎特典 ★
                        </span>
                        <h3 className="text-lg sm:text-xl font-black text-white">
                            🏆 2024 卡展限定・大谷翔平 & 斑馬 雙球星親筆簽名特製紀念磚！
                        </h3>
                    </div>

                    <DialogFooter className="flex justify-center">
                        <Button
                            onClick={() => setShowBingoModal(false)}
                            className="rounded-xl px-10 h-12 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-white font-black text-base shadow-lg"
                        >
                            🎊 抱走 BINGO 連線神獎！
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 重置確認彈窗 */}
            <Dialog open={isResetModalOpen} onOpenChange={setIsResetModalOpen}>
                <DialogContent className="sm:max-w-md bg-slate-900/95 border-2 border-rose-500/40 rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                            <RotateCcw className="w-5 h-5 text-rose-400" />
                            重置九宮格盲盒
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400">
                            確定要將 9 個盲盒重新封箱並隨機洗牌連線符號嗎？
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="flex justify-between mt-4">
                        <Button variant="outline" onClick={() => setIsResetModalOpen(false)} className="rounded-xl border-white/10 text-xs">
                            取消
                        </Button>
                        <Button onClick={handleResetGrid} className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold">
                            確認重新封箱
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
