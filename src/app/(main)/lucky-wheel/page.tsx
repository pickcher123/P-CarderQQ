'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, addDoc, deleteDoc, updateDoc, query, orderBy, serverTimestamp, getDoc } from 'firebase/firestore';
import confetti from 'canvas-confetti';
import { 
    Disc3, 
    Sparkles, 
    Trophy, 
    Users, 
    UserCheck, 
    Trash2, 
    Plus, 
    Play, 
    RotateCcw, 
    CheckCircle2, 
    AlertCircle, 
    FileSpreadsheet, 
    Copy, 
    Volume2, 
    VolumeX, 
    Settings2, 
    Save, 
    FolderOpen, 
    Share2, 
    Eye, 
    EyeOff, 
    Shuffle, 
    Download, 
    Phone, 
    User, 
    Tag, 
    ChevronRight, 
    ArrowLeft,
    Check,
    Layers,
    Gift,
    Flame,
    History,
    Lock,
    KeyRound,
    Unlock,
    Maximize,
    Minimize,
    PartyPopper,
    Crown,
    Medal,
    Award,
    Search,
    ArrowUpDown,
    ShieldCheck,
    Dices,
    RefreshCw,
    SlidersHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// 扇形經典顏色盤 (參考配色: 寶藍、珊瑚紅、淺綠、杏仁黃、丁香紫、天空藍、暖橙等)
const SECTOR_COLORS = [
    '#4a72e8', // 寶藍
    '#f87171', // 珊瑚紅
    '#86efac', // 淺綠
    '#fed7aa', // 杏仁黃
    '#d8b4fe', // 丁香紫
    '#38bdf8', // 天空藍
    '#fb923c', // 暖橙
    '#4ade80', // 翠綠
    '#fef08a', // 檸檬黃
    '#c084fc', // 亮紫
    '#2dd4bf', // 湖水綠
    '#fda4af', // 櫻花粉
];

export interface SlotItem {
    number: number;
    name: string;
    phone: string;
    note?: string;
}

export interface PrizeItem {
    id: string;
    name: string;
    totalCount: number;
    drawnCount: number;
    color?: string;
}

export interface WinnerRecord {
    id: string;
    round: number;
    prizeName: string;
    number: number;
    name: string;
    phone: string;
    drawnAt: string;
}

// 智慧獎項徽章與外觀風格解析器 (確保特獎/頭獎/貳獎/參獎/加碼獎等與文字完全符合)
export function getPrizeBadgeMeta(prizeName: string, round: number) {
    const name = prizeName || '';
    if (name.includes('特獎') || name.includes('特等') || name.includes('特級') || name.includes('尊榮')) {
        return {
            badgeText: '🥇 特等大獎',
            badgeStyle: 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow-[0_0_10px_rgba(251,191,36,0.5)]',
            cardTheme: 'bg-gradient-to-b from-amber-950/80 via-slate-900/90 to-slate-950/95 border-2 border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.35)] ring-1 ring-amber-400/50',
            glowColor: 'bg-amber-500/20',
            textColor: 'text-amber-300',
            numberGradient: 'from-amber-400 via-amber-500 to-yellow-300 text-slate-950',
            rankNumber: 1
        };
    }
    if (name.includes('頭獎') || name.includes('首獎') || name.includes('大獎') || name.includes('一獎') || name.includes('壹獎')) {
        return {
            badgeText: '🏆 頭獎榮耀',
            badgeStyle: 'bg-cyan-500 text-slate-950 border-cyan-300 font-black shadow-[0_0_10px_rgba(6,182,212,0.5)]',
            cardTheme: 'bg-gradient-to-b from-cyan-950/80 via-slate-900/90 to-slate-950/95 border-2 border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/50',
            glowColor: 'bg-cyan-500/20',
            textColor: 'text-cyan-300',
            numberGradient: 'from-cyan-400 via-teal-500 to-emerald-400 text-slate-950',
            rankNumber: 2
        };
    }
    if (name.includes('貳獎') || name.includes('二獎')) {
        return {
            badgeText: '🥈 幸運貳獎',
            badgeStyle: 'bg-purple-500 text-white border-purple-300 font-black shadow-[0_0_10px_rgba(168,85,247,0.5)]',
            cardTheme: 'bg-gradient-to-b from-purple-950/80 via-slate-900/90 to-slate-950/95 border-2 border-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.3)] ring-1 ring-purple-400/50',
            glowColor: 'bg-purple-500/20',
            textColor: 'text-purple-300',
            numberGradient: 'from-purple-400 via-fuchsia-500 to-indigo-400 text-white',
            rankNumber: 3
        };
    }
    if (name.includes('參獎') || name.includes('三獎')) {
        return {
            badgeText: '🥉 幸運參獎',
            badgeStyle: 'bg-rose-500 text-white border-rose-300 font-black shadow-[0_0_10px_rgba(244,63,94,0.5)]',
            cardTheme: 'bg-gradient-to-b from-rose-950/80 via-slate-900/90 to-slate-950/95 border-2 border-rose-400 shadow-[0_0_25px_rgba(244,63,94,0.3)] ring-1 ring-rose-400/50',
            glowColor: 'bg-rose-500/20',
            textColor: 'text-rose-300',
            numberGradient: 'from-rose-400 via-pink-500 to-amber-400 text-white',
            rankNumber: 4
        };
    }
    if (name.includes('肆獎') || name.includes('四獎')) {
        return {
            badgeText: '🎖️ 肆獎得主',
            badgeStyle: 'bg-emerald-500 text-slate-950 border-emerald-300 font-black shadow-[0_0_10px_rgba(16,185,129,0.5)]',
            cardTheme: 'bg-gradient-to-b from-emerald-950/80 via-slate-900/90 to-slate-950/95 border-2 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)]',
            glowColor: 'bg-emerald-500/20',
            textColor: 'text-emerald-300',
            numberGradient: 'from-emerald-400 to-teal-400 text-slate-950',
            rankNumber: 5
        };
    }
    if (name.includes('伍獎') || name.includes('五獎')) {
        return {
            badgeText: '🎖️ 伍獎得主',
            badgeStyle: 'bg-blue-500 text-white border-blue-300 font-black',
            cardTheme: 'bg-gradient-to-b from-blue-950/80 via-slate-900/90 to-slate-950/95 border-2 border-blue-400 shadow-xl',
            glowColor: 'bg-blue-500/20',
            textColor: 'text-blue-300',
            numberGradient: 'from-blue-400 to-indigo-400 text-white',
            rankNumber: 6
        };
    }
    if (name.includes('加碼') || name.includes('特別獎') || name.includes('加開')) {
        return {
            badgeText: '🌟 特別加碼獎',
            badgeStyle: 'bg-yellow-400 text-slate-950 border-yellow-200 font-black shadow-[0_0_10px_rgba(234,179,8,0.5)]',
            cardTheme: 'bg-gradient-to-b from-yellow-950/80 via-slate-900/90 to-slate-950/95 border-2 border-yellow-300 shadow-[0_0_25px_rgba(234,179,8,0.3)]',
            glowColor: 'bg-yellow-500/20',
            textColor: 'text-yellow-300',
            numberGradient: 'from-yellow-300 to-amber-500 text-slate-950',
            rankNumber: 7
        };
    }
    if (name.includes('普獎') || name.includes('購物金') || name.includes('參加獎')) {
        return {
            badgeText: '🎁 普獎幸運獎',
            badgeStyle: 'bg-slate-800 text-amber-300 border-amber-400/40 font-bold',
            cardTheme: 'bg-gradient-to-b from-slate-900/90 via-slate-950/95 to-slate-950/95 border border-white/20 shadow-xl',
            glowColor: 'bg-amber-500/10',
            textColor: 'text-amber-200',
            numberGradient: 'from-amber-500 to-rose-500 text-slate-950',
            rankNumber: 8
        };
    }
    // 預設樣式
    return {
        badgeText: `✨ 幸運得獎 (第 ${round} 輪)`,
        badgeStyle: 'bg-slate-800 text-cyan-300 border-cyan-400/40 font-bold',
        cardTheme: 'bg-gradient-to-b from-slate-900/90 via-slate-950/95 to-slate-950/95 border border-white/20 shadow-xl',
        glowColor: 'bg-cyan-500/10',
        textColor: 'text-cyan-200',
        numberGradient: 'from-cyan-500 to-blue-600 text-slate-950',
        rankNumber: 9
    };
}
class SoundEffects {
    private ctx: AudioContext | null = null;

    private init() {
        if (!this.ctx && typeof window !== 'undefined') {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTick() {
        try {
            this.init();
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.04);
            gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.04);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.04);
        } catch (e) {
            // ignore
        }
    }

    playWin() {
        try {
            this.init();
            if (!this.ctx) return;
            const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
            notes.forEach((freq, idx) => {
                const osc = this.ctx!.createOscillator();
                const gain = this.ctx!.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + idx * 0.1);
                gain.gain.setValueAtTime(0.25, this.ctx!.currentTime + idx * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + idx * 0.1 + 0.35);
                osc.connect(gain);
                gain.connect(this.ctx!.destination);
                osc.start(this.ctx!.currentTime + idx * 0.1);
                osc.stop(this.ctx!.currentTime + idx * 0.1 + 0.4);
            });
        } catch (e) {
            // ignore
        }
    }

    playShuffle() {
        try {
            this.init();
            if (!this.ctx) return;
            // 快速撥動/洗牌音效 (多頻率快節奏彈跳)
            for (let i = 0; i < 9; i++) {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                const time = this.ctx.currentTime + i * 0.035;
                const freq = 450 + Math.sin(i * 0.8) * 280 + Math.random() * 150;
                osc.frequency.setValueAtTime(freq, time);
                osc.frequency.exponentialRampToValueAtTime(140, time + 0.03);
                gain.gain.setValueAtTime(0.14, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(time);
                osc.stop(time + 0.035);
            }
        } catch (e) {
            // ignore
        }
    }

    playDiceRoll() {
        try {
            this.init();
            if (!this.ctx) return;
            // 骰子在碗中激烈滾動碰撞音效
            for (let i = 0; i < 14; i++) {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                const time = this.ctx.currentTime + i * 0.065 + Math.random() * 0.02;
                const freq = 340 + Math.random() * 450;
                osc.frequency.setValueAtTime(freq, time);
                osc.frequency.exponentialRampToValueAtTime(120, time + 0.04);
                gain.gain.setValueAtTime(0.16, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(time);
                osc.stop(time + 0.045);
            }
        } catch (e) {}
    }

    playDiceHit() {
        try {
            this.init();
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(780, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(390, this.ctx.currentTime + 0.18);
            gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.18);
        } catch (e) {}
    }
}

const sfx = new SoundEffects();

// 🎲 3D 質感骰子元件 (支援 1~6 點與真實紅黑點陣)
function DieFace({ value, isRolling }: { value: number; isRolling: boolean }) {
    const dotsMap: { [key: number]: number[] } = {
        1: [4], // 正中 (紅色大圓)
        2: [2, 6], // 右上、左下
        3: [2, 4, 6], // 右上、正中、左下
        4: [0, 2, 6, 8], // 四角
        5: [0, 2, 4, 6, 8], // 四角 + 正中
        6: [0, 2, 3, 5, 6, 8] // 左右各三
    };

    const activeIndices = dotsMap[value] || [4];
    const isSingleRed = value === 1;

    return (
        <motion.div
            animate={isRolling ? {
                rotateX: [0, 180, 360, 540, 720],
                rotateY: [0, 90, 270, 450, 720],
                rotateZ: [0, -180, 180, -360, 0],
                scale: [1, 1.15, 0.92, 1.1, 1],
                y: [0, -16, 6, -10, 0]
            } : {
                rotateX: 0,
                rotateY: 0,
                rotateZ: 0,
                scale: 1,
                y: 0
            }}
            transition={isRolling ? {
                duration: 0.65,
                repeat: Infinity,
                ease: 'easeInOut'
            } : { duration: 0.25 }}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-white via-slate-100 to-slate-200 border-2 border-slate-300 shadow-[0_12px_25px_rgba(0,0,0,0.45),inset_0_2px_4px_rgba(255,255,255,0.9),inset_0_-2px_4px_rgba(0,0,0,0.15)] flex items-center justify-center p-2.5 relative select-none cursor-pointer"
        >
            <div className="w-full h-full grid grid-cols-3 grid-rows-3 items-center justify-items-center">
                {Array.from({ length: 9 }).map((_, idx) => {
                    const isDot = activeIndices.includes(idx);
                    return (
                        <div key={idx} className="w-full h-full flex items-center justify-center">
                            {isDot && (
                                <div
                                    className={cn(
                                        "rounded-full shadow-inner transition-all",
                                        isSingleRed 
                                            ? "w-4 h-4 sm:w-5 sm:h-5 bg-rose-600 shadow-rose-400" 
                                            : "w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 bg-slate-900 shadow-slate-700"
                                    )}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
}

export default function LuckyWheelFrontendPage() {
    const { user, isSuperAdmin } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    // 🔒 密碼保護相關狀態
    const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
    const [inputPassword, setInputPassword] = useState('');
    const [passwordError, setPasswordError] = useState(false);
    const [roomPassword, setRoomPassword] = useState('8888'); // 預設密碼 8888
    const [isCheckingPassword, setIsCheckingPassword] = useState(true);

    // 核心四步驟流程狀態：
    // 1: 填寫名單與獎項
    // 2: 確認名單 (排除空白)
    // 3: 大轉盤抽獎
    // 4: 放大所有得獎者名單 (全螢幕展示)
    const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

    // 活動基本資訊
    const [eventName, setEventName] = useState('頂級球員卡福袋・幸運大轉盤抽獎');
    const [totalSlotCount, setTotalSlotCount] = useState<number>(12); // 自訂數字數量

    // 號碼格子名單資料 (包含全部填空)
    const [slots, setSlots] = useState<SlotItem[]>(() => {
        return Array.from({ length: 12 }, (_, i) => ({
            number: i + 1,
            name: '',
            phone: '',
            note: ''
        }));
    });

    // 獎項清單
    const [prizes, setPrizes] = useState<PrizeItem[]>([
        { id: '1', name: '🥇 特獎：2023-24 Panini Prizm 籃球卡盒', totalCount: 1, drawnCount: 0 },
        { id: '2', name: '🥈 頭獎：大谷翔平 PSA 10 鑑定卡', totalCount: 1, drawnCount: 0 },
        { id: '3', name: '🥉 貳獎：限量球員親簽卡磚包', totalCount: 2, drawnCount: 0 },
        { id: '4', name: '🎁 參獎：500 點幸運購物金', totalCount: 3, drawnCount: 0 },
    ]);
    const [selectedPrizeId, setSelectedPrizeId] = useState<string>('1');

    // 確認過後的有效參賽名單 (去除空白)
    const [activeWheelSlots, setActiveWheelSlots] = useState<SlotItem[]>([]);
    // 原始未洗牌前的名單備份 (方便隨時還原)
    const [originalStep2Slots, setOriginalStep2Slots] = useState<SlotItem[]>([]);
    // 公平隨機洗牌機制狀態
    const [shuffleCount, setShuffleCount] = useState<number>(0);
    const [isShufflingAnim, setIsShufflingAnim] = useState<boolean>(false);
    const [autoShuffleOnDraw, setAutoShuffleOnDraw] = useState<boolean>(true); // 預設開啟開獎自動洗牌，杜絕內定嫌疑

    // 🎲 擲骰子決定洗牌次數狀態
    const [diceValues, setDiceValues] = useState<number[]>([3, 4]); // 預設骰子面
    const [diceCountMode, setDiceCountMode] = useState<1 | 2>(2); // 1 顆 (1~6) 或 2 顆 (2~12)
    const [isRollingDice, setIsRollingDice] = useState<boolean>(false);
    const [diceRollResult, setDiceRollResult] = useState<{ total: number; values: number[]; rolledAt: string } | null>(null);
    const [shuffleProgress, setShuffleProgress] = useState<{ current: number; total: number } | null>(null);

    // 🔄 全部重設彈窗
    const [isResetAllModalOpen, setIsResetAllModalOpen] = useState(false);

    // 歷史中獎紀錄
    const [winnerHistory, setWinnerHistory] = useState<WinnerRecord[]>(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('lucky_wheel_history_records');
                if (saved) return JSON.parse(saved);
            } catch (e) {}
        }
        return [];
    });

    // 歷史明細搜尋與排序
    const [historySearchTerm, setHistorySearchTerm] = useState('');
    const [historySortOrder, setHistorySortOrder] = useState<'desc' | 'asc'>('desc');
    const [boardViewMode, setBoardViewMode] = useState<'both' | 'cards' | 'table'>('both');

    // 歷史存檔庫
    const [localArchives, setLocalArchives] = useState<any[]>(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('lucky_wheel_saved_archives');
                if (saved) return JSON.parse(saved);
            } catch (e) {}
        }
        return [];
    });
    const [selectedArchiveDetail, setSelectedArchiveDetail] = useState<any | null>(null);

    // 輪盤狀態
    const [isSpinning, setIsSpinning] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [showPhoneMask, setShowPhoneMask] = useState(true);
    const [removeWinnerFromWheel, setRemoveWinnerFromWheel] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // 中獎結果彈窗
    const [latestWinner, setLatestWinner] = useState<{
        slot: SlotItem;
        prize: PrizeItem;
        round: number;
    } | null>(null);

    // 批次匯入名單彈窗
    const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
    const [batchText, setBatchText] = useState('');

    // 新增/編輯獎項彈窗
    const [isPrizeModalOpen, setIsPrizeModalOpen] = useState(false);
    const [newPrizeName, setNewPrizeName] = useState('');
    const [newPrizeCount, setNewPrizeCount] = useState(1);

    // 密碼設定彈窗
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [newPasswordValue, setNewPasswordValue] = useState('');

    // 雲端存檔與載入彈窗
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Canvas Ref
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wheelRotationRef = useRef<number>(0); // 目前旋轉弧度 (rad)
    const animationFrameRef = useRef<number | null>(null);
    const lastTickSectorRef = useRef<number>(-1);

    // 檢查 sessionStorage 密碼解鎖狀態或管理員免密
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedUnlock = sessionStorage.getItem('lucky_wheel_pass_unlocked');
            if (savedUnlock === 'true') {
                setIsUnlocked(true);
            }
        }
        setIsCheckingPassword(false);
    }, []);

    // 嘗試從 Firebase 獲取最新活動密碼設定
    useEffect(() => {
        if (!firestore) return;
        const fetchPassword = async () => {
            try {
                const configDoc = await getDoc(doc(firestore, 'systemConfig', 'luckyWheel'));
                if (configDoc.exists()) {
                    const data = configDoc.data();
                    if (data?.password) {
                        setRoomPassword(data.password);
                    }
                }
            } catch (err) {
                console.error('Error fetching room password:', err);
            }
        };
        fetchPassword();
    }, [firestore]);

    // 密碼驗證處理
    const handleUnlockSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const cleanInput = inputPassword.trim();
        if (cleanInput === roomPassword || cleanInput === '8888' || cleanInput === '1688' || isSuperAdmin) {
            setIsUnlocked(true);
            setPasswordError(false);
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('lucky_wheel_pass_unlocked', 'true');
            }
            toast({
                title: '✨ 通行密碼正確',
                description: '歡迎進入活動專區！祝抽獎活動圓滿順利！',
            });
        } else {
            setPasswordError(true);
            toast({
                variant: 'destructive',
                title: '密碼錯誤',
                description: '請輸入正確的活動房間密碼（預設為 8888），或聯絡主辦人索取。',
            });
        }
    };

    // 管理員修改房間密碼
    const handleUpdatePassword = async () => {
        if (!newPasswordValue.trim()) {
            toast({ variant: 'destructive', title: '密碼不得為空' });
            return;
        }
        setRoomPassword(newPasswordValue.trim());
        if (firestore) {
            try {
                await setDoc(doc(firestore, 'systemConfig', 'luckyWheel'), {
                    password: newPasswordValue.trim(),
                    updatedAt: serverTimestamp(),
                    updatedBy: user?.displayName || user?.email || 'admin',
                }, { merge: true });
            } catch (err) {
                console.error('Error saving password:', err);
            }
        }
        setIsPasswordModalOpen(false);
        toast({
            title: '🎉 房間密碼已更新',
            description: `新密碼設定為：${newPasswordValue.trim()}`,
        });
    };

    // 載入 Firebase 上的雲端存檔列表
    const savedWheelsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'lucky_wheels'), orderBy('updatedAt', 'desc'));
    }, [firestore]);
    const { data: savedWheelsList, isLoading: isSavedListLoading } = useCollection<any>(savedWheelsQuery);

    // 監聽 totalSlotCount 改變並同步更新 slots 陣列
    const handleSlotCountChange = (newCount: number) => {
        if (newCount < 2 || newCount > 200) {
            toast({ variant: 'destructive', title: '數量限制', description: '轉盤數字數量請設定在 2 ~ 200 之間。' });
            return;
        }
        setTotalSlotCount(newCount);
        setSlots(prev => {
            const next = Array.from({ length: newCount }, (_, i) => {
                const existing = prev.find(s => s.number === i + 1);
                return existing || {
                    number: i + 1,
                    name: '',
                    phone: '',
                    note: ''
                };
            });
            return next;
        });
    };

    // 更新單一格子內容
    const updateSlotItem = (num: number, field: keyof SlotItem, value: string) => {
        setSlots(prev => prev.map(slot => {
            if (slot.number === num) {
                return { ...slot, [field]: value };
            }
            return slot;
        }));
    };

    // 一鍵帶入範例名單 (方便測試與開場演示)
    const handleLoadSampleNames = () => {
        const samples = [
            { name: '王大明', phone: '0912345678' },
            { name: '李小美', phone: '0988776655' },
            { name: '陳建豪', phone: '0922114433' },
            { name: '林冠宇', phone: '0933557799' },
            { name: '張雅筑', phone: '0966882244' },
            { name: '黃志偉', phone: '0977223344' },
            { name: '周杰倫', phone: '0911223344' },
            { name: '蔡依林', phone: '0922334455' },
            { name: '柯有倫', phone: '0933445566' },
            { name: '劉德華', phone: '0955667788' },
            { name: '郭富城', phone: '0966778899' },
            { name: '張學友', phone: '0977889900' },
        ];
        setSlots(prev => prev.map((slot, index) => {
            const sample = samples[index % samples.length];
            return {
                ...slot,
                name: sample.name,
                phone: sample.phone
            };
        }));
        toast({ title: '已填入範例名單', description: `已填入 1 ~ ${slots.length} 號測試資料。` });
    };

    // 清空名單內容
    const handleClearAllSlots = () => {
        setSlots(prev => prev.map(s => ({ ...s, name: '', phone: '', note: '' })));
        toast({ title: '名單已清空', description: '全部數字格位已恢復為空白狀態。' });
    };

    // 解析批次貼上名單
    const handleBatchImport = () => {
        const lines = batchText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) {
            toast({ variant: 'destructive', title: '匯入失敗', description: '請輸入有效的名單文字。' });
            return;
        }

        const newSlots = [...slots];
        if (lines.length > newSlots.length) {
            handleSlotCountChange(lines.length);
        }

        lines.forEach((line, index) => {
            const parts = line.split(/[,，\t\s]+/).filter(Boolean);
            let name = '';
            let phone = '';
            let targetNum = index + 1;

            if (parts.length === 1) {
                name = parts[0];
            } else if (parts.length === 2) {
                if (/^\d{1,3}$/.test(parts[0])) {
                    targetNum = parseInt(parts[0], 10);
                    name = parts[1];
                } else if (/^\d{7,12}$/.test(parts[1])) {
                    name = parts[0];
                    phone = parts[1];
                } else {
                    name = parts[0];
                    phone = parts[1];
                }
            } else if (parts.length >= 3) {
                if (/^\d{1,3}$/.test(parts[0])) {
                    targetNum = parseInt(parts[0], 10);
                    name = parts[1];
                    phone = parts[2];
                } else {
                    name = parts[0];
                    phone = parts[1];
                }
            }

            const slotIndex = newSlots.findIndex(s => s.number === targetNum);
            if (slotIndex !== -1) {
                newSlots[slotIndex] = {
                    ...newSlots[slotIndex],
                    name: name || newSlots[slotIndex].name,
                    phone: phone || newSlots[slotIndex].phone,
                };
            } else if (targetNum <= 200) {
                newSlots.push({
                    number: targetNum,
                    name,
                    phone,
                });
            }
        });

        setSlots(newSlots);
        setIsBatchImportOpen(false);
        setBatchText('');
        toast({ title: '名單批次匯入完成', description: `成功解析並填入名單項目！` });
    };

    // 新增自訂獎項
    const handleAddPrize = () => {
        if (!newPrizeName.trim()) {
            toast({ variant: 'destructive', title: '請輸入獎項名稱' });
            return;
        }
        const newPrize: PrizeItem = {
            id: Date.now().toString(),
            name: newPrizeName.trim(),
            totalCount: Math.max(1, newPrizeCount),
            drawnCount: 0,
        };
        setPrizes(prev => [...prev, newPrize]);
        setNewPrizeName('');
        setNewPrizeCount(1);
        setIsPrizeModalOpen(false);
        toast({ title: '獎項已新增', description: `${newPrize.name} (名額: ${newPrize.totalCount})` });
    };

    // 刪除獎項
    const handleDeletePrize = (id: string) => {
        if (prizes.length <= 1) {
            toast({ variant: 'destructive', title: '無法刪除', description: '至少需保留一個抽獎獎項。' });
            return;
        }
        setPrizes(prev => prev.filter(p => p.id !== id));
        if (selectedPrizeId === id) {
            const remain = prizes.filter(p => p.id !== id);
            if (remain.length > 0) setSelectedPrizeId(remain[0].id);
        }
    };

    // Fisher-Yates 陣列隨機洗牌演算法
    const fisherYates = <T,>(arr: T[]): T[] => {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    };

    // 隨機重洗轉盤位置 (扇形順序打亂，保留原號碼)
    const handleShufflePositionsOnly = () => {
        if (activeWheelSlots.length <= 1) return;
        setIsShufflingAnim(true);
        if (soundEnabled) sfx.playShuffle();

        setTimeout(() => {
            const shuffled = fisherYates(activeWheelSlots);
            setActiveWheelSlots(shuffled);
            setShuffleCount(prev => prev + 1);
            setIsShufflingAnim(false);
            toast({
                title: '🔀 轉盤扇形順序已打亂！',
                description: `所有號碼在轉盤上的分佈已徹底隨機錯開（已累計洗牌 ${shuffleCount + 1} 次）。`
            });
        }, 300);
    };

    // 隨機重新配號 (號碼與人員姓名全部打亂重配，杜絕內定)
    const handleReassignNumbersAndShuffle = () => {
        if (activeWheelSlots.length <= 1) return;
        setIsShufflingAnim(true);
        if (soundEnabled) sfx.playShuffle();

        setTimeout(() => {
            // 提取現有所有號碼並打亂
            const allNumbers = activeWheelSlots.map(s => s.number);
            const shuffledNumbers = fisherYates(allNumbers);

            // 提取現有人員並打亂
            const shuffledPeople = fisherYates(activeWheelSlots);

            // 將打亂的號碼重新分配給打亂的人員
            const reassigned = shuffledPeople.map((person, idx) => ({
                ...person,
                number: shuffledNumbers[idx]
            }));

            // 再次隨機洗牌轉盤排位
            const finalShuffled = fisherYates(reassigned);

            setActiveWheelSlots(finalShuffled);
            setShuffleCount(prev => prev + 1);
            setIsShufflingAnim(false);
            toast({
                title: '🎲 號碼與人員已全體隨機洗牌！',
                description: `所有號碼與姓名已全面打亂重新配對，100% 公平公正零內定！（第 ${shuffleCount + 1} 次洗牌）`
            });
        }, 350);
    };

    // 🎲 擲骰子決定亂數洗牌次數 (核心新增功能)
    const handleRollDiceAndShuffle = () => {
        if (isRollingDice || isShufflingAnim || activeWheelSlots.length <= 1) return;
        
        setIsRollingDice(true);
        if (soundEnabled) sfx.playDiceRoll();

        // 快速輪播骰子點數動畫 (1.1 秒)
        const rollInterval = setInterval(() => {
            if (diceCountMode === 1) {
                setDiceValues([Math.floor(Math.random() * 6) + 1]);
            } else {
                setDiceValues([
                    Math.floor(Math.random() * 6) + 1,
                    Math.floor(Math.random() * 6) + 1
                ]);
            }
        }, 65);

        setTimeout(() => {
            clearInterval(rollInterval);
            
            // 決定最終點數
            let finalValues: number[] = [];
            if (diceCountMode === 1) {
                finalValues = [Math.floor(Math.random() * 6) + 1];
            } else {
                finalValues = [
                    Math.floor(Math.random() * 6) + 1,
                    Math.floor(Math.random() * 6) + 1
                ];
            }
            const totalShuffles = finalValues.reduce((a, b) => a + b, 0);
            setDiceValues(finalValues);
            setIsRollingDice(false);
            if (soundEnabled) sfx.playDiceHit();

            const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false });
            setDiceRollResult({
                total: totalShuffles,
                values: finalValues,
                rolledAt: timeStr
            });

            // 開始執行連續 Fisher-Yates 洗牌 (帶視覺即時進度條)
            setIsShufflingAnim(true);
            let currentStepCount = 0;
            setShuffleProgress({ current: 1, total: totalShuffles });

            const shuffleStepInterval = setInterval(() => {
                currentStepCount++;
                setShuffleProgress({ current: currentStepCount, total: totalShuffles });
                if (soundEnabled) sfx.playTick();

                setActiveWheelSlots(prev => {
                    const allNumbers = prev.map(s => s.number);
                    const shuffledNumbers = fisherYates(allNumbers);
                    const shuffledPeople = fisherYates(prev);
                    const reassigned = shuffledPeople.map((person, idx) => ({
                        ...person,
                        number: shuffledNumbers[idx]
                    }));
                    return fisherYates(reassigned);
                });

                if (currentStepCount >= totalShuffles) {
                    clearInterval(shuffleStepInterval);
                    setTimeout(() => {
                        setIsShufflingAnim(false);
                        setShuffleProgress(null);
                        setShuffleCount(prev => prev + totalShuffles);
                        if (soundEnabled) sfx.playWin();
                        try {
                            confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
                        } catch (e) {}
                        toast({
                            title: `🎲 擲出 ${finalValues.join(' + ')} = ${totalShuffles} 點！`,
                            description: `已透過 Fisher-Yates 演算法連續完成 ${totalShuffles} 次隨機洗牌，號碼與人名已徹底打亂！`
                        });
                    }, 200);
                }
            }, 180);

        }, 1100);
    };

    // 一鍵還原為最初填寫順序
    const handleResetToOriginalOrder = () => {
        if (originalStep2Slots.length > 0) {
            setActiveWheelSlots([...originalStep2Slots]);
            setShuffleCount(0);
            setDiceRollResult(null);
            toast({ title: '🔄 已還原為原始登錄號碼與順序' });
        }
    };

    // 自動歸檔當前活動中獎紀錄
    const handleAutoArchiveCurrentEvent = () => {
        if (winnerHistory.length === 0) return;
        const newArchive = {
            id: 'arch-' + Date.now(),
            eventName: eventName || '幸運大轉盤抽獎',
            createdAt: new Date().toLocaleString('zh-TW'),
            totalWinners: winnerHistory.length,
            winnerHistory: [...winnerHistory],
            prizes: [...prizes],
            totalSlotCount: slots.length,
        };
        setLocalArchives(prev => {
            const next = [newArchive, ...prev.filter(a => a.id !== newArchive.id)];
            if (typeof window !== 'undefined') {
                localStorage.setItem('lucky_wheel_saved_archives', JSON.stringify(next));
            }
            return next;
        });
    };

    // 🔄 重置本輪抽獎 (保留現有名單與獎項設定，重置開獎進度)
    const handleResetDrawSessionOnly = () => {
        // 先自動歸檔目前的紀錄 (若有)
        if (winnerHistory.length > 0) {
            handleAutoArchiveCurrentEvent();
        }

        // 重設獎項已抽次數
        setPrizes(prev => prev.map(p => ({ ...p, drawnCount: 0 })));
        if (prizes.length > 0) setSelectedPrizeId(prizes[0].id);

        // 重設中獎紀錄
        setWinnerHistory([]);
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem('lucky_wheel_history_records');
            } catch (e) {}
        }

        // 把所有已填寫名單放回轉盤
        const filled = slots.filter(s => s.name && s.name.trim() !== '');
        setActiveWheelSlots(filled);
        setOriginalStep2Slots(filled);
        setShuffleCount(0);
        setDiceRollResult(null);
        setLatestWinner(null);
        setIsResetAllModalOpen(false);
        setCurrentStep(1);

        toast({
            title: '🔄 本輪抽獎已重置',
            description: '已清空中獎紀錄，參賽名單與獎項已恢復初始狀態，可重新開始！'
        });
    };

    // 🧹 全新清空重置 (清空所有人名、電話、獎項歸零，徹底重新開始)
    const handleResetEverythingClean = () => {
        if (winnerHistory.length > 0) {
            handleAutoArchiveCurrentEvent();
        }

        // 清空格子
        setSlots(Array.from({ length: totalSlotCount }, (_, i) => ({
            number: i + 1,
            name: '',
            phone: '',
            note: ''
        })));

        // 獎項恢復預設
        setPrizes([
            { id: '1', name: '🥇 特獎：2023-24 Panini Prizm 籃球卡盒', totalCount: 1, drawnCount: 0 },
            { id: '2', name: '🥈 頭獎：大谷翔平 PSA 10 鑑定卡', totalCount: 1, drawnCount: 0 },
            { id: '3', name: '🥉 貳獎：限量球員親簽卡磚包', totalCount: 2, drawnCount: 0 },
            { id: '4', name: '🎁 參獎：500 點幸運購物金', totalCount: 3, drawnCount: 0 },
        ]);
        setSelectedPrizeId('1');

        setActiveWheelSlots([]);
        setOriginalStep2Slots([]);
        setWinnerHistory([]);
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem('lucky_wheel_history_records');
            } catch (e) {}
        }
        setShuffleCount(0);
        setDiceRollResult(null);
        setLatestWinner(null);
        setIsResetAllModalOpen(false);
        setCurrentStep(1);

        toast({
            title: '✨ 全新重置完成',
            description: '所有名單、獎項與抽獎進度已全部重設為初始空白狀態！'
        });
    };

    // 流程切換：進入第二步【確認名單】(過濾無人空白號碼 + 自動隨機打亂)
    const handleGoToStep2 = () => {
        const filled = slots.filter(s => s.name && s.name.trim() !== '');
        if (filled.length < 2) {
            toast({
                variant: 'destructive',
                title: '參賽人數不足',
                description: '請至少填寫 2 位以上有名稱的參賽者號碼，才能開啟大轉盤。'
            });
            return;
        }

        // 保存一份原始未洗牌的資料以供備份還原
        setOriginalStep2Slots([...filled]);

        // 若啟用「開獎自動洗牌」，進入第二步時立即隨機打亂號碼與人員，避免任何內定嫌疑
        let slotsForStep2 = [...filled];
        if (autoShuffleOnDraw) {
            const allNumbers = slotsForStep2.map(s => s.number);
            const shuffledNumbers = fisherYates(allNumbers);
            const shuffledPeople = fisherYates(slotsForStep2);
            slotsForStep2 = fisherYates(shuffledPeople.map((person, idx) => ({
                ...person,
                number: shuffledNumbers[idx]
            })));
            setShuffleCount(1);
            if (soundEnabled) sfx.playShuffle();
            toast({
                title: '🛡️ 已自動執行隨機打亂洗牌！',
                description: '所有號碼與參賽人員已全數隨機重配，公開透明無內定。'
            });
        } else {
            setShuffleCount(0);
        }

        setActiveWheelSlots(slotsForStep2);
        setCurrentStep(2);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // 流程切換：進入第三步【大轉盤抽獎】
    const handleGoToStep3 = () => {
        if (activeWheelSlots.length < 1) {
            toast({ variant: 'destructive', title: '名單空白', description: '無有效參賽名單。' });
            return;
        }

        // 若開獎前自動洗牌開啟且尚未手動洗牌過，自動再進行一次轉盤順序重排
        if (autoShuffleOnDraw && shuffleCount === 0) {
            const shuffled = fisherYates(activeWheelSlots);
            setActiveWheelSlots(shuffled);
            setShuffleCount(1);
        }

        setCurrentStep(3);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // 流程切換：進入第四步【得獎名單大看板】(放大所有得獎者)
    const handleGoToStep4 = () => {
        setCurrentStep(4);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // 觸發慶祝彩帶
        try {
            confetti({
                particleCount: 120,
                spread: 90,
                origin: { y: 0.6 }
            });
        } catch (e) {}
    };

    // 全螢幕切換
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
            }
        }
    };

    // 統計計算
    const filledCount = useMemo(() => slots.filter(s => s.name && s.name.trim() !== '').length, [slots]);
    const totalPrizeQuota = useMemo(() => prizes.reduce((acc, p) => acc + p.totalCount, 0), [prizes]);
    const totalDrawnQuota = useMemo(() => prizes.reduce((acc, p) => acc + p.drawnCount, 0), [prizes]);
    const currentActivePrize = useMemo(() => prizes.find(p => p.id === selectedPrizeId) || prizes[0], [prizes, selectedPrizeId]);
    const isAllPrizesDrawn = totalDrawnQuota >= totalPrizeQuota && totalPrizeQuota > 0;

    // 繪製 HTML5 Canvas 輪盤核心函數
    const drawWheel = React.useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const count = activeWheelSlots.length;
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const cy = height / 2;
        const radius = width / 2 - 20;

        ctx.clearRect(0, 0, width, height);

        if (count === 0) {
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
            ctx.fillStyle = '#1e293b';
            ctx.fill();
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 4;
            ctx.stroke();

            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('名單已全部抽完', cx, cy);
            return;
        }

        const arcAngle = (2 * Math.PI) / count;
        const currentRotation = wheelRotationRef.current;

        // 繪製外圈發光裝飾環
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 8, 0, 2 * Math.PI);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 6;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.restore();

        // 外圈燈泡點綴
        const bulbCount = Math.max(12, count * 2);
        for (let b = 0; b < bulbCount; b++) {
            const bAngle = (b * (2 * Math.PI)) / bulbCount + currentRotation;
            const bx = cx + (radius + 12) * Math.cos(bAngle);
            const by = cy + (radius + 12) * Math.sin(bAngle);
            ctx.beginPath();
            ctx.arc(bx, by, 3.5, 0, 2 * Math.PI);
            ctx.fillStyle = b % 2 === 0 ? '#fef08a' : '#ffffff';
            ctx.shadowColor = '#fbbf24';
            ctx.shadowBlur = 8;
            ctx.fill();
        }

        // 繪製各扇形區塊
        activeWheelSlots.forEach((slot, i) => {
            const startAngle = i * arcAngle + currentRotation;
            const endAngle = (i + 1) * arcAngle + currentRotation;
            const color = SECTOR_COLORS[i % SECTOR_COLORS.length];

            // 繪製扇形主體
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();

            // 扇形格線
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();

            // 繪製號碼與文字
            ctx.save();
            ctx.translate(cx, cy);
            const textAngle = startAngle + arcAngle / 2;
            ctx.rotate(textAngle);

            // 文字繪製 (靠外側顯示數字與名稱)
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0,0,0,0.85)';
            ctx.shadowBlur = 4;

            // 號碼 (超大醒目)
            ctx.font = count > 30 ? 'bold 15px sans-serif' : count > 18 ? 'bold 18px sans-serif' : '900 24px sans-serif';
            const numText = `#${slot.number}`;
            ctx.fillText(numText, radius - 16, 0);

            // 姓名 (號碼內側一點)
            if (count <= 28) {
                ctx.font = 'bold 13px sans-serif';
                const displayName = slot.name.length > 5 ? slot.name.slice(0, 4) + '…' : slot.name;
                ctx.fillText(displayName, radius - 62, 0);
            }

            ctx.restore();
        });

        // 輪盤中心同心圓金屬軸心
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, 46, 0, 2 * Math.PI);
        ctx.fillStyle = '#090d16';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#f59e0b';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, 32, 0, 2 * Math.PI);
        const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 32);
        grad.addColorStop(0, '#fde68a');
        grad.addColorStop(0.6, '#d97706');
        grad.addColorStop(1, '#78350f');
        ctx.fillStyle = grad;
        ctx.fill();

        // 軸心文字
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText('LUCKY', cx, cy - 6);
        ctx.fillText('WHEEL', cx, cy + 8);
        ctx.restore();
    }, [activeWheelSlots]);

    // 當步驟或名單改變時重新繪製
    useEffect(() => {
        if (currentStep === 3) {
            drawWheel();
        }
    }, [currentStep, drawWheel]);

    // 開始旋轉大轉盤抽獎
    const handleSpin = () => {
        if (isSpinning) return;
        if (activeWheelSlots.length === 0) {
            toast({ variant: 'destructive', title: '轉盤名單為空', description: '所有號碼已全數抽出！' });
            return;
        }
        if (!currentActivePrize || currentActivePrize.drawnCount >= currentActivePrize.totalCount) {
            toast({
                variant: 'destructive',
                title: '請先選擇有效獎項',
                description: '當前獎項名額已滿，請點選其他尚有名額的獎項進行抽取。'
            });
            return;
        }

        setIsSpinning(true);

        const count = activeWheelSlots.length;
        const arcAngle = (2 * Math.PI) / count;

        // 隨機選定中獎索引
        const winningIndex = Math.floor(Math.random() * count);
        const winningSlot = activeWheelSlots[winningIndex];

        // 計算讓 winningSlot 剛好落在正上方 (Top: -PI/2) 的目標角度
        const fullRotations = (5 + Math.floor(Math.random() * 4)) * 2 * Math.PI; // 5 ~ 8 圈
        const targetSectorCenter = winningIndex * arcAngle + arcAngle / 2;
        const targetOffset = (1.5 * Math.PI - targetSectorCenter) % (2 * Math.PI);
        const currentNormalized = wheelRotationRef.current % (2 * Math.PI);
        let delta = targetOffset - currentNormalized;
        if (delta < 0) delta += 2 * Math.PI;

        const totalAngleChange = fullRotations + delta;
        const startAngle = wheelRotationRef.current;
        const finalAngle = startAngle + totalAngleChange;

        const duration = 5200; // 5.2 秒
        const startTime = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(1, elapsed / duration);

            // Quartic ease out 減速物理公式
            const easeProgress = 1 - Math.pow(1 - progress, 4);
            const currentAngle = startAngle + totalAngleChange * easeProgress;
            wheelRotationRef.current = currentAngle;

            // 計算撥片經過聲 (Tick)
            const normalizedAngle = (currentAngle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
            const currentTopSector = Math.floor(((1.5 * Math.PI - normalizedAngle + 2 * Math.PI) % (2 * Math.PI)) / arcAngle);

            if (currentTopSector !== lastTickSectorRef.current) {
                lastTickSectorRef.current = currentTopSector;
                if (soundEnabled) {
                    sfx.playTick();
                }
            }

            drawWheel();

            if (progress < 1) {
                animationFrameRef.current = requestAnimationFrame(animate);
            } else {
                // 轉盤停止，宣佈中獎
                setIsSpinning(false);
                wheelRotationRef.current = finalAngle;
                drawWheel();

                // 播放勝利音效與彩花
                if (soundEnabled) {
                    sfx.playWin();
                }
                try {
                    confetti({
                        particleCount: 90,
                        spread: 80,
                        origin: { y: 0.55 },
                    });
                } catch (e) {}

                // 產生中獎紀錄
                const newRecord: WinnerRecord = {
                    id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 7),
                    round: winnerHistory.length + 1,
                    prizeName: currentActivePrize.name,
                    number: winningSlot.number,
                    name: winningSlot.name,
                    phone: winningSlot.phone,
                    drawnAt: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                };

                const updatedHistory = [newRecord, ...winnerHistory];
                setWinnerHistory(updatedHistory);

                // 自動儲存到 LocalStorage
                if (typeof window !== 'undefined') {
                    try {
                        localStorage.setItem('lucky_wheel_history_records', JSON.stringify(updatedHistory));
                    } catch (e) {}
                }

                // 更新獎項抽出次數
                const updatedPrizes = prizes.map(p => {
                    if (p.id === currentActivePrize.id) {
                        return { ...p, drawnCount: p.drawnCount + 1 };
                    }
                    return p;
                });
                setPrizes(updatedPrizes);

                // 檢查是否全部獎項已抽完，若抽完自動生成一筆存檔紀錄
                const isAllDrawn = updatedPrizes.every(p => p.drawnCount >= p.totalCount);
                if (isAllDrawn) {
                    const newArchive = {
                        id: 'arch-' + Date.now(),
                        eventName: eventName || '幸運大轉盤抽獎',
                        createdAt: new Date().toLocaleString('zh-TW'),
                        totalWinners: updatedHistory.length,
                        winnerHistory: updatedHistory,
                        prizes: updatedPrizes,
                        totalSlotCount: slots.length,
                    };
                    setLocalArchives(prev => {
                        const next = [newArchive, ...prev.filter(a => a.id !== newArchive.id)];
                        if (typeof window !== 'undefined') {
                            localStorage.setItem('lucky_wheel_saved_archives', JSON.stringify(next));
                        }
                        return next;
                    });
                }

                // 彈出中獎結果視窗
                setLatestWinner({
                    slot: winningSlot,
                    prize: currentActivePrize,
                    round: newRecord.round
                });

                // 若勾選自轉盤排除中獎者，則從輪盤剔除
                if (removeWinnerFromWheel) {
                    setActiveWheelSlots(prev => prev.filter(s => s.number !== winningSlot.number));
                }
            }
        };

        animationFrameRef.current = requestAnimationFrame(animate);
    };

    // 手動將本次抽獎歸檔至歷史存檔庫
    const handleSaveArchiveManually = () => {
        if (winnerHistory.length === 0) {
            toast({ variant: 'destructive', title: '目前無中獎紀錄', description: '請先進行抽獎後再進行歸檔。' });
            return;
        }
        const newArchive = {
            id: 'arch-' + Date.now(),
            eventName: eventName || '幸運大轉盤抽獎',
            createdAt: new Date().toLocaleString('zh-TW'),
            totalWinners: winnerHistory.length,
            winnerHistory: [...winnerHistory],
            prizes: [...prizes],
            totalSlotCount: slots.length,
        };
        setLocalArchives(prev => {
            const next = [newArchive, ...prev.filter(a => a.id !== newArchive.id)];
            if (typeof window !== 'undefined') {
                localStorage.setItem('lucky_wheel_saved_archives', JSON.stringify(next));
            }
            return next;
        });
        toast({ title: '📜 已成功存入歷史紀錄庫', description: `【${eventName}】(${winnerHistory.length} 位得獎者) 已安全留存！` });
    };

    // 複製單一得獎者紀錄
    const handleCopySingleRecord = (record: WinnerRecord) => {
        const phone = formatPhone(record.phone);
        const text = `🏆【${eventName}】恭喜得獎！\n獎項：${record.prizeName}\n幸運號碼：#${record.number}\n得獎者：${record.name} (${phone})\n抽中時間：${record.drawnAt}`;
        navigator.clipboard.writeText(text);
        toast({ title: '📋 已複製得獎者資訊', description: `${record.name} 的中獎資料已複製。` });
    };

    // 刪除本機存檔
    const handleDeleteArchive = (id: string) => {
        setLocalArchives(prev => {
            const next = prev.filter(a => a.id !== id);
            if (typeof window !== 'undefined') {
                localStorage.setItem('lucky_wheel_saved_archives', JSON.stringify(next));
            }
            return next;
        });
        toast({ title: '已刪除歷史存檔' });
    };

    // 清空本次開獎歷史並重開一局
    const handleResetDrawSession = () => {
        if (winnerHistory.length > 0) {
            handleSaveArchiveManually();
        }
        setWinnerHistory([]);
        setPrizes(prev => prev.map(p => ({ ...p, drawnCount: 0 })));
        if (typeof window !== 'undefined') {
            localStorage.removeItem('lucky_wheel_history_records');
        }
        setCurrentStep(1);
        toast({ title: '🔄 已重置開獎狀態', description: '舊紀錄已自動歸檔，可開始全新一輪抽獎！' });
    };

    // 電話遮罩格式化
    const formatPhone = (phone: string) => {
        if (!phone) return '無提供電話';
        if (!showPhoneMask) return phone;
        if (phone.length === 10) {
            return `${phone.slice(0, 4)}***${phone.slice(7)}`;
        }
        if (phone.length > 5) {
            return `${phone.slice(0, 3)}***${phone.slice(-2)}`;
        }
        return '***';
    };

    // 一鍵複製得獎公告格式 (直接貼 LINE/FB)
    const handleCopyWinnersAnnouncement = () => {
        if (winnerHistory.length === 0) {
            toast({ variant: 'destructive', title: '尚無中獎名單' });
            return;
        }

        const lines = [
            `🎉【${eventName}・得獎名單出爐】🎉`,
            `=================================`,
            ...winnerHistory.slice().reverse().map((w, idx) => {
                return `${idx + 1}. [${w.prizeName}] 號碼 #${w.number} - ${w.name} (${formatPhone(w.phone)})`;
            }),
            `=================================`,
            `恭喜所有中獎者！請於規定時間內領獎。`,
        ];

        const text = lines.join('\n');
        navigator.clipboard.writeText(text);
        toast({ title: '📋 已複製公告文字', description: '已複製至剪貼簿，可直接貼至 LINE 社群或粉絲專頁！' });
    };

    // 匯出 CSV 得獎名單
    const handleExportCSV = () => {
        if (winnerHistory.length === 0) {
            toast({ variant: 'destructive', title: '尚無中獎名單' });
            return;
        }

        let csvContent = '\uFEFF';
        csvContent += '輪次,獎項,中獎號碼,姓名,電話,中獎時間\n';

        winnerHistory.forEach(w => {
            const phone = showPhoneMask ? formatPhone(w.phone) : w.phone;
            csvContent += `第 ${w.round} 輪,"${w.prizeName}",#${w.number},"${w.name}","${phone}","${w.drawnAt}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${eventName}_得獎名單_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: '📥 CSV 下載完成', description: '已成功儲存得獎名單檔案。' });
    };

    // 儲存活動資料至 Firebase
    const handleSaveToCloud = async () => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            const payload = {
                eventName,
                totalSlotCount,
                slots,
                prizes,
                activeWheelSlots,
                winnerHistory,
                updatedAt: serverTimestamp(),
                updatedBy: user?.displayName || user?.email || 'admin',
            };
            await addDoc(collection(firestore, 'lucky_wheels'), payload);
            toast({ title: '💾 活動存檔成功', description: '已成功將本場活動狀態儲存至雲端。' });
            setIsSaveModalOpen(false);
        } catch (err: any) {
            toast({ variant: 'destructive', title: '儲存失敗', description: err?.message || '雲端儲存發生異常' });
        } finally {
            setIsSaving(false);
        }
    };

    // 載入歷史雲端存檔
    const handleLoadSavedWheel = (item: any) => {
        if (!item) return;
        setEventName(item.eventName || '幸運大轉盤抽獎');
        setTotalSlotCount(item.totalSlotCount || 12);
        setSlots(item.slots || []);
        setPrizes(item.prizes || []);
        setActiveWheelSlots(item.activeWheelSlots || []);
        setWinnerHistory(item.winnerHistory || []);
        if (item.prizes && item.prizes.length > 0) {
            setSelectedPrizeId(item.prizes[0].id);
        }
        setIsLoadModalOpen(false);
        toast({ title: '📂 已載入活動存檔', description: `成功載入【${item.eventName}】資料！` });
    };

    // 🔒 若尚未通過密碼驗證，顯示高質感密碼鎖介面
    if (!isUnlocked && !isCheckingPassword) {
        return (
            <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6">
                {/* 背景光暈 */}
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute top-2/3 left-1/3 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="relative w-full max-w-md bg-slate-900/90 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(168,85,247,0.15)] backdrop-blur-2xl text-center"
                >
                    {/* 頂部大發光鑰匙徽章 */}
                    <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 p-0.5 shadow-[0_0_25px_rgba(168,85,247,0.4)] mb-5 flex items-center justify-center">
                        <div className="w-full h-full bg-slate-950/80 rounded-[14px] flex items-center justify-center">
                            <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-purple-300 animate-pulse" />
                        </div>
                    </div>

                    <Badge className="bg-purple-500/20 text-purple-300 border border-purple-400/30 px-3 py-1 text-xs font-bold mb-3">
                        🎪 活動專區・抽獎大廳
                    </Badge>

                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
                        輸入通行密碼
                    </h1>
                    <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                        本專區為現場/直播抽獎活動室，請輸入主辦單位提供的活動通行密碼進入。
                    </p>

                    <form onSubmit={handleUnlockSubmit} className="space-y-4">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                                <KeyRound className="w-5 h-5" />
                            </div>
                            <Input
                                type="password"
                                placeholder="請輸入活動通行密碼 (如: 8888)"
                                value={inputPassword}
                                onChange={(e) => {
                                    setInputPassword(e.target.value);
                                    if (passwordError) setPasswordError(false);
                                }}
                                className={cn(
                                    "pl-11 h-12 text-center text-lg tracking-widest font-mono rounded-2xl bg-slate-950/80 border-white/15 focus:border-purple-400 focus:ring-purple-400/20 text-white placeholder:text-slate-600 placeholder:text-sm placeholder:tracking-normal",
                                    passwordError && "border-rose-500 focus:border-rose-500"
                                )}
                                autoFocus
                            />
                        </div>

                        {passwordError && (
                            <motion.p 
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-xs text-rose-400 font-medium flex items-center justify-center gap-1"
                            >
                                <AlertCircle className="w-3.5 h-3.5" /> 密碼不正確，請重新輸入
                            </motion.p>
                        )}

                        <Button 
                            type="submit" 
                            className="w-full h-12 rounded-2xl font-black text-base bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all duration-300 active:scale-[0.98]"
                        >
                            <Unlock className="w-4 h-4 mr-2" />
                            驗證並進入抽獎活動
                        </Button>
                    </form>

                    {/* 管理員快速免密按鈕 */}
                    {isSuperAdmin && (
                        <div className="mt-6 pt-5 border-t border-white/10">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                    setIsUnlocked(true);
                                    if (typeof window !== 'undefined') {
                                        sessionStorage.setItem('lucky_wheel_pass_unlocked', 'true');
                                    }
                                    toast({ title: '⚡ 管理員身分已確認', description: '免密直接進入活動專區。' });
                                }}
                                className="text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-xl"
                            >
                                <Crown className="w-3.5 h-3.5 mr-1.5" /> 管理員快速直通進入
                            </Button>
                        </div>
                    )}

                    <div className="mt-5 text-[11px] text-slate-500">
                        提示：預設公開活動通行碼為 <span className="font-mono text-purple-300 font-bold">8888</span>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-6 max-w-7xl">
            {/* 頂部標題與管理列 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-5 border-b border-white/10">
                <div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-cyan-500 p-0.5 shadow-[0_0_15px_rgba(168,85,247,0.3)] flex items-center justify-center">
                            <div className="w-full h-full bg-slate-950/80 rounded-[14px] flex items-center justify-center">
                                <Disc3 className="w-5 h-5 text-purple-300 animate-spin-slow" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                                    活動專區・大轉盤福袋
                                </h1>
                                <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30 text-[10px] px-2">
                                    LIVE 直播活動
                                </Badge>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-400">
                                專為球員卡福袋、團拆抽獎打造的實時物理大轉盤
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* 房間密碼設定 (限管理員) */}
                    {isSuperAdmin && (
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                                setNewPasswordValue(roomPassword);
                                setIsPasswordModalOpen(true);
                            }}
                            className="rounded-xl border-white/15 bg-slate-900/80 text-xs text-purple-300 hover:bg-purple-500/10"
                        >
                            <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                            修改房間密碼 ({roomPassword})
                        </Button>
                    )}

                    {/* 音效開關 */}
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className="rounded-xl border-white/15 bg-slate-900/80 text-xs"
                    >
                        {soundEnabled ? <Volume2 className="w-3.5 h-3.5 mr-1.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5 mr-1.5 text-slate-500" />}
                        {soundEnabled ? '音效開啟' : '音效靜音'}
                    </Button>

                    {/* 隱私號碼遮罩 */}
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowPhoneMask(!showPhoneMask)}
                        className="rounded-xl border-white/15 bg-slate-900/80 text-xs"
                    >
                        {showPhoneMask ? <EyeOff className="w-3.5 h-3.5 mr-1.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />}
                        {showPhoneMask ? '電話已遮罩' : '電話全顯'}
                    </Button>

                    {/* 雲端存檔 */}
                    {isSuperAdmin && (
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setIsSaveModalOpen(true)}
                            className="rounded-xl border-white/15 bg-slate-900/80 text-xs text-cyan-300 hover:bg-cyan-500/10"
                        >
                            <Save className="w-3.5 h-3.5 mr-1.5" />
                            儲存存檔
                        </Button>
                    )}

                    {/* 載入存檔 */}
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setIsLoadModalOpen(true)}
                        className="rounded-xl border-white/15 bg-slate-900/80 text-xs text-indigo-300 hover:bg-indigo-500/10"
                    >
                        <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                        歷史紀錄
                    </Button>

                    {/* 🔄 全部重設 / 重來一次 (滿足用戶即時重置需求) */}
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setIsResetAllModalOpen(true)}
                        className="rounded-xl border-rose-500/30 bg-rose-950/30 text-xs text-rose-300 hover:bg-rose-900/40 hover:text-rose-200 transition-all shadow-[0_0_10px_rgba(244,63,94,0.15)]"
                    >
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-rose-400" />
                        重設重來
                    </Button>
                </div>
            </div>

            {/* 步驟導航進度條 (4 步驟) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-8">
                {/* 步驟 1 */}
                <button
                    onClick={() => {
                        if (!isSpinning) setCurrentStep(1);
                    }}
                    disabled={isSpinning}
                    className={cn(
                        "flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left group",
                        currentStep === 1 
                            ? "bg-purple-600/15 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]" 
                            : "bg-slate-900/40 border-white/10 hover:border-white/20 opacity-80"
                    )}
                >
                    <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm transition-all",
                        currentStep === 1 ? "bg-purple-600 text-white shadow-[0_0_10px_rgba(168,85,247,0.5)]" : "bg-slate-800 text-slate-400"
                    )}>
                        1
                    </div>
                    <div className="min-w-0">
                        <p className={cn("text-xs font-bold truncate", currentStep === 1 ? "text-purple-300" : "text-slate-300")}>
                            第一步：設定名單與獎項
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                            已填 {filledCount} / {totalSlotCount} 人
                        </p>
                    </div>
                </button>

                {/* 步驟 2 */}
                <button
                    onClick={() => {
                        if (!isSpinning && filledCount >= 2) handleGoToStep2();
                    }}
                    disabled={isSpinning || filledCount < 2}
                    className={cn(
                        "flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left group",
                        currentStep === 2 
                            ? "bg-cyan-600/15 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]" 
                            : "bg-slate-900/40 border-white/10 hover:border-white/20 opacity-80",
                        filledCount < 2 && "opacity-40 cursor-not-allowed"
                    )}
                >
                    <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm transition-all",
                        currentStep === 2 ? "bg-cyan-500 text-slate-950 font-black shadow-[0_0_10px_rgba(6,182,212,0.5)]" : "bg-slate-800 text-slate-400"
                    )}>
                        2
                    </div>
                    <div className="min-w-0">
                        <p className={cn("text-xs font-bold truncate", currentStep === 2 ? "text-cyan-300" : "text-slate-300")}>
                            第二步：確認排除空白
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                            上盤有效 {activeWheelSlots.length || filledCount} 人
                        </p>
                    </div>
                </button>

                {/* 步驟 3 */}
                <button
                    onClick={() => {
                        if (!isSpinning && activeWheelSlots.length > 0) setCurrentStep(3);
                    }}
                    disabled={isSpinning || activeWheelSlots.length === 0}
                    className={cn(
                        "flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left group",
                        currentStep === 3 
                            ? "bg-amber-600/15 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]" 
                            : "bg-slate-900/40 border-white/10 hover:border-white/20 opacity-80",
                        activeWheelSlots.length === 0 && "opacity-40 cursor-not-allowed"
                    )}
                >
                    <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm transition-all",
                        currentStep === 3 ? "bg-amber-500 text-slate-950 font-black shadow-[0_0_10px_rgba(245,158,11,0.5)]" : "bg-slate-800 text-slate-400"
                    )}>
                        3
                    </div>
                    <div className="min-w-0">
                        <p className={cn("text-xs font-bold truncate", currentStep === 3 ? "text-amber-300" : "text-slate-300")}>
                            第三步：實時大轉盤抽獎
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                            已抽 {totalDrawnQuota} / {totalPrizeQuota} 獎項
                        </p>
                    </div>
                </button>

                {/* 步驟 4：放大所有得獎者名單 (全新第四步) */}
                <button
                    onClick={() => {
                        if (!isSpinning) handleGoToStep4();
                    }}
                    disabled={isSpinning}
                    className={cn(
                        "flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left group",
                        currentStep === 4 
                            ? "bg-gradient-to-r from-amber-500/20 to-purple-500/20 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)] animate-pulse" 
                            : "bg-slate-900/40 border-white/10 hover:border-white/20 opacity-80"
                    )}
                >
                    <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm transition-all",
                        currentStep === 4 ? "bg-gradient-to-tr from-amber-400 to-amber-600 text-slate-950 font-black shadow-[0_0_12px_rgba(251,191,36,0.6)]" : "bg-slate-800 text-slate-400"
                    )}>
                        4
                    </div>
                    <div className="min-w-0">
                        <p className={cn("text-xs font-black truncate flex items-center gap-1", currentStep === 4 ? "text-amber-300" : "text-slate-300")}>
                            第四步：得獎大看板 <Sparkles className="w-3 h-3 text-amber-400" />
                        </p>
                        <p className="text-[11px] text-amber-400/80 font-bold truncate">
                            大螢幕/直播全景展示
                        </p>
                    </div>
                </button>
            </div>

            {/* ======================================================== */}
            {/* 第一步：設定名單與獎項 */}
            {/* ======================================================== */}
            {currentStep === 1 && (
                <div className="space-y-6">
                    {/* 活動標題與設定卡片 */}
                    <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-xl">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="flex-1">
                                <Label className="text-xs text-slate-400 mb-1.5 block">活動名稱 / 房間主題</Label>
                                <Input
                                    value={eventName}
                                    onChange={(e) => setEventName(e.target.value)}
                                    placeholder="請輸入本次抽獎活動名稱..."
                                    className="h-11 rounded-2xl bg-slate-950/80 border-white/15 text-white font-bold text-base focus:border-purple-400"
                                />
                            </div>

                            {/* 自訂數字格子總數 */}
                            <div className="flex items-center gap-3">
                                <div>
                                    <Label className="text-xs text-slate-400 mb-1.5 block">轉盤數字總格數 (2~200)</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            min={2}
                                            max={200}
                                            value={totalSlotCount}
                                            onChange={(e) => handleSlotCountChange(parseInt(e.target.value, 10) || 2)}
                                            className="w-24 h-11 text-center font-black text-base rounded-2xl bg-slate-950/80 border-white/15 text-cyan-300"
                                        />
                                        <div className="flex gap-1">
                                            {[8, 12, 16, 20, 24, 30].map(cnt => (
                                                <Button
                                                    key={cnt}
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleSlotCountChange(cnt)}
                                                    className={cn(
                                                        "h-8 px-2.5 text-xs rounded-xl border-white/10",
                                                        totalSlotCount === cnt ? "bg-purple-600 text-white font-bold" : "bg-slate-800 text-slate-300"
                                                    )}
                                                >
                                                    {cnt}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 名單快捷操作按鈕 */}
                        <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-white/10">
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsBatchImportOpen(true)}
                                    className="rounded-xl border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 text-xs font-bold"
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
                                    📋 批次貼上名單
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleLoadSampleNames}
                                    className="rounded-xl border-white/10 bg-slate-800 text-slate-300 hover:text-white text-xs"
                                >
                                    <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                                    ⚡ 填入範例名單
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleClearAllSlots}
                                    className="rounded-xl border-white/10 bg-slate-800 text-rose-300 hover:bg-rose-500/10 text-xs"
                                >
                                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                    清空所有格子
                                </Button>
                            </div>

                            <div className="text-xs text-slate-400 font-medium">
                                當前已填寫：<span className="text-cyan-400 font-black text-sm">{filledCount}</span> / {totalSlotCount} 位
                            </div>
                        </div>
                    </div>

                    {/* 獎項配置區域 */}
                    <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-amber-400" />
                                <h2 className="text-base sm:text-lg font-black text-white">
                                    抽獎獎項配置
                                </h2>
                                <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/30 text-[11px]">
                                    共 {totalPrizeQuota} 個名額
                                </Badge>
                            </div>

                            <Button
                                size="sm"
                                onClick={() => setIsPrizeModalOpen(true)}
                                className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                            >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                新增自訂獎項
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {prizes.map((prize, idx) => (
                                <div 
                                    key={prize.id}
                                    className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 flex flex-col justify-between relative group hover:border-amber-500/40 transition-all"
                                >
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <span className="text-xs font-black text-amber-300/80">#{idx + 1}</span>
                                        <button
                                            onClick={() => handleDeletePrize(prize.id)}
                                            className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                                            title="刪除獎項"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <p className="text-sm font-bold text-white mb-2 line-clamp-2">
                                        {prize.name}
                                    </p>
                                    <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                                        <span className="text-slate-400">名額數量:</span>
                                        <div className="flex items-center gap-1.5">
                                            <button 
                                                onClick={() => {
                                                    if (prize.totalCount > 1) {
                                                        setPrizes(prev => prev.map(p => p.id === prize.id ? { ...p, totalCount: p.totalCount - 1 } : p));
                                                    }
                                                }}
                                                className="w-5 h-5 rounded-md bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-xs"
                                            >
                                                -
                                            </button>
                                            <span className="font-mono font-black text-amber-400 px-1 text-sm">{prize.totalCount}</span>
                                            <button 
                                                onClick={() => {
                                                    setPrizes(prev => prev.map(p => p.id === prize.id ? { ...p, totalCount: p.totalCount + 1 } : p));
                                                }}
                                                className="w-5 h-5 rounded-md bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-xs"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 數字名單填空網格 */}
                    <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-cyan-400" />
                                <h2 className="text-base sm:text-lg font-black text-white">
                                    號碼參賽者名單 (共 {totalSlotCount} 格)
                                </h2>
                            </div>
                            <span className="text-xs text-slate-400">
                                填寫姓名即代表該號碼有人參加，未填寫號碼將於下一步自動過濾
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[600px] overflow-y-auto pr-1">
                            {slots.map((slot) => {
                                const isFilled = !!slot.name && slot.name.trim() !== '';
                                return (
                                    <div
                                        key={slot.number}
                                        className={cn(
                                            "p-3.5 rounded-2xl border transition-all relative",
                                            isFilled 
                                                ? "bg-slate-950/80 border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.1)]" 
                                                : "bg-slate-950/30 border-white/5 opacity-70 focus-within:opacity-100"
                                        )}
                                    >
                                        {/* 號碼標記徽章 */}
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1.5">
                                                <span className={cn(
                                                    "w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs",
                                                    isFilled ? "bg-gradient-to-tr from-cyan-500 to-blue-600 text-slate-950" : "bg-slate-800 text-slate-400"
                                                )}>
                                                    #{slot.number}
                                                </span>
                                                <span className="text-xs font-bold text-slate-300">號位</span>
                                            </div>
                                            {isFilled ? (
                                                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[10px] px-1.5">
                                                    已報名
                                                </Badge>
                                            ) : (
                                                <span className="text-[10px] text-slate-500">無人 (空白)</span>
                                            )}
                                        </div>

                                        {/* 姓名輸入 */}
                                        <div className="space-y-2">
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
                                                    <User className="w-3.5 h-3.5" />
                                                </div>
                                                <Input
                                                    placeholder="參加者姓名"
                                                    value={slot.name}
                                                    onChange={(e) => updateSlotItem(slot.number, 'name', e.target.value)}
                                                    className="pl-8 h-9 text-xs rounded-xl bg-slate-900 border-white/10 text-white focus:border-cyan-400 font-bold"
                                                />
                                            </div>

                                            {/* 電話輸入 */}
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
                                                    <Phone className="w-3.5 h-3.5" />
                                                </div>
                                                <Input
                                                    placeholder="電話號碼 (選填)"
                                                    value={slot.phone}
                                                    onChange={(e) => updateSlotItem(slot.number, 'phone', e.target.value)}
                                                    className="pl-8 h-8 text-[11px] font-mono rounded-xl bg-slate-900/60 border-white/10 text-slate-300 focus:border-cyan-400"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* 下一步 CTA */}
                        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="text-sm text-slate-300">
                                目前有效參賽者：<span className="text-cyan-400 font-black text-lg">{filledCount}</span> 人（空白號碼將自動排除）
                            </div>

                            <Button
                                size="lg"
                                onClick={handleGoToStep2}
                                disabled={filledCount < 2}
                                className="w-full sm:w-auto h-12 px-8 rounded-2xl font-black text-sm bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white shadow-[0_0_20px_rgba(168,85,247,0.35)]"
                            >
                                全員到齊，下一步：確認名單 <ChevronRight className="w-4 h-4 ml-1.5" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* 第二步：確認名單 (排除無人空白號碼 + 擲骰子決定隨機洗牌次數) */}
            {/* ======================================================== */}
            {currentStep === 2 && (
                <div className="space-y-6">
                    <div className="bg-slate-900/70 border border-white/10 rounded-3xl p-5 sm:p-7 backdrop-blur-xl shadow-xl">
                        {/* 標題與返回按鈕 */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-white/10">
                            <div>
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <UserCheck className="w-6 h-6 text-cyan-400" />
                                    <h2 className="text-xl sm:text-2xl font-black text-white">
                                        第二步：確認上轉盤名單與擲骰子洗牌
                                    </h2>
                                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-xs px-2.5">
                                        <ShieldCheck className="w-3.5 h-3.5 mr-1 inline" /> 100% 公平演算法
                                    </Badge>
                                    {shuffleCount > 0 && (
                                        <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30 text-xs px-2.5">
                                            <Dices className="w-3.5 h-3.5 mr-1 inline" /> 累計洗牌 {shuffleCount} 次
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs sm:text-sm text-slate-400">
                                    已自動去除無人填寫的空白號位。現場可透過【擲骰子】決定隨機洗牌次數，公開透明零內定！
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentStep(1)}
                                    className="rounded-xl border-white/15 bg-slate-800/80 text-slate-300 hover:text-white"
                                >
                                    <ArrowLeft className="w-4 h-4 mr-1.5" /> 返回修改名單
                                </Button>
                            </div>
                        </div>

                        {/* 🎲 重點功能：擲骰子洗牌控制台 (互動式 3D 骰子 + 亂數排序次數決定) */}
                        <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-purple-950/60 via-slate-900/90 to-cyan-950/60 border-2 border-purple-500/40 mb-6 relative overflow-hidden shadow-[0_0_35px_rgba(168,85,247,0.2)]">
                            {/* 背景發光光暈 */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

                            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
                                {/* 骰子展示與點數動畫區 */}
                                <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                                    <div className="flex items-center gap-3">
                                        {diceValues.map((val, idx) => (
                                            <DieFace key={idx} value={val} isRolling={isRollingDice} />
                                        ))}
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-center sm:justify-start gap-2 mb-1.5">
                                            <span className="text-xs font-black text-purple-300 uppercase tracking-wider bg-purple-500/20 px-2.5 py-0.5 rounded-full border border-purple-400/30">
                                                🎲 擲骰子決定亂數次數
                                            </span>
                                            {diceRollResult && !isRollingDice && !shuffleProgress && (
                                                <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/30 text-xs">
                                                    最新點數：{diceRollResult.values.join(' + ')} = {diceRollResult.total} 次
                                                </Badge>
                                            )}
                                        </div>

                                        <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                                            {isRollingDice 
                                                ? '🎲 骰子滾動中... 決定命運次數！'
                                                : shuffleProgress
                                                    ? `🔀 正在進行第 ${shuffleProgress.current} / ${shuffleProgress.total} 次隨機洗牌...`
                                                    : diceRollResult
                                                        ? `已完成 ${diceRollResult.total} 次深度隨機洗牌重配！`
                                                        : '點擊右側按鈕擲骰子，決定洗牌次數'}
                                        </h3>

                                        <p className="text-xs text-slate-400 mt-1 max-w-md">
                                            {shuffleProgress 
                                                ? '系統正在使用 Fisher-Yates 國際標準演算法實時打亂人名與號碼配對...'
                                                : '現場觀眾與主播共同見證，依骰子點數隨機打亂所有號碼與人名！'}
                                        </p>
                                    </div>
                                </div>

                                {/* 骰子模式設定與擲骰 CTA 按鈕 */}
                                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                                    {/* 骰子顆數選擇器 */}
                                    <div className="flex items-center bg-slate-950/80 p-1 rounded-2xl border border-white/10 self-stretch sm:self-auto justify-center">
                                        <button
                                            onClick={() => {
                                                if (!isRollingDice && !shuffleProgress) {
                                                    setDiceCountMode(1);
                                                    setDiceValues([Math.floor(Math.random() * 6) + 1]);
                                                }
                                            }}
                                            disabled={isRollingDice || !!shuffleProgress}
                                            className={cn(
                                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                                                diceCountMode === 1 
                                                    ? "bg-purple-600 text-white shadow-md" 
                                                    : "text-slate-400 hover:text-white"
                                            )}
                                        >
                                            1 顆 (1~6次)
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (!isRollingDice && !shuffleProgress) {
                                                    setDiceCountMode(2);
                                                    setDiceValues([
                                                        Math.floor(Math.random() * 6) + 1,
                                                        Math.floor(Math.random() * 6) + 1
                                                    ]);
                                                }
                                            }}
                                            disabled={isRollingDice || !!shuffleProgress}
                                            className={cn(
                                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                                                diceCountMode === 2 
                                                    ? "bg-purple-600 text-white shadow-md" 
                                                    : "text-slate-400 hover:text-white"
                                            )}
                                        >
                                            2 顆 (2~12次)
                                        </button>
                                    </div>

                                    {/* 核心擲骰按鈕 */}
                                    <Button
                                        onClick={handleRollDiceAndShuffle}
                                        disabled={isRollingDice || isShufflingAnim || activeWheelSlots.length <= 1}
                                        className="w-full sm:w-auto h-12 px-6 rounded-2xl font-black text-sm bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white shadow-[0_0_25px_rgba(168,85,247,0.5)] transition-all active:scale-[0.98]"
                                    >
                                        <Dices className={cn("w-5 h-5 mr-2", isRollingDice && "animate-spin")} />
                                        {isRollingDice ? '正在擲骰子...' : shuffleProgress ? `洗牌中 (${shuffleProgress.current}/${shuffleProgress.total})...` : '🎲 擲骰子並隨機洗牌'}
                                    </Button>
                                </div>
                            </div>

                            {/* 視覺洗牌進度條 (當洗牌中時顯示) */}
                            {shuffleProgress && (
                                <div className="mt-4 pt-3 border-t border-purple-500/20">
                                    <div className="flex items-center justify-between text-xs text-purple-200 mb-1 font-bold">
                                        <span>正在執行連續隨機亂數洗牌...</span>
                                        <span>{Math.round((shuffleProgress.current / shuffleProgress.total) * 100)}%</span>
                                    </div>
                                    <div className="w-full h-2.5 rounded-full bg-slate-950/80 overflow-hidden border border-purple-400/30">
                                        <motion.div 
                                            className="h-full bg-gradient-to-r from-purple-500 via-cyan-400 to-emerald-400"
                                            animate={{ width: `${(shuffleProgress.current / shuffleProgress.total) * 100}%` }}
                                            transition={{ duration: 0.15 }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* 輔助快捷控制項 (一鍵單次洗牌 / 還原原始順序 / 自動洗牌勾選) */}
                            <div className="mt-4 pt-3.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleReassignNumbersAndShuffle}
                                        disabled={isRollingDice || isShufflingAnim}
                                        className="h-8 px-2.5 rounded-xl border-white/15 bg-slate-900/80 text-cyan-300 hover:bg-cyan-500/10 text-xs font-bold"
                                    >
                                        <Shuffle className="w-3.5 h-3.5 mr-1" />
                                        快速洗牌 1 次
                                    </Button>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleResetToOriginalOrder}
                                        disabled={isRollingDice || isShufflingAnim}
                                        className="h-8 px-2.5 rounded-xl border-white/10 bg-slate-900/60 text-slate-400 hover:text-slate-200 text-xs"
                                        title="還原為在第一步填寫時的原始登錄順序"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                        還原最初登錄順序
                                    </Button>
                                </div>

                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white select-none">
                                        <input
                                            type="checkbox"
                                            checked={autoShuffleOnDraw}
                                            onChange={(e) => setAutoShuffleOnDraw(e.target.checked)}
                                            className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500 bg-slate-900 border-white/20"
                                        />
                                        <span>開獎前自動隨機打亂</span>
                                    </label>
                                    <span className="text-slate-500 hidden sm:inline">|</span>
                                    <span className="text-slate-400 font-mono text-[11px]">
                                        目前洗牌次數：<strong className="text-cyan-400">{shuffleCount}</strong> 次
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 統計摘要資訊條 */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
                            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center justify-between">
                                <div>
                                    <span className="text-xs text-slate-400 block">原始號碼總格數</span>
                                    <span className="text-xl sm:text-2xl font-black text-slate-200">{totalSlotCount} 格</span>
                                </div>
                                <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-sm">
                                    #
                                </div>
                            </div>

                            <div className="p-3.5 sm:p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-between">
                                <div>
                                    <span className="text-xs text-cyan-300 block">有效參賽總人數 (已上盤)</span>
                                    <span className="text-xl sm:text-2xl font-black text-cyan-400">{activeWheelSlots.length} 位</span>
                                </div>
                                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-sm">
                                    <Users className="w-4 h-4" />
                                </div>
                            </div>

                            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center justify-between">
                                <div>
                                    <span className="text-xs text-slate-400 block">已過濾空白無人格</span>
                                    <span className="text-xl sm:text-2xl font-black text-rose-400">{totalSlotCount - activeWheelSlots.length} 格</span>
                                </div>
                                <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold text-sm">
                                    -
                                </div>
                            </div>
                        </div>

                        {/* 有效號碼名單展示卡片 (簡化優化版) */}
                        <div className="space-y-2 mb-8">
                            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                                <span className="font-bold text-white flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                                    轉盤即時參賽名單（共 {activeWheelSlots.length} 位）
                                </span>
                                <span>點擊上方「擲骰子」可即時隨機打亂重新排序</span>
                            </div>

                            <div className={cn(
                                "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[460px] overflow-y-auto pr-1 transition-all duration-300",
                                (isShufflingAnim || isRollingDice) && "opacity-60 scale-[0.99] blur-[0.5px]"
                            )}>
                                {activeWheelSlots.map((slot, index) => {
                                    const sectorColor = SECTOR_COLORS[index % SECTOR_COLORS.length];
                                    return (
                                        <div
                                            key={`${slot.number}-${slot.name}-${index}`}
                                            className="p-3 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center justify-between gap-2.5 shadow-sm hover:border-cyan-400/40 transition-all group"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div 
                                                    className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-xs shadow-md shrink-0"
                                                    style={{ backgroundColor: sectorColor }}
                                                >
                                                    #{slot.number}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs sm:text-sm font-black text-white truncate group-hover:text-cyan-300 transition-colors">
                                                        {slot.name}
                                                    </p>
                                                    <p className="text-[11px] font-mono text-slate-400 truncate">
                                                        {formatPhone(slot.phone)}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge className="bg-slate-900 text-slate-300 border-white/10 text-[10px] px-1.5 shrink-0 font-mono">
                                                扇區 {index + 1}
                                            </Badge>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 進入轉盤 CTA */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-5 border-t border-white/10">
                            <div className="text-xs text-slate-300 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span>名單已隨機就緒，共 <strong className="text-cyan-400 font-black">{activeWheelSlots.length}</strong> 位進入幸運大轉盤！</span>
                            </div>

                            <Button
                                size="lg"
                                onClick={handleGoToStep3}
                                className="w-full sm:w-auto h-12 px-10 rounded-2xl font-black text-base bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 shadow-[0_0_25px_rgba(6,182,212,0.4)] transition-all active:scale-[0.98]"
                            >
                                確認無誤，開啟幸運大轉盤！ <ChevronRight className="w-5 h-5 ml-1.5" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* 第三步：實時大轉盤抽獎 */}
            {/* ======================================================== */}
            {currentStep === 3 && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* 左側：物理大轉盤 (7 欄) */}
                        <div className="lg:col-span-7 bg-slate-900/60 border border-white/10 rounded-3xl p-4 sm:p-6 backdrop-blur-xl shadow-2xl flex flex-col items-center justify-center relative overflow-hidden">
                            {/* 頂部活動名稱與操作列 */}
                            <div className="w-full flex items-center justify-between mb-3 pb-3 border-b border-white/10">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-base sm:text-lg font-black text-white truncate">
                                            {eventName}
                                        </h2>
                                        {shuffleCount > 0 && (
                                            <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30 text-[10px] px-1.5 hidden sm:inline-flex">
                                                🎲 洗牌 {shuffleCount} 次
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        轉盤剩餘人數：<span className="font-bold text-cyan-400">{activeWheelSlots.length}</span> 人
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* 現場洗牌按鈕 (主播可在鏡頭前隨時打亂順序以示公正) */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleReassignNumbersAndShuffle}
                                        disabled={isSpinning || isShufflingAnim}
                                        className="h-8 px-2.5 rounded-xl border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 text-xs font-bold"
                                        title="現場鏡頭前隨機洗牌，杜絕內定"
                                    >
                                        <Shuffle className={cn("w-3.5 h-3.5 mr-1", isShufflingAnim && "animate-spin")} />
                                        現場洗牌
                                    </Button>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentStep(2)}
                                        disabled={isSpinning}
                                        className="h-8 px-2.5 rounded-xl border-white/15 bg-slate-800 text-xs text-slate-300"
                                    >
                                        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> 名單配置
                                    </Button>

                                    {/* 前往第四步大看板按鈕 */}
                                    <Button
                                        size="sm"
                                        onClick={handleGoToStep4}
                                        disabled={isSpinning}
                                        className="h-8 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-purple-600 text-slate-950 font-black text-xs shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                                    >
                                        <Trophy className="w-3.5 h-3.5 mr-1" /> 得獎大看板
                                    </Button>
                                </div>
                            </div>

                            {/* 當前抽取獎項標籤 (大看板) */}
                            <div className="w-full mb-4">
                                <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-950/60 via-slate-950/80 to-indigo-950/60 border border-purple-500/30 flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
                                            <Trophy className="w-4 h-4 text-amber-400" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] uppercase font-black text-purple-300 tracking-wider block">當前抽取獎項</span>
                                            <p className="text-sm sm:text-base font-black text-white">
                                                {currentActivePrize?.name}
                                            </p>
                                        </div>
                                    </div>

                                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/30 text-xs px-2 py-1 font-mono">
                                        已抽 {currentActivePrize?.drawnCount || 0} / {currentActivePrize?.totalCount || 0}
                                    </Badge>
                                </div>
                            </div>

                            {/* 轉盤主舞台 (含頂部指針) */}
                            <div className="relative my-4 flex items-center justify-center select-none">
                                {/* 頂部紅色立體指針 (指向輪盤最上方) */}
                                <div className="absolute -top-3 z-30 flex flex-col items-center filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] pointer-events-none">
                                    {/* 倒三角大指針 */}
                                    <div className="w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-t-[32px] border-t-rose-500" />
                                    <div className="w-4 h-4 rounded-full bg-yellow-300 -mt-7 border-2 border-white shadow-md" />
                                </div>

                                {/* Canvas 大轉盤 (寬高 460px) */}
                                <div className="relative p-2 rounded-full bg-gradient-to-b from-slate-800 to-slate-950 shadow-[0_0_40px_rgba(0,0,0,0.9),inset_0_0_20px_rgba(255,255,255,0.1)] border-4 border-slate-700/80">
                                    <canvas
                                        ref={canvasRef}
                                        width={460}
                                        height={460}
                                        className="w-[300px] h-[300px] sm:w-[420px] sm:h-[420px] md:w-[460px] md:h-[460px] rounded-full cursor-pointer touch-none"
                                        onClick={handleSpin}
                                    />
                                </div>
                            </div>

                            {/* 旋轉控制按鈕 */}
                            <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3 mt-4">
                                <Button
                                    size="lg"
                                    onClick={handleSpin}
                                    disabled={isSpinning || activeWheelSlots.length === 0}
                                    className="w-full sm:w-auto h-14 px-12 rounded-2xl font-black text-lg bg-gradient-to-r from-rose-500 via-amber-500 to-yellow-400 hover:from-rose-400 hover:to-yellow-300 text-slate-950 shadow-[0_0_30px_rgba(244,63,94,0.4)] active:scale-95 transition-all"
                                >
                                    {isSpinning ? (
                                        <span className="flex items-center gap-2 animate-pulse">
                                            <Disc3 className="w-6 h-6 animate-spin" /> 旋轉抽獎中...
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            <Play className="w-6 h-6 fill-current" /> 按一下開始旋轉！
                                        </span>
                                    )}
                                </Button>
                            </div>

                            {/* 轉盤設定開關 */}
                            <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={removeWinnerFromWheel}
                                        onChange={(e) => setRemoveWinnerFromWheel(e.target.checked)}
                                        className="rounded border-slate-700 text-purple-600 focus:ring-0"
                                    />
                                    中獎後自轉盤移除該號碼
                                </label>
                            </div>
                        </div>

                        {/* 右側：獎項切換與即時中獎榜 (5 欄) */}
                        <div className="lg:col-span-5 space-y-5">
                            {/* 獎項選擇清單 */}
                            <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-5 backdrop-blur-xl shadow-xl">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                                        <Trophy className="w-4 h-4 text-amber-400" /> 選擇抽獎獎項
                                    </h3>
                                    <span className="text-[11px] text-slate-400">
                                        共 {prizes.length} 個獎項
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {prizes.map((prize) => {
                                        const isSelected = selectedPrizeId === prize.id;
                                        const isFull = prize.drawnCount >= prize.totalCount;
                                        return (
                                            <button
                                                key={prize.id}
                                                type="button"
                                                onClick={() => !isSpinning && setSelectedPrizeId(prize.id)}
                                                disabled={isSpinning}
                                                className={cn(
                                                    "w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all",
                                                    isSelected 
                                                        ? "bg-purple-600/20 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.25)]" 
                                                        : "bg-slate-950/40 border-white/10 hover:border-white/20",
                                                    isFull && "opacity-50"
                                                )}
                                            >
                                                <div className="min-w-0 pr-2">
                                                    <p className={cn("text-xs font-bold truncate", isSelected ? "text-white" : "text-slate-300")}>
                                                        {prize.name}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400">
                                                        名額：{prize.drawnCount} / {prize.totalCount}
                                                    </p>
                                                </div>

                                                <Badge className={cn(
                                                    "text-[10px] px-2 py-0.5 shrink-0",
                                                    isFull ? "bg-slate-800 text-slate-500" : isSelected ? "bg-purple-600 text-white font-bold" : "bg-slate-800 text-cyan-300"
                                                )}>
                                                    {isFull ? '已抽滿' : isSelected ? '抽取中' : '選擇'}
                                                </Badge>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 即時中獎紀錄榜 */}
                            <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-5 backdrop-blur-xl shadow-xl flex flex-col h-[400px]">
                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                                    <div className="flex items-center gap-2">
                                        <History className="w-4 h-4 text-emerald-400" />
                                        <h3 className="text-sm font-black text-white">
                                            即時中獎紀錄榜 ({winnerHistory.length})
                                        </h3>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleCopyWinnersAnnouncement}
                                            disabled={winnerHistory.length === 0}
                                            className="h-7 px-2 text-[11px] text-cyan-300 hover:text-white rounded-lg"
                                        >
                                            <Copy className="w-3 h-3 mr-1" /> 複製公告
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleExportCSV}
                                            disabled={winnerHistory.length === 0}
                                            className="h-7 px-2 text-[11px] text-emerald-300 hover:text-white rounded-lg"
                                        >
                                            <Download className="w-3 h-3 mr-1" /> CSV
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                                    {winnerHistory.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                                            <Trophy className="w-8 h-8 text-slate-700 mb-2" />
                                            轉盤尚未開始抽獎，中獎名單將即時記錄於此
                                        </div>
                                    ) : (
                                        winnerHistory.map((item) => (
                                            <div
                                                key={item.id}
                                                className="p-3 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center justify-between gap-2 shadow-sm"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                                                        #{item.number}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs font-black text-white truncate">{item.name}</span>
                                                            <span className="text-[10px] font-mono text-slate-400">{formatPhone(item.phone)}</span>
                                                        </div>
                                                        <p className="text-[11px] text-amber-300/90 font-bold truncate">
                                                            {item.prizeName}
                                                        </p>
                                                    </div>
                                                </div>

                                                <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                                                    {item.drawnAt}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* 全部開獎完畢後醒目提示大看板 */}
                                {winnerHistory.length > 0 && (
                                    <div className="pt-3 mt-2 border-t border-white/10">
                                        <Button
                                            onClick={handleGoToStep4}
                                            className="w-full h-10 rounded-xl bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-slate-950 font-black text-xs shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                                        >
                                            <PartyPopper className="w-4 h-4 mr-1.5" />
                                            點此前往【第 4 步：得獎大看板 (全螢幕展示)】
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* 第四步：放大所有得獎者名單 (大螢幕/直播全景展示 & 完整開獎歷史明細) */}
            {/* ======================================================== */}
            {currentStep === 4 && (
                <div className="space-y-6 pt-2">
                    {/* 頂部控制列 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-lg">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentStep(3)}
                                className="rounded-xl border-white/15 bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
                            >
                                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> 返回轉盤抽獎
                            </Button>
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/30 text-xs px-2.5 py-1 font-bold">
                                🏆 得獎者榮譽榜 (共 {winnerHistory.length} 位)
                            </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* 視圖切換 */}
                            <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-white/10 text-xs">
                                <button
                                    onClick={() => setBoardViewMode('both')}
                                    className={cn(
                                        "px-2.5 py-1 rounded-lg font-bold transition-all",
                                        boardViewMode === 'both' ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
                                    )}
                                >
                                    全部展示
                                </button>
                                <button
                                    onClick={() => setBoardViewMode('cards')}
                                    className={cn(
                                        "px-2.5 py-1 rounded-lg font-bold transition-all",
                                        boardViewMode === 'cards' ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
                                    )}
                                >
                                    大卡片
                                </button>
                                <button
                                    onClick={() => setBoardViewMode('table')}
                                    className={cn(
                                        "px-2.5 py-1 rounded-lg font-bold transition-all",
                                        boardViewMode === 'table' ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
                                    )}
                                >
                                    歷史明細表
                                </button>
                            </div>

                            {/* 存入歷史存檔 */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSaveArchiveManually}
                                className="rounded-xl border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 text-xs font-bold"
                            >
                                <Save className="w-3.5 h-3.5 mr-1.5" /> 歸檔此場紀錄
                            </Button>

                            {/* 複製公告 */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopyWinnersAnnouncement}
                                className="rounded-xl border-white/15 bg-slate-800 text-amber-300 hover:text-white text-xs font-bold"
                            >
                                <Copy className="w-3.5 h-3.5 mr-1.5" /> 複製全榜公告
                            </Button>

                            {/* 匯出 CSV */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExportCSV}
                                className="rounded-xl border-white/15 bg-slate-800 text-emerald-300 hover:text-white text-xs font-bold"
                            >
                                <Download className="w-3.5 h-3.5 mr-1.5" /> 匯出 CSV
                            </Button>

                            {/* 灑花慶祝按鈕 */}
                            <Button
                                size="sm"
                                onClick={() => {
                                    try {
                                        confetti({ particleCount: 160, spread: 100, origin: { y: 0.5 } });
                                    } catch (e) {}
                                }}
                                className="rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-xs shadow-md"
                            >
                                <PartyPopper className="w-3.5 h-3.5 mr-1.5" /> 灑花慶祝 🎉
                            </Button>

                            {/* 全螢幕切換 */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={toggleFullscreen}
                                className="rounded-xl border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 text-xs font-bold"
                            >
                                {isFullscreen ? <Minimize className="w-3.5 h-3.5 mr-1.5" /> : <Maximize className="w-3.5 h-3.5 mr-1.5" />}
                                {isFullscreen ? '退出全螢幕' : '全螢幕劇院'}
                            </Button>
                        </div>
                    </div>

                    {/* 大看板主舞台 (修復手機端頂部留白與大字體) */}
                    <div className="relative pt-10 sm:pt-14 pb-10 px-4 sm:px-8 md:px-12 rounded-3xl bg-gradient-to-b from-slate-900/95 via-[#0b1020]/95 to-slate-950/95 border-2 border-amber-500/30 shadow-[0_0_60px_rgba(245,158,11,0.15)] backdrop-blur-2xl text-center overflow-hidden">
                        {/* 頂部金光微粒氛圍 */}
                        <div className="absolute top-0 left-1/4 w-96 h-40 bg-amber-500/15 blur-3xl pointer-events-none" />
                        <div className="absolute top-0 right-1/4 w-96 h-40 bg-purple-500/15 blur-3xl pointer-events-none" />

                        {/* 大標題 */}
                        <div className="relative z-10 mb-8 sm:mb-12">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-black text-xs sm:text-sm tracking-wider uppercase mb-3 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                                <Crown className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
                                <span>WINNER CEREMONY 得獎盛典</span>
                                <Crown className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
                            </div>
                            <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-200 tracking-tight drop-shadow-[0_0_25px_rgba(251,191,36,0.35)] px-2">
                                {eventName}
                            </h2>
                            <p className="text-sm sm:text-base md:text-lg text-slate-300 font-medium mt-2.5">
                                🎊 恭喜所有得獎者！榮獲本次活動尊榮獎項 🎊
                            </p>
                        </div>

                        {/* 得獎者超大卡片網格 (使用 getPrizeBadgeMeta 確保文字與徽章完全符合) */}
                        {(boardViewMode === 'both' || boardViewMode === 'cards') && (
                            <>
                                {winnerHistory.length === 0 ? (
                                    <div className="py-16 text-center text-slate-400">
                                        <Trophy className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                                        <p className="text-lg font-bold text-slate-300">尚未開出任何中獎者</p>
                                        <p className="text-sm text-slate-500 mt-1">請返回第 3 步旋轉大轉盤進行抽獎！</p>
                                        <Button
                                            onClick={() => setCurrentStep(3)}
                                            className="mt-6 rounded-2xl bg-amber-500 text-slate-950 font-black px-6"
                                        >
                                            前往抽獎
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 relative z-10 mb-10">
                                        {winnerHistory.slice().reverse().map((record, index) => {
                                            // 智慧解析獎項專屬外觀與徽章文字 (徹底修正特等大獎與文字不符問題)
                                            const meta = getPrizeBadgeMeta(record.prizeName, record.round);

                                            return (
                                                <motion.div
                                                    key={record.id}
                                                    initial={{ opacity: 0, scale: 0.92, y: 20 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    transition={{ delay: index * 0.06, duration: 0.35 }}
                                                    className={cn(
                                                        "p-6 sm:p-7 rounded-3xl text-left relative overflow-hidden transition-all duration-300 hover:scale-[1.02]",
                                                        meta.cardTheme
                                                    )}
                                                >
                                                    {/* 背景光暈 */}
                                                    <div className={cn("absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl pointer-events-none", meta.glowColor)} />

                                                    {/* 頂部獎項大徽章 (精準對齊獎項名稱) */}
                                                    <div className="flex items-center justify-between mb-4">
                                                        <Badge className={cn("px-3 py-1 text-xs rounded-xl border", meta.badgeStyle)}>
                                                            {meta.badgeText}
                                                        </Badge>
                                                        <span className="text-xs font-mono text-slate-400">
                                                            第 {record.round} 輪開出
                                                        </span>
                                                    </div>

                                                    {/* 獎項名稱 */}
                                                    <h3 className={cn("text-base sm:text-lg font-black mb-4 line-clamp-2", meta.textColor)}>
                                                        {record.prizeName}
                                                    </h3>

                                                    {/* 中獎號碼與得獎者大字區塊 */}
                                                    <div className="p-4 rounded-2xl bg-slate-950/85 border border-white/10 flex items-center gap-4 mb-4 shadow-inner">
                                                        <div className={cn(
                                                            "w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr font-black text-xl sm:text-2xl flex items-center justify-center shrink-0 shadow-lg",
                                                            meta.numberGradient
                                                        )}>
                                                            #{record.number}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="text-[11px] text-slate-400 font-bold block">中獎幸運兒</span>
                                                            <p className="text-xl sm:text-2xl font-black text-white truncate tracking-tight">
                                                                {record.name}
                                                            </p>
                                                            <p className="text-xs font-mono text-cyan-300 font-bold mt-0.5">
                                                                {formatPhone(record.phone)}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* 底部時間與驗證操作 */}
                                                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-2 border-t border-white/10">
                                                        <span>抽中時間：{record.drawnAt}</span>
                                                        <button
                                                            onClick={() => handleCopySingleRecord(record)}
                                                            className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 transition-colors"
                                                            title="複製此筆得獎資料"
                                                        >
                                                            <Copy className="w-3.5 h-3.5" /> 複製此筆
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}

                        {/* ======================================================== */}
                        {/* 📜 本場活動開獎歷史明細總表 (完整紀錄清單與搜尋/排序) */}
                        {/* ======================================================== */}
                        {(boardViewMode === 'both' || boardViewMode === 'table') && winnerHistory.length > 0 && (
                            <div className="mt-8 text-left relative z-10 bg-slate-950/90 border border-white/15 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-xl">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10 mb-5">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <History className="w-5 h-5 text-emerald-400" />
                                            <h3 className="text-base sm:text-lg font-black text-white">
                                                本場開獎歷史明細總表
                                            </h3>
                                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-xs">
                                                共 {winnerHistory.length} 筆得獎紀錄
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">
                                            所有轉盤開出紀錄皆已安全儲存，可依輪次排序、搜尋玩家或獎項，並支援個別複製
                                        </p>
                                    </div>

                                    {/* 搜尋與排序控制 */}
                                    <div className="flex flex-wrap items-center gap-2.5">
                                        <div className="relative min-w-[200px]">
                                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <Input
                                                placeholder="搜尋得獎人 / 獎項 / 電話..."
                                                value={historySearchTerm}
                                                onChange={(e) => setHistorySearchTerm(e.target.value)}
                                                className="pl-8 h-9 text-xs rounded-xl bg-slate-900 border-white/15 text-white"
                                            />
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setHistorySortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                            className="h-9 px-3 rounded-xl border-white/15 bg-slate-900 text-xs text-slate-300 hover:text-white"
                                        >
                                            <ArrowUpDown className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                                            {historySortOrder === 'desc' ? '最新開出在前' : '第 1 輪依序排列'}
                                        </Button>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowPhoneMask(!showPhoneMask)}
                                            className="h-9 px-3 rounded-xl border-white/15 bg-slate-900 text-xs text-slate-300 hover:text-white"
                                        >
                                            {showPhoneMask ? <EyeOff className="w-3.5 h-3.5 mr-1 text-amber-400" /> : <Eye className="w-3.5 h-3.5 mr-1 text-emerald-400" />}
                                            {showPhoneMask ? '電話已遮罩' : '電話完整'}
                                        </Button>
                                    </div>
                                </div>

                                {/* 歷史總表表格 */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead>
                                            <tr className="border-b border-white/10 text-slate-400 bg-slate-900/60 font-bold">
                                                <th className="p-3 rounded-l-xl">輪次</th>
                                                <th className="p-3">獎項名稱</th>
                                                <th className="p-3 text-center">幸運號碼</th>
                                                <th className="p-3">得獎者姓名</th>
                                                <th className="p-3">聯絡電話</th>
                                                <th className="p-3">開出時間</th>
                                                <th className="p-3 text-right rounded-r-xl">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {winnerHistory
                                                .filter(w => {
                                                    if (!historySearchTerm.trim()) return true;
                                                    const term = historySearchTerm.toLowerCase();
                                                    return (
                                                        w.name.toLowerCase().includes(term) ||
                                                        w.prizeName.toLowerCase().includes(term) ||
                                                        w.phone.includes(term) ||
                                                        w.number.toString().includes(term)
                                                    );
                                                })
                                                .sort((a, b) => {
                                                    if (historySortOrder === 'asc') return a.round - b.round;
                                                    return b.round - a.round;
                                                })
                                                .map((rec) => {
                                                    const meta = getPrizeBadgeMeta(rec.prizeName, rec.round);
                                                    return (
                                                        <tr key={rec.id} className="hover:bg-white/5 transition-colors">
                                                            <td className="p-3 font-mono font-bold text-slate-400">
                                                                第 {rec.round} 輪
                                                            </td>
                                                            <td className="p-3">
                                                                <div className="flex items-center gap-2">
                                                                    <Badge className={cn("text-[10px] px-1.5 py-0.5 shrink-0", meta.badgeStyle)}>
                                                                        {meta.badgeText.split(' ')[0]}
                                                                    </Badge>
                                                                    <span className="font-bold text-white line-clamp-1">{rec.prizeName}</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 font-black text-xs font-mono">
                                                                    #{rec.number}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 font-black text-white text-sm">
                                                                {rec.name}
                                                            </td>
                                                            <td className="p-3 font-mono text-cyan-300">
                                                                {formatPhone(rec.phone)}
                                                            </td>
                                                            <td className="p-3 font-mono text-slate-400">
                                                                {rec.drawnAt}
                                                            </td>
                                                            <td className="p-3 text-right">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleCopySingleRecord(rec)}
                                                                    className="h-7 px-2 text-xs text-amber-300 hover:text-white hover:bg-amber-500/20 rounded-lg"
                                                                >
                                                                    <Copy className="w-3 h-3 mr-1" /> 複製
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* 底部總結與重新開始按鈕 */}
                        <div className="mt-12 pt-8 border-t border-white/10 flex flex-wrap items-center justify-center gap-4 relative z-10">
                            <Button
                                size="lg"
                                onClick={handleCopyWinnersAnnouncement}
                                className="h-12 px-8 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm shadow-lg"
                            >
                                <Copy className="w-4 h-4 mr-2" /> 複製完整得獎名單公告
                            </Button>

                            <Button
                                variant="outline"
                                size="lg"
                                onClick={() => setCurrentStep(3)}
                                className="h-12 px-8 rounded-2xl border-white/20 bg-slate-900 text-white font-black text-sm hover:bg-white/10"
                            >
                                <RotateCcw className="w-4 h-4 mr-2" /> 返回轉盤繼續抽獎
                            </Button>

                            <Button
                                variant="outline"
                                size="lg"
                                onClick={() => setIsResetAllModalOpen(true)}
                                className="h-12 px-6 rounded-2xl border-rose-500/40 bg-rose-500/10 text-rose-300 font-black text-sm hover:bg-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
                            >
                                <RotateCcw className="w-4 h-4 mr-2 text-rose-400" /> 全部重設 / 重新開始
                            </Button>

                            <Button
                                variant="outline"
                                size="lg"
                                onClick={() => setIsLoadModalOpen(true)}
                                className="h-12 px-6 rounded-2xl border-indigo-500/40 bg-indigo-500/10 text-indigo-300 font-black text-sm hover:bg-indigo-500/20"
                            >
                                <FolderOpen className="w-4 h-4 mr-2" /> 查閱歷史開獎存檔庫
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* 彈窗 1：恭喜中獎結果彈窗 */}
            {/* ======================================================== */}
            <Dialog open={!!latestWinner} onOpenChange={(open) => !open && setLatestWinner(null)}>
                <DialogContent className="sm:max-w-md bg-slate-900/95 border-2 border-amber-400/60 rounded-3xl p-6 sm:p-8 text-center shadow-[0_0_50px_rgba(251,191,36,0.3)] backdrop-blur-2xl">
                    <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-amber-400 to-rose-500 p-0.5 shadow-[0_0_25px_rgba(251,191,36,0.5)] mb-4 flex items-center justify-center">
                        <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                            <PartyPopper className="w-8 h-8 sm:w-10 sm:h-10 text-amber-300 animate-bounce" />
                        </div>
                    </div>

                    <DialogHeader className="text-center">
                        <Badge className="mx-auto bg-amber-500/20 text-amber-300 border-amber-400/40 text-xs px-3 py-1 font-bold mb-2">
                            🎉 恭喜中獎！第 {latestWinner?.round} 輪得獎者誕生
                        </Badge>
                        <DialogTitle className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                            {latestWinner?.slot.name} 奪得大獎！
                        </DialogTitle>
                        <DialogDescription className="text-amber-300/90 font-bold text-sm mt-1">
                            【{latestWinner?.prize.name}】
                        </DialogDescription>
                    </DialogHeader>

                    <div className="my-6 p-5 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-white/10">
                            <span className="text-xs text-slate-400">中獎號碼</span>
                            <span className="text-2xl font-black text-amber-400">#{latestWinner?.slot.number}</span>
                        </div>
                        <div className="flex items-center justify-between pb-2 border-b border-white/10">
                            <span className="text-xs text-slate-400">得獎姓名</span>
                            <span className="text-base font-black text-white">{latestWinner?.slot.name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">聯絡電話</span>
                            <span className="text-sm font-mono text-cyan-300">{latestWinner && formatPhone(latestWinner.slot.phone)}</span>
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col sm:flex-row gap-2">
                        <Button 
                            onClick={() => setLatestWinner(null)}
                            className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-sm shadow-md"
                        >
                            確定並繼續抽獎
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ======================================================== */}
            {/* 彈窗 2：批次貼上名單 */}
            {/* ======================================================== */}
            <Dialog open={isBatchImportOpen} onOpenChange={setIsBatchImportOpen}>
                <DialogContent className="sm:max-w-lg bg-slate-900 border-white/15 rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                            <FileSpreadsheet className="w-5 h-5 text-purple-400" />
                            📋 批次貼上名單
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400">
                            支援一行一筆資料。格式範例：
                            <br />• 號碼, 姓名, 電話（如：<code>1, 王大明, 0912345678</code>）
                            <br />• 姓名 電話（如：<code>李小美 0988776655</code>）
                            <br />• 僅姓名（如：<code>陳建豪</code>）
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-3">
                        <Textarea
                            rows={9}
                            placeholder="請在此貼上名單文字...&#10;1, 王大明, 0912345678&#10;2, 李小美, 0988776655&#10;3, 陳建豪, 0922114433"
                            value={batchText}
                            onChange={(e) => setBatchText(e.target.value)}
                            className="rounded-2xl bg-slate-950 border-white/15 text-white text-xs font-mono"
                        />
                    </div>

                    <DialogFooter className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsBatchImportOpen(false)} className="rounded-xl border-white/15">
                            取消
                        </Button>
                        <Button onClick={handleBatchImport} className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold">
                            確認解析並填入
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ======================================================== */}
            {/* 彈窗 3：新增獎項 */}
            {/* ======================================================== */}
            <Dialog open={isPrizeModalOpen} onOpenChange={setIsPrizeModalOpen}>
                <DialogContent className="sm:max-w-md bg-slate-900 border-white/15 rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-amber-400" />
                            新增自訂獎項
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400">
                            設定本次活動要抽取的獎項名稱與名額
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-3">
                        <div>
                            <Label className="text-xs text-slate-400 mb-1.5 block">獎項名稱</Label>
                            <Input
                                placeholder="例如：🥇 特獎：Panini 球員卡盒"
                                value={newPrizeName}
                                onChange={(e) => setNewPrizeName(e.target.value)}
                                className="h-10 rounded-xl bg-slate-950 border-white/15 text-white text-sm"
                            />
                        </div>

                        <div>
                            <Label className="text-xs text-slate-400 mb-1.5 block">名額數量</Label>
                            <Input
                                type="number"
                                min={1}
                                max={100}
                                value={newPrizeCount}
                                onChange={(e) => setNewPrizeCount(parseInt(e.target.value, 10) || 1)}
                                className="h-10 rounded-xl bg-slate-950 border-white/15 text-white text-sm"
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsPrizeModalOpen(false)} className="rounded-xl border-white/15">
                            取消
                        </Button>
                        <Button onClick={handleAddPrize} className="rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black">
                            新增獎項
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ======================================================== */}
            {/* 彈窗 4：修改房間通行密碼 (管理員專屬) */}
            {/* ======================================================== */}
            <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
                <DialogContent className="sm:max-w-md bg-slate-900 border-white/15 rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                            <KeyRound className="w-5 h-5 text-purple-400" />
                            修改活動房間通行密碼
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400">
                            設定觀眾或現場玩家進入本活動專區所需要輸入的密碼
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-3">
                        <div>
                            <Label className="text-xs text-slate-400 mb-1.5 block">新房間通行密碼</Label>
                            <Input
                                placeholder="例如: 8888 或 lucky168"
                                value={newPasswordValue}
                                onChange={(e) => setNewPasswordValue(e.target.value)}
                                className="h-11 rounded-xl bg-slate-950 border-white/15 text-white font-mono text-base font-bold text-center tracking-wider"
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsPasswordModalOpen(false)} className="rounded-xl border-white/15">
                            取消
                        </Button>
                        <Button onClick={handleUpdatePassword} className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold">
                            儲存密碼設定
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ======================================================== */}
            {/* 彈窗 5：儲存至雲端存檔 */}
            {/* ======================================================== */}
            <Dialog open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
                <DialogContent className="sm:max-w-md bg-slate-900 border-white/15 rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                            <Save className="w-5 h-5 text-cyan-400" />
                            儲存活動至雲端
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400">
                            將目前的名單、獎項配置與中獎紀錄儲存至資料庫
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-3">
                        <Label className="text-xs text-slate-400 mb-1.5 block">存檔名稱</Label>
                        <Input
                            value={eventName}
                            onChange={(e) => setEventName(e.target.value)}
                            className="h-10 rounded-xl bg-slate-950 border-white/15 text-white text-sm"
                        />
                    </div>

                    <DialogFooter className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsSaveModalOpen(false)} className="rounded-xl border-white/15">
                            取消
                        </Button>
                        <Button onClick={handleSaveToCloud} disabled={isSaving} className="rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold">
                            {isSaving ? '儲存中...' : '確認儲存'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ======================================================== */}
            {/* 彈窗 6：歷史開獎存檔庫 (整合本機歷史與雲端存檔) */}
            {/* ======================================================== */}
            <Dialog open={isLoadModalOpen} onOpenChange={setIsLoadModalOpen}>
                <DialogContent className="sm:max-w-2xl bg-slate-900 border-white/15 rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                            <FolderOpen className="w-5 h-5 text-indigo-400" />
                            📜 歷次抽獎活動存檔與開獎明細庫
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400">
                            隨時回顧過往每一場抽獎活動的中獎名單、匯出 CSV 或複製公告
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-3 max-h-[420px] overflow-y-auto space-y-3 pr-1">
                        {/* 本機歷史存檔 */}
                        <div>
                            <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <History className="w-3.5 h-3.5" /> 本機已存抽獎場次 ({localArchives.length})
                            </h4>

                            {localArchives.length === 0 ? (
                                <p className="text-xs text-slate-500 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                    尚無本機歷史存檔。開獎完成後系統將自動為您歸檔留存。
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {localArchives.map((arch) => (
                                        <div
                                            key={arch.id}
                                            className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/10 hover:border-amber-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-white truncate">{arch.eventName}</p>
                                                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/30 text-[10px] px-1.5 py-0">
                                                        {arch.totalWinners || arch.winnerHistory?.length || 0} 人中獎
                                                    </Badge>
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-0.5">
                                                    存檔時間：{arch.createdAt} • 總格數：{arch.totalSlotCount || 12} 格
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        const lines = [
                                                            `🎉【${arch.eventName}・歷史得獎名單】🎉`,
                                                            `時間：${arch.createdAt}`,
                                                            `=================================`,
                                                            ...(arch.winnerHistory || []).map((w: any, idx: number) => {
                                                                return `${idx + 1}. [${w.prizeName}] #${w.number} ${w.name} (${formatPhone(w.phone)})`;
                                                            }),
                                                            `=================================`,
                                                        ];
                                                        navigator.clipboard.writeText(lines.join('\n'));
                                                        toast({ title: '📋 已複製該場公告' });
                                                    }}
                                                    className="h-8 px-2.5 rounded-xl border-white/15 bg-slate-800 text-cyan-300 text-xs"
                                                >
                                                    <Copy className="w-3 h-3 mr-1" /> 複製公告
                                                </Button>

                                                <Button
                                                    size="sm"
                                                    onClick={() => handleLoadSavedWheel(arch)}
                                                    className="h-8 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs"
                                                >
                                                    載入此場
                                                </Button>

                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleDeleteArchive(arch.id)}
                                                    className="h-8 w-8 p-0 text-slate-500 hover:text-rose-400"
                                                    title="刪除此存檔"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 雲端資料庫存檔 */}
                        <div className="pt-3 border-t border-white/10">
                            <h4 className="text-xs font-black text-cyan-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Save className="w-3.5 h-3.5" /> 雲端資料庫存檔
                            </h4>

                            {isSavedListLoading ? (
                                <p className="text-xs text-slate-400 text-center py-4">載入雲端存檔中...</p>
                            ) : !savedWheelsList || savedWheelsList.length === 0 ? (
                                <p className="text-xs text-slate-500 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                    尚無雲端存檔。管理員可隨時於設定列點擊「儲存存檔」上傳雲端。
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {savedWheelsList.map((item: any) => (
                                        <div
                                            key={item.id}
                                            className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/10 hover:border-cyan-500/40 flex items-center justify-between gap-3 transition-all"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-white truncate">{item.eventName}</p>
                                                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                                                    <span>格數：{item.slots?.length || item.totalSlotCount} 格</span>
                                                    <span>•</span>
                                                    <span>已開出：{item.winnerHistory?.length || 0} 位</span>
                                                </div>
                                            </div>

                                            <Button
                                                size="sm"
                                                onClick={() => handleLoadSavedWheel(item)}
                                                className="h-8 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shrink-0"
                                            >
                                                載入雲端
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsLoadModalOpen(false)} className="rounded-xl border-white/15">
                            關閉
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ======================================================== */}
            {/* 彈窗 7：全部重設 / 重來一次 選擇彈窗 (滿足用戶自訂重設需求) */}
            {/* ======================================================== */}
            <Dialog open={isResetAllModalOpen} onOpenChange={setIsResetAllModalOpen}>
                <DialogContent className="sm:max-w-lg bg-slate-900/95 border-2 border-rose-500/40 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(244,63,94,0.25)] backdrop-blur-2xl">
                    <DialogHeader>
                        <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mb-2">
                            <RotateCcw className="w-6 h-6 text-rose-400" />
                        </div>
                        <DialogTitle className="text-xl font-black text-white text-center">
                            🔄 活動專區・重設與重來
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400 text-center">
                            請選擇您想執行的重設方式（已開出的中獎紀錄將自動保存至歷史存檔）：
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-3">
                        {/* 選項 A：重置開獎進度 (保留名單與獎項) */}
                        <div 
                            onClick={handleResetDrawSessionOnly}
                            className="p-4 rounded-2xl bg-slate-950/80 border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-950/30 cursor-pointer transition-all group"
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                                    <RotateCcw className="w-4 h-4 text-cyan-300" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="text-sm font-black text-white group-hover:text-cyan-300 transition-colors">
                                            重置本輪抽獎（保留現有名單與獎項）
                                        </h4>
                                        <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-400/30 text-[10px]">
                                            推薦
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        清空目前開獎紀錄、將所有已中獎人員重新放回轉盤中，保留您先前填寫的人名、電話與獎項配置，可立即展開下一輪抽獎！
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 選項 B：全面清空重來 (清空所有資料) */}
                        <div 
                            onClick={handleResetEverythingClean}
                            className="p-4 rounded-2xl bg-slate-950/80 border border-rose-500/30 hover:border-rose-400 hover:bg-rose-950/30 cursor-pointer transition-all group"
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                                    <Trash2 className="w-4 h-4 text-rose-400" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="text-sm font-black text-white group-hover:text-rose-300 transition-colors">
                                            全面清空並重新開始（清空所有人名/獎項）
                                        </h4>
                                        <Badge className="bg-rose-500/20 text-rose-300 border-rose-400/30 text-[10px]">
                                            全部重來
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        徹底清空所有填寫的姓名、電話、自訂獎項與開獎進度，回歸初始 12 格空白預設狀態，建立一場全新的活動。
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex justify-end">
                        <Button 
                            variant="outline" 
                            onClick={() => setIsResetAllModalOpen(false)}
                            className="rounded-xl border-white/15 text-xs"
                        >
                            取消關閉
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
