'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Wallpaper, Info, Layers, Sparkles, Clock, RefreshCw } from 'lucide-react';
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, setDoc } from "@/lib/audited-firestore";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import type { SystemConfig } from "@/types/system";
import { getEffectiveParticleEffect, getNextSwitchTime, STYLE_DEFINITIONS } from "@/lib/daily-style";

export default function MaterialsAdminPage() {
    const firestore = useFirestore();
    const { toast } = useToast();

    const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
    const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);

    const [currentOpacity, setCurrentOpacity] = useState(1);
    const [nextSwitchInfo, setNextSwitchInfo] = useState<string>('');
    const [effectiveStyle, setEffectiveStyle] = useState<string>('gold_dust');

    useEffect(() => {
        if (systemConfig?.backgroundOpacity !== undefined) setCurrentOpacity(systemConfig.backgroundOpacity);
    }, [systemConfig]);

    useEffect(() => {
        const updateStyleInfo = () => {
            const effective = getEffectiveParticleEffect(systemConfig);
            setEffectiveStyle(effective);
            const next = getNextSwitchTime(systemConfig?.dailyRotationType || 'every_12_hours');
            setNextSwitchInfo(next.displayText);
        };
        updateStyleInfo();
        const interval = setInterval(updateStyleInfo, 30000);
        return () => clearInterval(interval);
    }, [systemConfig]);

    return (
        <div className="space-y-8 text-slate-900">
            <div className="space-y-1">
                <h1 className="text-3xl font-black tracking-tight">素材與視覺管理</h1>
                <p className="text-xs font-medium text-slate-500">管理全站動態桌面特效、每日風格自動輪替排程與視覺透明度（品牌 Logo 與品牌故事圖已內嵌於程式中）</p>
            </div>

            <Card className="border-slate-200 bg-white shadow-sm rounded-2xl">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Wallpaper className="h-5 w-5 text-slate-400" /> 全站沉浸式視覺效果
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-6">
                            {/* 首頁 3D 浮動卡片背景 */}
                            <div className="p-6 bg-slate-50 border rounded-2xl space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-bold flex items-center gap-2 tracking-tight">
                                            <Layers className="w-4 h-4 text-primary" />
                                            首頁 3D 浮動卡片背景
                                        </Label>
                                        <p className="text-[10px] text-muted-foreground">開啟後首頁將出現動態浮動卡片特效</p>
                                    </div>
                                    <Switch
                                        checked={systemConfig?.showFloatingBackground !== false}
                                        onCheckedChange={(v) => setDoc(systemConfigRef!, { showFloatingBackground: v }, { merge: true })}
                                    />
                                </div>
                            </div>

                            {/* 1. 桌面效果控制區 (管理員手動直接指定・無視12點更換) */}
                            <div className="p-6 bg-slate-50 border rounded-2xl space-y-4 shadow-sm">
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <Label className="text-sm font-bold flex items-center gap-2 tracking-tight text-slate-800">
                                            <Sparkles className="w-4 h-4 text-amber-500" />
                                            直接更換全站桌面效果
                                        </Label>
                                        {systemConfig?.dailyStyleRotation === true ? (
                                            <span className="text-[10px] text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full font-bold border border-indigo-200">
                                                自動輪替運作中（點擊下方按鈕可直接切換手動）
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full font-bold border border-amber-300">
                                                ⚡ 管理員手動生效中（無視 12 點更換）
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        管理員可在此<strong>直接點選更換桌面效果</strong>，全站將立即更換套用，<strong>無視 12 點定時更換規則</strong>。
                                    </p>
                                </div>
                                <div className="grid grid-cols-3 gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!systemConfigRef) return;
                                            await setDoc(systemConfigRef, {
                                                wallpaperParticleEffect: 'gold_dust',
                                                dailyStyleRotation: false,
                                            }, { merge: true });
                                            try {
                                                localStorage.setItem('p_carder_wallpaper_particle', 'gold_dust');
                                                window.dispatchEvent(new CustomEvent('wallpaper-particle-changed', { detail: { mode: 'gold_dust' } }));
                                            } catch {}
                                            toast({
                                                title: "已直接更換桌面效果",
                                                description: "已切換為「✨ 璀璨金粒」（無視 12 點更換，管理員設定優先）",
                                            });
                                        }}
                                        className={cn(
                                            "p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition text-center relative overflow-hidden",
                                            systemConfig?.dailyStyleRotation !== true && (systemConfig?.wallpaperParticleEffect || 'gold_dust') === 'gold_dust'
                                                ? "bg-amber-500/15 border-amber-500 text-amber-800 shadow-sm ring-2 ring-amber-400 font-black"
                                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                        )}
                                    >
                                        <Sparkles className="w-4 h-4 text-amber-500" />
                                        <span>✨ 璀璨金粒</span>
                                        <span className="text-[9px] font-normal text-slate-400">微米細金・溫潤雅緻</span>
                                        {systemConfig?.dailyStyleRotation !== true && (systemConfig?.wallpaperParticleEffect || 'gold_dust') === 'gold_dust' && (
                                            <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.2 rounded-full mt-0.5">生效中</span>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!systemConfigRef) return;
                                            await setDoc(systemConfigRef, {
                                                wallpaperParticleEffect: 'stars',
                                                dailyStyleRotation: false,
                                            }, { merge: true });
                                            try {
                                                localStorage.setItem('p_carder_wallpaper_particle', 'stars');
                                                window.dispatchEvent(new CustomEvent('wallpaper-particle-changed', { detail: { mode: 'stars' } }));
                                            } catch {}
                                            toast({
                                                title: "已直接更換桌面效果",
                                                description: "已切換為「🌌 夢幻星空」（無視 12 點更換，管理員設定優先）",
                                            });
                                        }}
                                        className={cn(
                                            "p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition text-center relative overflow-hidden",
                                            systemConfig?.dailyStyleRotation !== true && systemConfig?.wallpaperParticleEffect === 'stars'
                                                ? "bg-indigo-500/15 border-indigo-500 text-indigo-800 shadow-sm ring-2 ring-indigo-400 font-black"
                                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                        )}
                                    >
                                        <span className="text-base">🌌</span>
                                        <span>夢幻星空</span>
                                        <span className="text-[9px] font-normal text-slate-400">深空星芒與流星</span>
                                        {systemConfig?.dailyStyleRotation !== true && systemConfig?.wallpaperParticleEffect === 'stars' && (
                                            <span className="text-[8px] bg-indigo-600 text-white px-1.5 py-0.2 rounded-full mt-0.5">生效中</span>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!systemConfigRef) return;
                                            await setDoc(systemConfigRef, {
                                                wallpaperParticleEffect: 'none',
                                                dailyStyleRotation: false,
                                            }, { merge: true });
                                            try {
                                                localStorage.setItem('p_carder_wallpaper_particle', 'none');
                                                window.dispatchEvent(new CustomEvent('wallpaper-particle-changed', { detail: { mode: 'none' } }));
                                            } catch {}
                                            toast({
                                                title: "已直接更換桌面效果",
                                                description: "已完全關閉全站粒子特效（無視 12 點更換，純淨原圖桌面）",
                                            });
                                        }}
                                        className={cn(
                                            "p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition text-center relative overflow-hidden",
                                            systemConfig?.dailyStyleRotation !== true && systemConfig?.wallpaperParticleEffect === 'none'
                                                ? "bg-slate-300 border-slate-600 text-slate-900 shadow-sm ring-2 ring-slate-400 font-black"
                                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                        )}
                                    >
                                        <span className="text-base">🚫</span>
                                        <span>完全關閉</span>
                                        <span className="text-[9px] font-normal text-slate-400">無粒子特效</span>
                                        {systemConfig?.dailyStyleRotation !== true && systemConfig?.wallpaperParticleEffect === 'none' && (
                                            <span className="text-[8px] bg-slate-700 text-white px-1.5 py-0.2 rounded-full mt-0.5">生效中</span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* 2. 每日 12:00 自動輪播風格控制 */}
                            <div className="p-6 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl space-y-5 shadow-sm border border-indigo-900/50">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                                                <Clock className="w-4 h-4" />
                                            </span>
                                            <Label className="text-sm font-bold tracking-tight text-white flex items-center gap-2 flex-wrap">
                                                每日 12 點自動換風格排程
                                                {systemConfig?.dailyStyleRotation === true ? (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                                                        執行中
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/30 text-slate-300 font-bold border border-slate-500/30">
                                                        未啟用（目前手動優先）
                                                    </span>
                                                )}
                                            </Label>
                                        </div>
                                        <p className="text-xs text-slate-300 leading-relaxed">
                                            開啟後系統將交由定時排程於每天 12 點自動換風格。若左側手動切換效果，將會優先套用手動設定。
                                        </p>
                                    </div>
                                    <Switch
                                        checked={systemConfig?.dailyStyleRotation === true}
                                        onCheckedChange={async (v) => {
                                            if (!systemConfigRef) return;
                                            await setDoc(systemConfigRef, { dailyStyleRotation: v }, { merge: true });
                                            if (v) {
                                                const autoMode = getEffectiveParticleEffect({ ...systemConfig, dailyStyleRotation: true });
                                                window.dispatchEvent(new CustomEvent('wallpaper-particle-changed', { detail: { mode: autoMode } }));
                                                toast({
                                                    title: "已啟動每日 12 點自動換風格",
                                                    description: "全站將依時間自動輪替風格（金粒 ⇄ 星空）",
                                                });
                                            } else {
                                                toast({
                                                    title: "已切換為管理員手動指定",
                                                    description: "目前由管理員手動指定的桌面效果固定生效",
                                                });
                                            }
                                        }}
                                    />
                                </div>

                                {systemConfig?.dailyStyleRotation === true && (
                                    <div className="space-y-3 pt-2 border-t border-white/10">
                                        <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
                                            <span className="text-slate-400 font-medium">當前輪替排程模式</span>
                                            <div className="inline-flex rounded-lg bg-black/40 p-1 border border-white/10">
                                                <button
                                                    type="button"
                                                    onClick={() => setDoc(systemConfigRef!, { dailyRotationType: 'every_12_hours' }, { merge: true })}
                                                    className={cn(
                                                        "px-2.5 py-1 rounded-md text-[11px] font-bold transition",
                                                        (systemConfig?.dailyRotationType || 'every_12_hours') === 'every_12_hours'
                                                            ? "bg-indigo-600 text-white shadow-sm"
                                                            : "text-slate-400 hover:text-white"
                                                    )}
                                                >
                                                    每 12 小時 (日/夜輪替)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDoc(systemConfigRef!, { dailyRotationType: 'daily_at_noon' }, { merge: true })}
                                                    className={cn(
                                                        "px-2.5 py-1 rounded-md text-[11px] font-bold transition",
                                                        systemConfig?.dailyRotationType === 'daily_at_noon'
                                                            ? "bg-indigo-600 text-white shadow-sm"
                                                            : "text-slate-400 hover:text-white"
                                                    )}
                                                >
                                                    每日中午 12:00 交替
                                                </button>
                                            </div>
                                        </div>

                                        {/* 即時排程狀態回報卡片 */}
                                        <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-base">
                                                        {effectiveStyle === 'gold_dust' ? '✨' : '🌌'}
                                                    </span>
                                                    <div>
                                                        <p className="text-xs font-bold text-amber-300">
                                                            目前排程生效風格：{STYLE_DEFINITIONS[effectiveStyle as 'gold_dust' | 'stars' | 'none']?.name || '璀璨金粒'}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400">
                                                            {STYLE_DEFINITIONS[effectiveStyle as 'gold_dust' | 'stars' | 'none']?.description}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
                                                    排程執行中
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-indigo-200/90 font-medium flex items-center gap-1.5 pt-1 border-t border-white/5">
                                                <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin-slow" />
                                                <span>下次更換時間：{nextSwitchInfo}</span>
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 背景不透明度 */}
                            <div className="space-y-4">
                                <Label className="text-xs font-bold text-slate-500 flex justify-between">
                                    <span>背景不透明度</span>
                                    <span className="tabular-nums">{Math.round(currentOpacity * 100)}%</span>
                                </Label>
                                <div className="p-6 bg-slate-50 border rounded-xl">
                                    <Slider
                                        value={[currentOpacity]}
                                        max={1}
                                        step={0.1}
                                        onValueChange={v => setCurrentOpacity(v[0])}
                                        onValueCommit={v => setDoc(systemConfigRef!, { backgroundOpacity: v[0] }, { merge: true })}
                                    />
                                </div>
                                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                                    <p className="text-[10px] text-amber-700 font-black uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Info className="w-3 h-3" /> 專業建議提示
                                    </p>
                                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                        建議將不透明度維持在 <span className="text-slate-900 font-bold">85% 以上</span>，能有效建立介面與背景的深度層次，確保玩家輕鬆閱讀點數與獎項資訊。
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
