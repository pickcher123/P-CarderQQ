'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
    Ticket, 
    Sparkles, 
    Flame, 
    Gift, 
    Trophy, 
    Crown, 
    RotateCcw, 
    FileSpreadsheet, 
    Copy, 
    Volume2, 
    VolumeX, 
    Plus, 
    Layers, 
    Trash2, 
    Shuffle, 
    Download, 
    CheckCircle2, 
    AlertCircle, 
    Maximize, 
    Minimize,
    Settings2,
    Eye,
    Tag,
    Share2,
    ShieldCheck,
    Coins,
    Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// 一番賞獎項等級定義
export interface KujiPrizeTier {
    tier: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'LAST_ONE';
    tierName: string;
    prizeName: string;
    totalCount: number;
    color: string;
    bgGradient: string;
    imagePlaceholder?: string;
}

// 籤紙定義
export interface KujiTicket {
    id: number;
    tier: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
    prizeName: string;
    isOpened: boolean;
    openedAt?: string;
    drawOrder?: number;
    doubleChanceCode: string;
    buyerName?: string;
}

// 預設三大卡展熱門套籤範本
export interface KujiSetTemplate {
    id: string;
    title: string;
    pricePerDraw: number;
    totalTickets: number;
    themeColor: string;
    description: string;
    lastOnePrize: string;
    prizes: KujiPrizeTier[];
}

export const KUJI_TEMPLATES: KujiSetTemplate[] = [
    {
        id: 'ohtani-mvp',
        title: '⚾ 2024 大谷翔平・MVP 傳奇親簽特展一番賞 (80抽)',
        pricePerDraw: 350,
        totalTickets: 80,
        themeColor: 'from-amber-500 to-rose-600',
        description: '卡展超限定！全套含大谷翔平 PSA 10 限量簽名卡與道奇冠軍紀念特卡。',
        lastOnePrize: '🔥 LAST ONE 賞：2018 大谷翔平 Rookie PSA 10 紅折親簽紀念卡磚',
        prizes: [
            { tier: 'A', tierName: 'A賞 (超大獎)', prizeName: '2023 大谷翔平 MVP 限量球衣親簽卡 PSA 10', totalCount: 1, color: 'text-amber-300', bgGradient: 'from-amber-500/20 to-orange-500/10' },
            { tier: 'B', tierName: 'B賞 (頂級卡)', prizeName: '2024 WBC 日本隊全隊冠軍親簽特製卡磚', totalCount: 2, color: 'text-rose-300', bgGradient: 'from-rose-500/20 to-pink-500/10' },
            { tier: 'C', tierName: 'C賞 (卡盒)', prizeName: 'Topps Chrome MLB 棒球原箱拆盒包 (整盒)', totalCount: 4, color: 'text-purple-300', bgGradient: 'from-purple-500/20 to-indigo-500/10' },
            { tier: 'D', tierName: 'D賞 (配件)', prizeName: 'PSA 原廠高級特厚防潮防刮卡磚 (2入組)', totalCount: 10, color: 'text-blue-300', bgGradient: 'from-blue-500/20 to-cyan-500/10' },
            { tier: 'E', tierName: 'E賞 (特卡包)', prizeName: '2024 MLB 全明星折射特卡盲包 (3張入)', totalCount: 30, color: 'text-emerald-300', bgGradient: 'from-emerald-500/20 to-teal-500/10' },
            { tier: 'F', tierName: 'F賞 (紀念禮)', prizeName: '道奇 50-50 俱樂部限定燙金金屬紀念徽章組', totalCount: 33, color: 'text-slate-300', bgGradient: 'from-slate-500/20 to-slate-600/10' },
        ]
    },
    {
        id: 'nba-legends',
        title: '🏀 NBA 傳奇巨星親簽與新秀鑑定卡特展一番賞 (60抽)',
        pricePerDraw: 400,
        totalTickets: 60,
        themeColor: 'from-purple-500 to-indigo-600',
        description: '集結斑馬 Wembanyama、Curry、Kobe、LeBron 等頂級卡片，張張有獎！',
        lastOnePrize: '🔥 LAST ONE 賞：2003 LeBron James 經典復刻親簽卡磚 (全場壓軸)',
        prizes: [
            { tier: 'A', tierName: 'A賞 (特賞)', prizeName: 'Victor Wembanyama Prizm 新人親簽 PSA 10', totalCount: 1, color: 'text-amber-300', bgGradient: 'from-amber-500/20 to-orange-500/10' },
            { tier: 'B', tierName: 'B賞 (巨星卡)', prizeName: 'Stephen Curry 冠軍賽簽名裁判特卡', totalCount: 2, color: 'text-rose-300', bgGradient: 'from-rose-500/20 to-pink-500/10' },
            { tier: 'C', tierName: 'C賞 (卡盒)', prizeName: 'Panini Prizm 籃球零售拆盒盒裝 (整盒)', totalCount: 4, color: 'text-purple-300', bgGradient: 'from-purple-500/20 to-indigo-500/10' },
            { tier: 'D', tierName: 'D賞 (保護磚)', prizeName: 'BGS 評級專屬磁吸展示架與防偽套', totalCount: 8, color: 'text-blue-300', bgGradient: 'from-blue-500/20 to-cyan-500/10' },
            { tier: 'E', tierName: 'E賞 (折射包)', prizeName: 'NBA 2023-24 精選銀折特卡盲包 (2張入)', totalCount: 20, color: 'text-emerald-300', bgGradient: 'from-emerald-500/20 to-teal-500/10' },
            { tier: 'F', tierName: 'F賞 (周邊)', prizeName: 'NBA 總冠軍球星專屬卡膜套組 (100入)', totalCount: 25, color: 'text-slate-300', bgGradient: 'from-slate-500/20 to-slate-600/10' },
        ]
    },
    {
        id: 'ptcg-charizard',
        title: '⚡ PTCG 寶可夢噴火龍與經典初版鑑定一番賞 (80抽)',
        pricePerDraw: 300,
        totalTickets: 80,
        themeColor: 'from-emerald-500 to-teal-600',
        description: '初版噴火龍、夢幻、皮卡丘神卡大集結，寶可夢卡迷排隊首選！',
        lastOnePrize: '🔥 LAST ONE 賞：噴火龍 25週年黃金紀念特卡 PSA 10 封裝磚',
        prizes: [
            { tier: 'A', tierName: 'A賞 (神卡)', prizeName: '1999 經典初版噴火龍 PSA 9 鑑定卡', totalCount: 1, color: 'text-amber-300', bgGradient: 'from-amber-500/20 to-orange-500/10' },
            { tier: 'B', tierName: 'B賞 (女角SR)', prizeName: '日版 莉莉艾 SR 繁中限定鑑定卡 PSA 10', totalCount: 2, color: 'text-rose-300', bgGradient: 'from-rose-500/20 to-pink-500/10' },
            { tier: 'C', tierName: 'C賞 (卡盒)', prizeName: '寶可夢 151 強化擴充包 (日版整盒未拆)', totalCount: 5, color: 'text-purple-300', bgGradient: 'from-purple-500/20 to-indigo-500/10' },
            { tier: 'D', tierName: 'D賞 (卡磚)', prizeName: '皮卡丘 25 週年特製磁吸展示金屬磚', totalCount: 12, color: 'text-blue-300', bgGradient: 'from-blue-500/20 to-cyan-500/10' },
            { tier: 'E', tierName: 'E賞 (閃卡包)', prizeName: '超稀有 AR / SAR 隨機閃卡鑑定盲包', totalCount: 28, color: 'text-emerald-300', bgGradient: 'from-emerald-500/20 to-teal-500/10' },
            { tier: 'F', tierName: 'F賞 (保護套)', prizeName: '官方授權寶可夢特級硬卡套組 (50枚入)', totalCount: 32, color: 'text-slate-300', bgGradient: 'from-slate-500/20 to-slate-600/10' },
        ]
    }
];

