'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Sparkles, 
  Loader2, 
  Wand2, 
  RefreshCw, 
  Check, 
  Image as ImageIcon, 
  Trophy, 
  Layers, 
  Flame, 
  Tv, 
  Gift
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SafeImage } from '@/components/safe-image';

interface AIImageGeneratorDialogProps {
  initialTitle?: string;
  initialCategory?: string;
  defaultType?: 'card-pool' | 'news-banner' | 'category' | 'general';
  defaultAspectRatio?: '16:9' | '4:3' | '3:4' | '1:1' | '9:16';
  onImageGenerated: (imageUrl: string) => void;
  triggerButton?: React.ReactNode;
}

const PRESET_TEMPLATES = [
  {
    id: 'sports-card',
    name: '🏆 體育球員卡 (金光奢華)',
    icon: Trophy,
    prompt: 'Top tier ultra-rare sports trading card box, glistening metallic gold foil textures, holographic rainbow reflections, stadium floodlights atmosphere, dynamic energy sparks',
    style: 'cinematic',
  },
  {
    id: 'news-banner',
    name: '📢 官方活動橫幅 (大氣質感)',
    icon: Tv,
    prompt: 'Epic esports tournament celebration stage, luxury grand championship banner, golden confetti in the air, sleek modern dark cyber neon lighting',
    style: 'cinematic',
  },
  {
    id: 'card-pack',
    name: '📦 限量卡包展示 (金屬雷射)',
    icon: Layers,
    prompt: 'Mysterious sealed luxury card pack booster box, premium metallic foil wrapping, glowing magical runes, dark sleek pedestal studio lighting',
    style: '3d-render',
  },
  {
    id: 'lucky-bag',
    name: '🎁 幸運福袋 / 寶箱 (金色祥雲)',
    icon: Gift,
    prompt: 'Extravagant glowing lucky treasure chest bursting with golden light and rare collectible sports cards, premium Asian luxury aesthetic with golden clouds and sparkles',
    style: 'cinematic',
  },
  {
    id: 'anime-card',
    name: '🎴 二次元/女孩卡 (日系夢幻)',
    icon: Flame,
    prompt: 'Ethereal Japanese anime collectible trading card illustration, sparkling cherry blossom petals, vibrant celestial light beams, hyper detailed character art',
    style: 'anime',
  },
];

const STYLES = [
  { value: 'cinematic', label: '🎬 奢華寫實 (Cinematic Luxury)' },
  { value: 'holographic', label: '✨ 雷射金屬全息 (Holographic Laser)' },
  { value: '3d-render', label: '💎 3D 精緻渲染 (3D Studio Render)' },
  { value: 'cyberpunk', label: '⚡ 賽博霓虹 (Cyberpunk Neon)' },
  { value: 'anime', label: '🌸 日系夢幻二次元 (Anime Art)' },
];

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9 (最新消息橫幅 / 首頁輪播)' },
  { value: '4:3', label: '4:3 (卡池分類 / 精選封面)' },
  { value: '3:4', label: '3:4 (直式球員卡 / 海報)' },
  { value: '1:1', label: '1:1 (正方形圖示 / 商品照)' },
  { value: '9:16', label: '9:16 (手機全螢幕滿版)' },
];

