'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Image as ImageIcon, Wallpaper, Trash2, BookOpen, Info, Layers, Sparkles, Clock, ShieldCheck, Sun, Moon, RefreshCw } from 'lucide-react';
import { useFirestore, useDoc, useStorage, useMemoFirebase } from "@/firebase";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { SafeImage } from "@/components/safe-image";
import { ref, uploadBytesResumable, getDownloadURL, listAll, deleteObject } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid';
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import type { SystemConfig } from "@/types/system";
import { getEffectiveParticleEffect, getNextSwitchTime, STYLE_DEFINITIONS } from "@/lib/daily-style";

interface BackgroundImage {
    url: string;
    ref: any;
}

export default function MaterialsAdminPage() {
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();
    
    const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
    const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
    const [logoUploadProgress, setLogoUploadProgress] = useState<number | null>(null);
    const [selectedBgFile, setSelectedBgFile] = useState<File | null>(null);
    const [bgPreviewUrl, setBgPreviewUrl] = useState<string | null>(null);
    const [bgUploadProgress, setBgUploadProgress] = useState<number | null>(null);
    const [selectedOriginFile, setSelectedOriginFile] = useState<File | null>(null);
    const [originPreviewUrl, setOriginPreviewUrl] = useState<string | null>(null);
    const [originUploadProgress, setOriginUploadProgress] = useState<number | null>(null);
    const [backgroundImages, setBackgroundImages] = useState<BackgroundImage[]>([]);
    const [isLoadingBackgrounds, setIsLoadingBackgrounds] = useState(true);
    
    const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
    const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);
    
    const [currentOpacity, setCurrentOpacity] = useState(1);
    const [currentCardOpacity, setCurrentCardOpacity] = useState(0.85);
    const [nextSwitchInfo, setNextSwitchInfo] = useState<string>('');
    const [effectiveStyle, setEffectiveStyle] = useState<string>('gold_dust');

    useEffect(() => {
        if (systemConfig?.backgroundOpacity !== undefined) setCurrentOpacity(systemConfig.backgroundOpacity);
        if (systemConfig?.cardOpacity !== undefined) setCurrentCardOpacity(systemConfig.cardOpacity);
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

    const fetchBackgrounds = useCallback(async () => {
        if (!storage) return;
        setIsLoadingBackgrounds(true);
        try {
            const res = await listAll(ref(storage, 'P-Carder/backgrounds')).catch(() => ({ items: [] }));
            const list = await Promise.all(res.items.map(async (itemRef) => ({ url: await getDownloadURL(itemRef), ref: itemRef })));
            setBackgroundImages(list);
        } catch (e) { setBackgroundImages([]); } finally { setIsLoadingBackgrounds(false); }
    }, [storage]);

    useEffect(() => { if (storage) fetchBackgrounds(); }, [storage, fetchBackgrounds]);

    const handleUpload = async (type: 'logo' | 'bg' | 'origin') => {
        let file = type === 'logo' ? selectedLogoFile : type === 'bg' ? selectedBgFile : selectedOriginFile;
        if (!file || !systemConfigRef || !storage) return;
        const setProgress = type === 'logo' ? setLogoUploadProgress : type === 'bg' ? setBgUploadProgress : setOriginUploadProgress;
        setProgress(0);
        const folder = type === 'bg' ? 'backgrounds' : 'system';
        const fileRef = ref(storage, `P-Carder/${folder}/${type}-${uuidv4()}`);
        try {
            const uploadTask = uploadBytesResumable(fileRef, file);
            uploadTask.on('state_changed', (s) => setProgress((s.bytesTransferred / s.totalBytes) * 100), (e) => setProgress(null), async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                if (type === 'logo') await setDoc(systemConfigRef, { logoUrl: url }, { merge: true });
                else if (type === 'origin') await setDoc(systemConfigRef, { aboutOriginImageUrl: url }, { merge: true });
                else fetchBackgrounds();
                toast({ title: "成功" }); setProgress(null);
            });
        } catch(e) { setProgress(null); }
    }

    return (
        <div className="space-y-8 text-slate-900">
            <h1 className="text-3xl font-black tracking-tight">素材與視覺管理</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border-slate-200 bg-white shadow-sm rounded-2xl">
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="h-5 w-5 text-slate-400"/> 品牌標誌 (Logo)</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div className="h-24 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center p-4 relative overflow-hidden">
                            {systemConfig?.logoUrl ? <SafeImage src={systemConfig.logoUrl} alt="l" className="h-10 object-contain" width={100} height={40} /> : <span className="text-xs text-slate-300">目前無標誌</span>}
                        </div>
                        <Input type="file" accept="image/*" onChange={e => { if(e.target.files?.[0]) { setSelectedLogoFile(e.target.files[0]); setLogoPreviewUrl(URL.createObjectURL(e.target.files[0])); }}} className="text-xs h-12 border-slate-200" />
                        {logoPreviewUrl && <Button onClick={() => handleUpload('logo')} className="w-full h-12 bg-slate-900 text-white font-bold rounded-xl" disabled={logoUploadProgress !== null}>{logoUploadProgress !== null ? `上傳中 ${Math.round(logoUploadProgress)}%` : '確認更換標誌'}</Button>}
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm rounded-2xl">
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><BookOpen className="h-5 w-5 text-slate-400"/> 品牌故事圖片</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div className="aspect-video bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center relative overflow-hidden">
                            {systemConfig?.aboutOriginImageUrl ? <SafeImage src={systemConfig.aboutOriginImageUrl} alt="o" fill className="object-contain p-4" /> : <ImageIcon className="text-slate-200" />}
                        </div>
                        <Input type="file" onChange={e => { if(e.target.files?.[0]) { setSelectedOriginFile(e.target.files[0]); setOriginPreviewUrl(URL.createObjectURL(e.target.files[0])); }}} className="text-xs h-12 border-slate-200" />
                        {originPreviewUrl && <Button onClick={() => handleUpload('origin')} className="w-full h-12 bg-slate-900 text-white font-bold rounded-xl" disabled={originUploadProgress !== null}>上傳起源圖</Button>}
                    </CardContent>
                </Card>
            </div>

            <Card className="border-slate-200 bg-white shadow-sm rounded-2xl">
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Wallpaper className="h-5 w-5 text-slate-400"/> 全站沉浸式背景庫</CardTitle></CardHeader>
                <CardContent className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <Label className="text-xs font-bold text-slate-500">上傳新背景</Label>
                            <Input type="file" onChange={e => { if(e.target.files?.[0]) { setSelectedBgFile(e.target.files[0]); setBgPreviewUrl(URL.createObjectURL(e.target.files[0])); }}} className="h-12 border-slate-200" />
                            {bgPreviewUrl && <Button onClick={() => handleUpload('bg')} className="w-full h-12 bg-slate-900 text-white font-bold rounded-xl">加入背景庫</Button>}
                            <Button 
                                variant="outline" 
                                className="w-full h-12 border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-200"
                                onClick={() => setDoc(systemConfigRef!, { backgroundUrl: null }, { merge: true })}
                            >
                                清除當前背景圖片 (點回無背景)
                            </Button>
                        </div>
                        <div className="space-y-6">
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
                                    <div className="flex items-center justify-between">
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
                                                dailyStyleRotation: false, // 關鍵：直接套用，無視 12 點更換
                                            }, { merge: true });
                                            try {
                                                localStorage.setItem('p_carder_wallpaper_particle', 'gold_dust');
                                                window.dispatchEvent(new CustomEvent('wallpaper-particle-changed', { detail: { mode: 'gold_dust' } }));
                                            } catch (e) {}
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
                                                dailyStyleRotation: false, // 關鍵：直接套用，無視 12 點更換
                                            }, { merge: true });
                                            try {
                                                localStorage.setItem('p_carder_wallpaper_particle', 'stars');
                                                window.dispatchEvent(new CustomEvent('wallpaper-particle-changed', { detail: { mode: 'stars' } }));
                                            } catch (e) {}
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
                                                dailyStyleRotation: false, // 關鍵：直接套用，無視 12 點更換
                                            }, { merge: true });
                                            try {
                                                localStorage.setItem('p_carder_wallpaper_particle', 'none');
                                                window.dispatchEvent(new CustomEvent('wallpaper-particle-changed', { detail: { mode: 'none' } }));
                                            } catch (e) {}
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

                            {/* 2. 每日 12:00 自動輪播風格控制 */}
                            <div className="p-6 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl space-y-5 shadow-sm border border-indigo-900/50">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                                                <Clock className="w-4 h-4" />
                                            </span>
                                            <Label className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
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
                                            開啟後系統將交由定時排程於每天 12 點自動換風格。若上方手動切換效果，將會優先套用手動設定。
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
                                                    description: "目前由上方管理員手動指定的桌面效果固定生效",
                                                });
                                            }
                                        }} 
                                    />
                                </div>

                                {systemConfig?.dailyStyleRotation === true && (
                                    <div className="space-y-3 pt-2 border-t border-white/10">
                                        <div className="flex items-center justify-between text-xs">
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

                            <div className="space-y-4">
                                <Label className="text-xs font-bold text-slate-500 flex justify-between">背景不透明度 <span>{Math.round(currentOpacity * 100)}%</span></Label>
                                <div className="p-6 bg-slate-50 border rounded-xl">
                                    <Slider value={[currentOpacity]} max={1} step={0.1} onValueChange={v => setCurrentOpacity(v[0])} onValueCommit={v => setDoc(systemConfigRef!, { backgroundOpacity: v[0] }, { merge: true })} />
                                </div>
                                <div className="p-6 rounded-2xl bg-accent/5 border border-accent/20 space-y-3">
                                    <p className="text-[10px] text-accent font-black uppercase tracking-[0.2em] flex items-center gap-2"><Info className="w-3 h-3"/> 專業建議提示</p>
                                    <p className="text-xs text-muted-foreground leading-relaxed italic font-medium">
                                        若您使用的背景圖片較為明亮或視覺雜亂，建議將不透明度調高至 <span className="text-white font-bold">85% 以上</span>，這能有效建立介面與背景的深度層次，確保玩家能輕鬆閱讀點數與獎項資訊。
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {backgroundImages.map(img => (
                            <div key={img.url} className={cn("relative aspect-video rounded-xl border-2 transition-all cursor-pointer group", systemConfig?.backgroundUrl === img.url ? "border-slate-900 ring-2 ring-slate-100" : "border-slate-100")}>
                                <SafeImage src={img.url} alt="bg" fill className="object-cover rounded-lg" />
                                <div className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <Button size="sm" onClick={() => setDoc(systemConfigRef!, { backgroundUrl: img.url }, { merge: true })}>套用</Button>
                                    <Button size="sm" variant="destructive" onClick={async () => { await deleteObject(img.ref); fetchBackgrounds(); }}><Trash2 size={14}/></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