// 音效系統
class KujiAudio {
    private ctx: AudioContext | null = null;

    private init() {
        if (!this.ctx && typeof window !== 'undefined') {
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTear() {
        try {
            this.init();
            if (!this.ctx) return;
            // 撕紙摩擦聲
            const bufferSize = this.ctx.sampleRate * 0.15;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1800;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            noise.start();
        } catch (e) {}
    }

    playRevealBig() {
        try {
            this.init();
            if (!this.ctx) return;
            // 揭曉大獎和弦
            const freqs = [523.25, 659.25, 783.99, 1046.50]; // C Major
            freqs.forEach((f, idx) => {
                const osc = this.ctx!.createOscillator();
                const gain = this.ctx!.createGain();
                osc.type = 'triangle';
                const startTime = this.ctx!.currentTime + idx * 0.08;
                osc.frequency.setValueAtTime(f, startTime);
                gain.gain.setValueAtTime(0.2, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);
                osc.connect(gain);
                gain.connect(this.ctx!.destination);
                osc.start(startTime);
                osc.stop(startTime + 0.6);
            });
        } catch (e) {}
    }

    playLastOneFanfare() {
        try {
            this.init();
            if (!this.ctx) return;
            const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
            notes.forEach((f, i) => {
                const osc = this.ctx!.createOscillator();
                const gain = this.ctx!.createGain();
                osc.type = 'sine';
                const t = this.ctx!.currentTime + i * 0.12;
                osc.frequency.setValueAtTime(f, t);
                gain.gain.setValueAtTime(0.3, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
                osc.connect(gain);
                gain.connect(this.ctx!.destination);
                osc.start(t);
                osc.stop(t + 0.8);
            });
        } catch (e) {}
    }
}

const kujiAudio = new KujiAudio();

export function IchibanKujiEvent() {
    const { toast } = useToast();
    const [soundEnabled, setSoundEnabled] = useState(true);

    // 當前套籤資料
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('ohtani-mvp');
    const [kujiTitle, setKujiTitle] = useState<string>(KUJI_TEMPLATES[0].title);
    const [pricePerDraw, setPricePerDraw] = useState<number>(KUJI_TEMPLATES[0].pricePerDraw);
    const [lastOnePrize, setLastOnePrize] = useState<string>(KUJI_TEMPLATES[0].lastOnePrize);
    const [prizes, setPrizes] = useState<KujiPrizeTier[]>(KUJI_TEMPLATES[0].prizes);
    const [tickets, setTickets] = useState<KujiTicket[]>([]);

    // 抽籤中狀態與彈窗
    const [isOpeningBatch, setIsOpeningBatch] = useState(false);
    const [recentOpenedTickets, setRecentOpenedTickets] = useState<KujiTicket[]>([]);
    const [showRevealModal, setShowRevealModal] = useState(false);
    const [showLastOneModal, setShowLastOneModal] = useState(false);
    const [showDoubleChanceModal, setShowDoubleChanceModal] = useState(false);
    const [doubleChanceInput, setDoubleChanceInput] = useState('');
    const [doubleChanceResult, setDoubleChanceResult] = useState<{ isWon: boolean; prize?: string } | null>(null);

    // 重設彈窗
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);

    // 隨機生成 8 碼雙重中獎序號
    const generateDoubleChanceCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    };

    // 初始化套籤籤紙
    const initializeTicketsFromPrizes = (prizeList: KujiPrizeTier[]) => {
        const pool: { tier: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'; prizeName: string }[] = [];
        prizeList.forEach(p => {
            if (p.tier !== 'LAST_ONE') {
                for (let i = 0; i < p.totalCount; i++) {
                    pool.push({ tier: p.tier, prizeName: p.prizeName });
                }
            }
        });

        // Fisher-Yates 深度洗牌
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        const newTickets: KujiTicket[] = pool.map((item, index) => ({
            id: index + 1,
            tier: item.tier,
            prizeName: item.prizeName,
            isOpened: false,
            doubleChanceCode: generateDoubleChanceCode()
        }));

        setTickets(newTickets);
    };

    // 初始載入
    useEffect(() => {
        const template = KUJI_TEMPLATES.find(t => t.id === selectedTemplateId) || KUJI_TEMPLATES[0];
        setKujiTitle(template.title);
        setPricePerDraw(template.pricePerDraw);
        setLastOnePrize(template.lastOnePrize);
        setPrizes(template.prizes);
        initializeTicketsFromPrizes(template.prizes);
    }, [selectedTemplateId]);

    // 計算剩餘統計
    const stats = useMemo(() => {
        const total = tickets.length;
        const opened = tickets.filter(t => t.isOpened).length;
        const remaining = total - opened;

        // 計算各等級剩餘數量
        const tierStats: { [key: string]: { total: number; remaining: number; prizeName: string } } = {};
        prizes.forEach(p => {
            tierStats[p.tier] = { total: p.totalCount, remaining: p.totalCount, prizeName: p.prizeName };
        });

        tickets.forEach(t => {
            if (t.isOpened && tierStats[t.tier]) {
                tierStats[t.tier].remaining -= 1;
            }
        });

        // 大獎 (A / B 賞) 剩餘數
        const bigPrizesRemaining = (tierStats['A']?.remaining || 0) + (tierStats['B']?.remaining || 0);
        const bigPrizeRate = remaining > 0 ? ((bigPrizesRemaining / remaining) * 100).toFixed(1) : '0';
        const buyoutRemainingPrice = remaining * pricePerDraw;

        return {
            total,
            opened,
            remaining,
            tierStats,
            bigPrizesRemaining,
            bigPrizeRate,
            buyoutRemainingPrice
        };
    }, [tickets, prizes, pricePerDraw]);

    // 撕開單張籤紙
    const handleTearSingleTicket = (ticketId: number) => {
        const target = tickets.find(t => t.id === ticketId);
        if (!target || target.isOpened || isOpeningBatch) return;

        if (soundEnabled) kujiAudio.playTear();

        const timeStr = new Date().toLocaleTimeString('zh-TW');
        const openedCount = tickets.filter(t => t.isOpened).length + 1;

        const updated = tickets.map(t => {
            if (t.id === ticketId) {
                return {
                    ...t,
                    isOpened: true,
                    openedAt: timeStr,
                    drawOrder: openedCount
                };
            }
            return t;
        });

        setTickets(updated);
        const justOpened = { ...target, isOpened: true, openedAt: timeStr, drawOrder: openedCount };
        setRecentOpenedTickets([justOpened]);
        setShowRevealModal(true);

        if (justOpened.tier === 'A' || justOpened.tier === 'B') {
            if (soundEnabled) kujiAudio.playRevealBig();
            confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
        }

        // 檢查是否是最後一張 (觸發 LAST ONE 賞)
        if (openedCount === tickets.length) {
            setTimeout(() => {
                setShowRevealModal(false);
                setShowLastOneModal(true);
                if (soundEnabled) kujiAudio.playLastOneFanfare();
                confetti({ particleCount: 150, spread: 100, origin: { y: 0.5 } });
            }, 1200);
        }
    };

    // 連續開籤 (抽 N 連籤 / 一鍵全包)
    const handleBatchOpenTickets = (count: number) => {
        const unOpened = tickets.filter(t => !t.isOpened);
        if (unOpened.length === 0 || isOpeningBatch) return;

        const takeCount = Math.min(count, unOpened.length);
        setIsOpeningBatch(true);
        if (soundEnabled) kujiAudio.playTear();

        // 隨機選取 N 張籤
        const shuffledUnopened = [...unOpened].sort(() => Math.random() - 0.5);
        const selectedToOpen = shuffledUnopened.slice(0, takeCount);
        const selectedIds = new Set(selectedToOpen.map(t => t.id));

        const baseOpenedCount = tickets.filter(t => t.isOpened).length;
        const timeStr = new Date().toLocaleTimeString('zh-TW');

        let drawIdx = 0;
        const openedList: KujiTicket[] = [];

        const updated = tickets.map(t => {
            if (selectedIds.has(t.id)) {
                drawIdx++;
                const newT = {
                    ...t,
                    isOpened: true,
                    openedAt: timeStr,
                    drawOrder: baseOpenedCount + drawIdx
                };
                openedList.push(newT);
                return newT;
            }
            return t;
        });

        setTimeout(() => {
            setTickets(updated);
            setRecentOpenedTickets(openedList);
            setIsOpeningBatch(false);
            setShowRevealModal(true);

            const hasBig = openedList.some(t => t.tier === 'A' || t.tier === 'B');
            if (hasBig) {
                if (soundEnabled) kujiAudio.playRevealBig();
                confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
            }

            // 若全部抽完，觸發 Last One 賞
            if (baseOpenedCount + takeCount === tickets.length) {
                setTimeout(() => {
                    setShowRevealModal(false);
                    setShowLastOneModal(true);
                    if (soundEnabled) kujiAudio.playLastOneFanfare();
                    confetti({ particleCount: 180, spread: 120, origin: { y: 0.5 } });
                }, 1500);
            }
        }, 300);
    };

    // 套用其他範本
    const handleApplyTemplate = (tpl: KujiSetTemplate) => {
        setSelectedTemplateId(tpl.id);
        setKujiTitle(tpl.title);
        setPricePerDraw(tpl.pricePerDraw);
        setLastOnePrize(tpl.lastOnePrize);
        setPrizes(tpl.prizes);
        initializeTicketsFromPrizes(tpl.prizes);
        setIsTemplateModalOpen(false);
        toast({
            title: `✨ 已切換至【${tpl.title}】`,
            description: `全新 ${tpl.totalTickets} 籤已完整洗牌配置完成！`
        });
    };

    // 一鍵重新洗籤重開此套
    const handleResetCurrentKuji = () => {
        initializeTicketsFromPrizes(prizes);
        setRecentOpenedTickets([]);
        setShowRevealModal(false);
        setShowLastOneModal(false);
        setIsResetModalOpen(false);
        toast({
            title: '🔄 一番賞全新套籤已重置洗牌',
            description: `全套 ${tickets.length} 張籤已全部重新封籤打亂，可立即開始全新一輪！`
        });
    };

    // 雙重中獎檢驗
    const handleCheckDoubleChance = () => {
        if (!doubleChanceInput.trim()) return;
        const code = doubleChanceInput.trim().toUpperCase();
        // 模擬 15% 機率中特別雙重中獎
        const isWon = (code.charCodeAt(0) + code.charCodeAt(code.length - 1)) % 6 === 0;
        setDoubleChanceResult({
            isWon,
            prize: isWon ? '🎊 恭喜中獎！獲得【卡展限定・雙重中獎特別版金箔特卡磚】一份！' : undefined
        });
    };

    // 匯出中獎名單為文字
    const handleExportWinnerList = () => {
        const opened = tickets.filter(t => t.isOpened).sort((a, b) => (a.drawOrder || 0) - (b.drawOrder || 0));
        if (opened.length === 0) {
            toast({ title: '目前尚無已開出之中獎籤', variant: 'destructive' });
            return;
        }

        let content = `【${kujiTitle}】中獎名冊記錄\n`;
        content += `匯出時間：${new Date().toLocaleString('zh-TW')}\n`;
        content += `總抽數：${tickets.length} 抽 | 已開出：${opened.length} 抽 | 單抽價格：$${pricePerDraw}\n\n`;
        content += `抽獎序號\t籤紙編號\t賞別\t中獎獎項\t開籤時間\t雙重中獎碼\n`;

        opened.forEach(t => {
            content += `#${t.drawOrder}\t籤號 ${t.id}\t[${t.tier}賞]\t${t.prizeName}\t${t.openedAt}\t${t.doubleChanceCode}\n`;
        });

        navigator.clipboard.writeText(content);
        toast({
            title: '📋 中獎名冊已複製至剪貼簿！',
            description: `已複製 ${opened.length} 筆開獎結果，可直接貼上 Excel 或記事本。`
        });
    };

    return (
        <div className="space-y-6">
            {/* 頂部套籤看板橫幅 */}
            <div className="p-5 sm:p-7 rounded-3xl bg-gradient-to-br from-slate-900/95 via-[#0d1527]/95 to-slate-950/95 border-2 border-amber-500/40 shadow-[0_0_40px_rgba(245,158,11,0.2)] backdrop-blur-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* 左側活動標題與介紹 */}
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/30">
                                <Ticket className="w-5 h-5" />
                            </span>
                            <Badge className="bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-black text-xs px-2.5 shadow-md">
                                一番賞實體籤牆
                            </Badge>
                            <Badge className="bg-slate-800 text-slate-300 border-white/10 text-xs">
                                單抽定價：<strong className="text-amber-300 font-mono font-bold">${pricePerDraw}</strong> 元
                            </Badge>
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-xs">
                                <ShieldCheck className="w-3.5 h-3.5 mr-1 inline" /> 盲籤保密演算法
                            </Badge>
                        </div>

                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
                            {kujiTitle}
                        </h2>

                        {/* Last One 賞特別突出條 */}
                        <div className="p-3 rounded-2xl bg-gradient-to-r from-rose-950/60 via-amber-950/40 to-slate-950/80 border border-rose-500/40 flex items-center justify-between gap-3 shadow-inner">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-slate-950 font-black text-xs shrink-0 shadow-[0_0_12px_rgba(244,63,94,0.6)] animate-pulse">
                                    <Flame className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-300 block">
                                        壓軸必得・最後一抽特典
                                    </span>
                                    <p className="text-xs sm:text-sm font-bold text-white truncate">
                                        {lastOnePrize}
                                    </p>
                                </div>
                            </div>
                            <span className="text-[10px] text-amber-300 font-mono shrink-0 hidden sm:inline">
                                撕開最後一張籤直接免費抱走
                            </span>
                        </div>
                    </div>

                    {/* 右側快捷操作鈕 */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsTemplateModalOpen(true)}
                            className="rounded-xl border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 font-bold text-xs"
                        >
                            <Layers className="w-3.5 h-3.5 mr-1.5" />
                            切換卡展套籤範本
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowDoubleChanceModal(true)}
                            className="rounded-xl border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 font-bold text-xs"
                        >
                            <Award className="w-3.5 h-3.5 mr-1.5" />
                            雙重中獎登錄
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportWinnerList}
                            className="rounded-xl border-white/15 bg-slate-800 text-slate-300 hover:text-white text-xs"
                        >
                            <Copy className="w-3.5 h-3.5 mr-1.5" />
                            複製中獎名冊
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsResetModalOpen(true)}
                            className="rounded-xl border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40 text-xs"
                        >
                            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                            重置重開新套
                        </Button>
                    </div>
                </div>
            </div>