export function AIImageGeneratorDialog({
  initialTitle = '',
  initialCategory = '',
  defaultType = 'card-pool',
  defaultAspectRatio = '16:9',
  onImageGenerated,
  triggerButton,
}: AIImageGeneratorDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('cinematic');
  const [aspectRatio, setAspectRatio] = useState<string>(defaultAspectRatio);
  const [enhancePrompt, setEnhancePrompt] = useState(true);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [usedPrompt, setUsedPrompt] = useState<string | null>(null);

  const { toast } = useToast();

  // 當使用者開啟彈窗時同步外部標題
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      if (!title && initialTitle) setTitle(initialTitle);
      if (defaultAspectRatio) setAspectRatio(defaultAspectRatio);
    }
    setOpen(isOpen);
  };

  const handleApplyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setPrompt(preset.prompt);
    setStyle(preset.style);
    toast({
      title: '已套用預設風格範本',
      description: preset.name,
    });
  };

  const handleGenerate = async () => {
    const queryTopic = title.trim() || prompt.trim();
    if (!queryTopic) {
      toast({
        variant: 'destructive',
        title: '請輸入標題或描述',
        description: '請輸入想要呈現的卡池名稱、公告主題或畫面特徵。',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/admin/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          prompt: prompt.trim(),
          category: initialCategory,
          type: defaultType,
          style,
          aspectRatio,
          enhancePrompt,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '生成失敗');
      }

      setGeneratedImageUrl(data.imageUrl);
      setUsedPrompt(data.usedPrompt || null);
      toast({
        title: '✨ 圖片生成成功！',
        description: '可直接點選「套用此圖片」更新封面。',
      });
    } catch (error: any) {
      console.error('AI Image Generation Failed:', error);
      toast({
        variant: 'destructive',
        title: '生圖失敗',
        description: error.message || '無法連線至 AI 生成服務，請稍後再試。',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmApply = () => {
    if (!generatedImageUrl) return;
    onImageGenerated(generatedImageUrl);
    setOpen(false);
    toast({
      title: '✅ 圖片已成功套用',
      description: '封面圖片已更新至編輯表單中。',
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-amber-400/60 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/20 hover:from-amber-500/20 hover:to-orange-500/30 text-amber-900 font-black shadow-sm rounded-xl h-9 px-3 gap-1.5 transition-all"
          >
            <Sparkles className="w-4 h-4 text-amber-600 animate-pulse" />
            <span>✨ AI 一鍵智慧生圖</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-3xl bg-white border-none shadow-2xl rounded-3xl p-6 sm:p-8 text-slate-900 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <Wand2 className="w-5 h-5" />
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight text-slate-900">
              ✨ AI 一鍵智慧生圖小幫手
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm font-medium text-slate-500">
            輸入卡池或消息主題，AI 自動運用頂級光影與高解析渲染技術，為您即時生成奢華卡牌與 Banner 視覺圖。
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4">
          {/* 左欄：設定與 Prompt */}
          <div className="space-y-4">
            {/* 快速風格範本 */}
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                ⚡ 快速風格範本 (點擊立即套用)
              </Label>
              <div className="grid grid-cols-1 gap-1.5">
                {PRESET_TEMPLATES.map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="text-left px-3 py-2 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/60 transition-all flex items-center justify-between text-xs font-bold text-slate-800 group"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
                        {preset.name}
                      </span>
                      <Badge variant="outline" className="text-[10px] py-0 border-slate-200 group-hover:border-amber-300">
                        套用
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 主題/卡池標題 */}
            <div className="space-y-1.5">
              <Label htmlFor="ai-title" className="text-xs font-bold text-slate-700">
                卡池名稱 / 消息主題
              </Label>
              <Input
                id="ai-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：大谷翔平 50/50 紀念卡池、2026 卡牌博覽會"
                className="h-11 border-slate-200 rounded-xl font-bold bg-white text-slate-900"
              />
            </div>

            {/* 自訂描述 / 畫面特徵 */}
            <div className="space-y-1.5">
              <Label htmlFor="ai-prompt" className="text-xs font-bold text-slate-700">
                自訂畫面細節 (可選，中文亦可)
              </Label>
              <Textarea
                id="ai-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="例如：金光璀璨的球員卡盒、背後有球場燈光、金屬閃電粒子飄落..."
                className="min-h-[80px] border-slate-200 rounded-xl font-medium text-xs bg-white text-slate-900"
              />
            </div>

            {/* 風格與比例 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-slate-600">視覺風格</Label>
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger className="h-10 border-slate-200 rounded-xl font-bold text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {STYLES.map((s) => (
                      <SelectItem key={s.value} value={s.value} className="text-xs font-bold">
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-slate-600">圖片比例</Label>
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger className="h-10 border-slate-200 rounded-xl font-bold text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {ASPECT_RATIOS.map((r) => (
                      <SelectItem key={r.value} value={r.value} className="text-xs font-bold">
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* AI 擴寫潤飾開關 */}
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="space-y-0.5">
                <Label htmlFor="enhance-toggle" className="text-xs font-black cursor-pointer flex items-center gap-1.5 text-slate-800">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  啟用 Gemini 提示詞極致擴寫
                </Label>
                <p className="text-[10px] text-slate-400 font-medium">
                  將簡單關鍵字自動升級為大師級光影與高解析渲染指令
                </p>
              </div>
              <Switch
                id="enhance-toggle"
                checked={enhancePrompt}
                onCheckedChange={setEnhancePrompt}
              />
            </div>
          </div>

          {/* 右欄：即時預覽與生成結果 */}
          <div className="flex flex-col justify-between space-y-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-100">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-slate-400" />
                  生成畫面預覽
                </Label>
                {generatedImageUrl && (
                  <Badge variant="outline" className="text-[10px] border-emerald-300 bg-emerald-50 text-emerald-700 font-bold">
                    ✓ 已生成完成
                  </Badge>
                )}
              </div>

              {/* 預覽視窗 */}
              <div
                className={`relative w-full rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 bg-slate-950/5 flex items-center justify-center shadow-inner ${
                  aspectRatio === '16:9' ? 'aspect-video' :
                  aspectRatio === '4:3' ? 'aspect-[4/3]' :
                  aspectRatio === '3:4' ? 'aspect-[3/4] max-h-[320px]' :
                  aspectRatio === '1:1' ? 'aspect-square max-h-[280px]' : 'aspect-[9/16] max-h-[320px]'
                }`}
              >
                {isGenerating ? (
                  <div className="text-center p-6 space-y-3">
                    <div className="relative w-12 h-12 mx-auto">
                      <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
                      <Sparkles className="w-5 h-5 text-amber-400 absolute inset-0 m-auto animate-pulse" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800">✨ AI 正在繪製高畫質圖片...</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                        正在渲染光影、金屬反射與粒子特效 (約 3~6 秒)
                      </p>
                    </div>
                  </div>
                ) : generatedImageUrl ? (
                  <div className="relative w-full h-full group">
                    <SafeImage
                      src={generatedImageUrl}
                      alt="AI Generated Artwork"
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3 pointer-events-none">
                      <p className="text-[11px] text-white/90 font-medium line-clamp-2">
                        {usedPrompt || title}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8 space-y-2 text-slate-400">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-300 shadow-sm">
                      <Wand2 className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-500">尚未生成任何圖片</p>
                    <p className="text-[10px] text-slate-400 max-w-[200px] mx-auto">
                      點擊下方按鈕，AI 將為您即時打造專屬視覺圖片！
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 操作按鈕組 */}
            <div className="space-y-2 pt-2">
              <Button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || (!title && !prompt)}
                className="w-full h-12 rounded-xl font-black bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-orange-500/25 transition-all text-sm gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    生成中，請稍候...
                  </>
                ) : generatedImageUrl ? (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    重新生成另一張
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    開始 AI 智慧生圖
                  </>
                )}
              </Button>

              {generatedImageUrl && (
                <Button
                  type="button"
                  onClick={handleConfirmApply}
                  className="w-full h-11 rounded-xl font-black bg-slate-900 hover:bg-slate-800 text-white shadow-md transition-all text-sm gap-2"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  確認套用此圖片
                </Button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-100 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            className="font-bold text-slate-500 rounded-xl"
          >
            關閉
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