            {/* 實時各賞戰況儀表板 (Live Prize Dashboard) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {/* 總籤數與大獎率 */}
                <div className="col-span-2 sm:col-span-4 lg:col-span-2 p-4 rounded-2xl bg-slate-900/80 border border-white/10 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400 font-bold">套籤剩餘進度</span>
                        <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-400/30 text-[11px] font-mono">
                            剩餘 {stats.remaining} / {stats.total} 籤
                        </Badge>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden border border-white/10 mb-3">
                        <div 
                            className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-cyan-400 transition-all duration-300"
                            style={{ width: `${(stats.opened / stats.total) * 100}%` }}
                        />
                    </div>
                    <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400">大賞 (A+B) 剩餘: <strong className="text-amber-400">{stats.bigPrizesRemaining}</strong> 份</span>
                        <span className="text-slate-400">大賞率: <strong className="text-emerald-400">{stats.bigPrizeRate}%</strong></span>
                    </div>
                </div>

                {/* 各賞別卡片 */}
                {prizes.map((p) => {
                    const tierStat = stats.tierStats[p.tier] || { total: p.totalCount, remaining: p.totalCount };
                    const isAllOut = tierStat.remaining === 0;

                    return (
                        <div 
                            key={p.tier}
                            className={cn(
                                "p-3 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between",
                                isAllOut 
                                    ? "bg-slate-950/50 border-white/5 opacity-50 grayscale" 
                                    : "bg-slate-900/80 border-white/10 shadow-sm"
                            )}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className={cn("text-xs font-black", p.color)}>
                                    {p.tier}賞
                                </span>
                                <Badge className={cn(
                                    "text-[10px] px-1.5 py-0 font-mono",
                                    isAllOut ? "bg-slate-800 text-slate-500 border-0" : "bg-white/10 text-white"
                                )}>
                                    {tierStat.remaining} / {tierStat.total}
                                </Badge>
                            </div>
                            <p className="text-[11px] text-slate-300 line-clamp-2 font-medium leading-tight">
                                {p.prizeName}
                            </p>
                            {isAllOut && (
                                <div className="mt-1 text-[10px] text-rose-400 font-black tracking-wider uppercase text-center bg-rose-500/10 py-0.5 rounded">
                                    全數抽畢
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 快速開抽按鈕列 */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-300 font-bold">現場快速連抽：</span>
                    <Button
                        size="sm"
                        onClick={() => handleBatchOpenTickets(1)}
                        disabled={isOpeningBatch || stats.remaining < 1}
                        className="rounded-xl font-black text-xs bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-400/30"
                    >
                        撕 1 抽 (${pricePerDraw})
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => handleBatchOpenTickets(5)}
                        disabled={isOpeningBatch || stats.remaining < 1}
                        className="rounded-xl font-black text-xs bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-400/30"
                    >
                        ⚡ 5 連抽 (${pricePerDraw * Math.min(5, stats.remaining)})
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => handleBatchOpenTickets(10)}
                        disabled={isOpeningBatch || stats.remaining < 1}
                        className="rounded-xl font-black text-xs bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-400/30"
                    >
                        💥 10 連抽 (${pricePerDraw * Math.min(10, stats.remaining)})
                    </Button>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        size="sm"
                        onClick={() => handleBatchOpenTickets(stats.remaining)}
                        disabled={isOpeningBatch || stats.remaining === 0}
                        className="rounded-xl font-black text-xs bg-gradient-to-r from-rose-600 via-amber-600 to-yellow-500 hover:from-rose-500 hover:to-yellow-400 text-slate-950 shadow-[0_0_20px_rgba(244,63,94,0.4)]"
                    >
                        👑 一鍵全包 (${stats.buyoutRemainingPrice.toLocaleString()} 元，帶走 Last One)
                    </Button>
                </div>
            </div>

            {/* 🎟️ 3D 一番賞籤紙撕籤牆 (80 抽實體籤盒牆) */}
            <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 sm:p-7 backdrop-blur-xl shadow-xl">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
                        <h3 className="text-base sm:text-lg font-black text-white">
                            一番賞籤紙牆（點擊任意籤紙即可撕開揭曉）
                        </h3>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                        剩餘 <strong className="text-amber-400">{stats.remaining}</strong> 張籤紙待撕
                    </span>
                </div>

                {/* 籤紙網格 */}
                <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-10 gap-2.5">
                    {tickets.map((t) => {
                        const isOpened = t.isOpened;

                        return (
                            <motion.div
                                key={t.id}
                                whileHover={!isOpened ? { scale: 1.05, y: -2 } : {}}
                                whileTap={!isOpened ? { scale: 0.95 } : {}}
                                onClick={() => !isOpened && handleTearSingleTicket(t.id)}
                                className={cn(
                                    "aspect-[3/4] rounded-xl p-2 flex flex-col justify-between items-center text-center transition-all select-none relative overflow-hidden",
                                    isOpened
                                        ? "bg-slate-950/70 border border-white/5 opacity-50 cursor-default"
                                        : "bg-gradient-to-b from-amber-200 via-amber-100 to-amber-300 border-2 border-amber-400/80 shadow-[0_4px_12px_rgba(245,158,11,0.25)] cursor-pointer hover:border-amber-300"
                                )}
                            >
                                {/* 撕籤外觀裝飾 */}
                                {!isOpened ? (
                                    <>
                                        <div className="w-full flex items-center justify-between text-[10px] font-black text-amber-900">
                                            <span>一番賞</span>
                                            <span className="font-mono">#{t.id}</span>
                                        </div>
                                        
                                        <div className="w-8 h-8 rounded-full bg-amber-900/10 border border-amber-900/20 flex items-center justify-center my-auto">
                                            <Sparkles className="w-4 h-4 text-amber-900" />
                                        </div>

                                        <div className="w-full text-center">
                                            <span className="text-[9px] font-black text-amber-950 uppercase tracking-widest bg-amber-400/40 px-1.5 py-0.5 rounded">
                                                點擊撕開
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-full flex items-center justify-between text-[9px] font-mono text-slate-500">
                                            <span>#{t.id}</span>
                                            <span>第{t.drawOrder}抽</span>
                                        </div>

                                        <div className={cn(
                                            "w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shadow-inner",
                                            t.tier === 'A' ? "bg-amber-500 text-slate-950" :
                                            t.tier === 'B' ? "bg-rose-500 text-white" :
                                            t.tier === 'C' ? "bg-purple-500 text-white" :
                                            "bg-slate-800 text-slate-300"
                                        )}>
                                            {t.tier}
                                        </div>

                                        <span className="text-[9px] text-slate-400 truncate w-full">
                                            已開出
                                        </span>
                                    </>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* 開籤揭曉彈窗 (Reveal Modal) */}
            <Dialog open={showRevealModal} onOpenChange={setShowRevealModal}>
                <DialogContent className="sm:max-w-xl bg-slate-900/95 border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(245,158,11,0.3)] backdrop-blur-2xl text-center">
                    <DialogHeader>
                        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(245,158,11,0.4)]">
                            <Sparkles className="w-7 h-7 text-amber-300" />
                        </div>
                        <DialogTitle className="text-2xl font-black text-white">
                            🎉 恭喜揭曉一番賞！
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400">
                            本次共撕開 {recentOpenedTickets.length} 張籤紙，獲得以下獎項：
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-4 max-h-[360px] overflow-y-auto pr-1">
                        {recentOpenedTickets.map((item, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ delay: idx * 0.08 }}
                                className={cn(
                                    "p-4 rounded-2xl border flex items-center justify-between gap-3 text-left shadow-lg",
                                    item.tier === 'A' ? "bg-amber-950/60 border-amber-400/60 shadow-[0_0_25px_rgba(245,158,11,0.3)]" :
                                    item.tier === 'B' ? "bg-rose-950/60 border-rose-400/60 shadow-[0_0_20px_rgba(244,63,94,0.3)]" :
                                    "bg-slate-950/80 border-white/10"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shadow-md shrink-0",
                                        item.tier === 'A' ? "bg-amber-500 text-slate-950" :
                                        item.tier === 'B' ? "bg-rose-500 text-white" :
                                        item.tier === 'C' ? "bg-purple-500 text-white" :
                                        item.tier === 'D' ? "bg-blue-500 text-white" :
                                        "bg-emerald-500 text-slate-950"
                                    )}>
                                        {item.tier}賞
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono text-slate-400">籤號 #{item.id}</span>
                                            <span className="text-[10px] text-amber-300 font-mono">雙重中獎碼: {item.doubleChanceCode}</span>
                                        </div>
                                        <h4 className="text-sm sm:text-base font-black text-white">
                                            {item.prizeName}
                                        </h4>
                                    </div>
                                </div>

                                <Badge className="bg-white/10 text-white text-[10px]">
                                    第 {item.drawOrder} 抽
                                </Badge>
                            </motion.div>
                        ))}
                    </div>

                    <DialogFooter className="flex justify-center sm:justify-center">
                        <Button
                            onClick={() => setShowRevealModal(false)}
                            className="rounded-xl px-8 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm"
                        >
                            確定收下獎品
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 🔥 LAST ONE 賞壓軸大獎彈窗 */}
            <Dialog open={showLastOneModal} onOpenChange={setShowLastOneModal}>
                <DialogContent className="sm:max-w-lg bg-gradient-to-b from-rose-950/95 via-slate-900/95 to-slate-950/95 border-2 border-rose-500/60 rounded-3xl p-6 sm:p-8 shadow-[0_0_80px_rgba(244,63,94,0.5)] backdrop-blur-2xl text-center">
                    <DialogHeader>
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center mb-3 shadow-[0_0_30px_rgba(244,63,94,0.6)] animate-bounce">
                            <Crown className="w-9 h-9 text-slate-950" />
                        </div>
                        <DialogTitle className="text-2xl sm:text-3xl font-black text-white">
                            🔥 恭喜觸發壓軸 LAST ONE 賞！
                        </DialogTitle>
                        <DialogDescription className="text-xs text-rose-200">
                            恭喜撕下全套最後一張籤紙！額外免費帶走卡展壓軸限定大獎：
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-5 rounded-2xl bg-slate-950/90 border-2 border-rose-400/40 my-4 shadow-inner">
                        <span className="text-xs font-black uppercase text-amber-300 tracking-widest block mb-1">
                            ★ 卡展全場最高榮譽特典 ★
                        </span>
                        <h3 className="text-lg sm:text-xl font-black text-white">
                            {lastOnePrize}
                        </h3>
                    </div>

                    <DialogFooter className="flex justify-center sm:justify-center">
                        <Button
                            onClick={() => setShowLastOneModal(false)}
                            className="rounded-xl px-10 h-12 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-black text-base shadow-lg"
                        >
                            🎊 抱走壓軸神獎！
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 雙重中獎登錄彈窗 */}
            <Dialog open={showDoubleChanceModal} onOpenChange={setShowDoubleChanceModal}>
                <DialogContent className="sm:max-w-md bg-slate-900/95 border-2 border-purple-500/40 rounded-3xl p-6 shadow-[0_0_40px_rgba(168,85,247,0.3)]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                            <Award className="w-5 h-5 text-purple-400" />
                            雙重中獎 (Double Chance) 序號抽獎
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400">
                            請輸入您在已開出籤紙上看到的 8 碼英數序號，即時對獎！
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-slate-300">雙重中獎 8 碼序號</Label>
                            <Input
                                placeholder="例如：7K9M2P4X"
                                value={doubleChanceInput}
                                onChange={(e) => setDoubleChanceInput(e.target.value.toUpperCase())}
                                maxLength={8}
                                className="bg-slate-950 border-white/10 font-mono tracking-widest uppercase text-center text-lg text-purple-300"
                            />
                        </div>

                        {doubleChanceResult && (
                            <div className={cn(
                                "p-3.5 rounded-2xl border text-xs text-center font-bold",
                                doubleChanceResult.isWon 
                                    ? "bg-emerald-950/60 border-emerald-400 text-emerald-200" 
                                    : "bg-slate-950 border-white/10 text-slate-400"
                            )}>
                                {doubleChanceResult.prize || '很可惜，此序號未中獎。感謝您熱情參與！'}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex justify-between">
                        <Button variant="outline" onClick={() => setShowDoubleChanceModal(false)} className="rounded-xl border-white/10 text-xs">
                            關閉
                        </Button>
                        <Button onClick={handleCheckDoubleChance} className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold">
                            立即驗證對獎
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 切換套籤範本彈窗 */}
            <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
                <DialogContent className="sm:max-w-xl bg-slate-900/95 border-2 border-white/15 rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-white">
                            📋 選擇卡展熱門一番賞套籤範本
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400">
                            點擊即可立即套用預先配置好的人氣卡展套籤（包含各等級獎品與籤數）：
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-3">
                        {KUJI_TEMPLATES.map((tpl) => (
                            <div
                                key={tpl.id}
                                onClick={() => handleApplyTemplate(tpl)}
                                className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 hover:border-amber-400/60 hover:bg-amber-950/20 cursor-pointer transition-all group"
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="text-sm font-black text-white group-hover:text-amber-300 transition-colors">
                                        {tpl.title}
                                    </h4>
                                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/30 text-[10px]">
                                        ${tpl.pricePerDraw}/抽
                                    </Badge>
                                </div>
                                <p className="text-xs text-slate-400 mb-2">
                                    {tpl.description}
                                </p>
                                <div className="text-[11px] text-rose-300 font-mono">
                                    {tpl.lastOnePrize}
                                </div>
                            </div>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTemplateModalOpen(false)} className="rounded-xl border-white/10 text-xs">
                            取消
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 重置彈窗 */}
            <Dialog open={isResetModalOpen} onOpenChange={setIsResetModalOpen}>
                <DialogContent className="sm:max-w-md bg-slate-900/95 border-2 border-rose-500/40 rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                            <RotateCcw className="w-5 h-5 text-rose-400" />
                            重置此套一番賞
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400">
                            確定要將目前這套一番賞重新封籤、打亂洗牌並重開一輪嗎？（歷史開獎將清空）
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="flex justify-between mt-4">
                        <Button variant="outline" onClick={() => setIsResetModalOpen(false)} className="rounded-xl border-white/10 text-xs">
                            取消
                        </Button>
                        <Button onClick={handleResetCurrentKuji} className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold">
                            確認重開新套
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
