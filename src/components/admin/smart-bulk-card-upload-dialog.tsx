'use client';

import React, { useState, ChangeEvent, useMemo } from 'react';
import { useFirestore, useStorage } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  UploadCloud,
  Sparkles,
  Layers,
  ArrowRightLeft,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  Calendar,
  DollarSign,
  Tag,
  Loader2,
  Plus,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CardDraft {
  id: string;
  frontFile: File;
  backFile?: File;
  frontPreview: string;
  backPreview?: string;
  name: string;
  category: string;
  sellPrice: number;
  detectedGrade?: string;
  detectedRarity?: string;
  isPairMatched: boolean;
}

const SPORT_CATEGORIES = ["籃球", "棒球", "足球", "女孩卡", "女優", "TCG", "其他"];

// 正反面後綴識別的正則表達式
const FRONT_REGEX = /(?:[_\-\s]?(?:front|f|a|1|正面|正))$/i;
const BACK_REGEX = /(?:[_\-\s]?(?:back|b|2|背面|背))$/i;

// 評級模式：PSA 10, BGS 9.5, CGC 10, SGC 10 等
const GRADE_REGEX = /\b(PSA\s*10|PSA\s*9|BGS\s*9\.5|BGS\s*10|CGC\s*10|SGC\s*10)\b/i;

// 稀有度模式：1/1, SSR, UR, SR, SSP, SP, RC
const RARITY_REGEX = /\b(1\/1|SSR|UR|SSP|SP|RC|AUTO|PATCH)\b/i;

interface SmartBulkCardUploadDialogProps {
  area: string;
  onComplete: (count: number) => void;
}

export function SmartBulkCardUploadDialog({ area, onComplete }: SmartBulkCardUploadDialogProps) {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [drafts, setDrafts] = useState<CardDraft[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(0);

  // 批次統一設定狀態
  const [batchCategory, setBatchCategory] = useState<string>('');
  const [batchPrice, setBatchPrice] = useState<string>('');

  // 檔名智慧解析為卡片 Draft
  const parseFilesToDrafts = (files: File[]): CardDraft[] => {
    // 步驟 1：依據檔名主體（去除正反面後綴）進行分組
    const groups = new Map<string, { front?: File; back?: File; others: File[] }>();

    files.forEach((file) => {
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '').trim();
      let isBack = BACK_REGEX.test(fileNameWithoutExt);
      let isFront = FRONT_REGEX.test(fileNameWithoutExt);

      let cleanBaseKey = fileNameWithoutExt
        .replace(FRONT_REGEX, '')
        .replace(BACK_REGEX, '')
        .trim()
        .toLowerCase();

      // 若兩張檔名完全一樣，第二張自動作為背面
      if (!groups.has(cleanBaseKey)) {
        groups.set(cleanBaseKey, { others: [] });
      }

      const grp = groups.get(cleanBaseKey)!;
      if (isBack) {
        grp.back = file;
      } else if (isFront) {
        grp.front = file;
      } else {
        grp.others.push(file);
      }
    });

    const newDrafts: CardDraft[] = [];

    // 步驟 2：將分組整合成卡片草稿
    groups.forEach((grp, baseKey) => {
      let frontFile = grp.front;
      let backFile = grp.back;

      // 如果沒有明確標注 front/back，但有兩張同組圖，第一張當正面，第二張當背面
      if (!frontFile && grp.others.length > 0) {
        frontFile = grp.others.shift();
      }
      if (!backFile && grp.others.length > 0) {
        backFile = grp.others.shift();
      }

      if (frontFile) {
        const rawName = frontFile.name.replace(/\.[^/.]+$/, '').trim();
        const baseName = rawName.replace(FRONT_REGEX, '').replace(BACK_REGEX, '').trim();

        // 智慧標籤分析
        // 1. 偵測評級
        const gradeMatch = baseName.match(GRADE_REGEX);
        const detectedGrade = gradeMatch ? gradeMatch[1].toUpperCase() : undefined;

        // 2. 偵測稀有度
        const rarityMatch = baseName.match(RARITY_REGEX);
        const detectedRarity = rarityMatch ? rarityMatch[1].toUpperCase() : undefined;

        // 3. 偵測分類
        let detectedCategory = '其他';
        for (const cat of SPORT_CATEGORIES) {
          if (cat === '全部' || cat === '其他') continue;
          if (baseName.includes(cat)) {
            detectedCategory = cat;
            break;
          }
        }
        if (detectedCategory === '其他') {
          if (/basketball|nba|curry|lebron|jordan|kobe|lakers|warriors/i.test(baseName)) {
            detectedCategory = '籃球';
          } else if (/baseball|mlb|ohtani|judge|yankees|dodgers|棒球/i.test(baseName)) {
            detectedCategory = '棒球';
          } else if (/soccer|football|messi|ronaldo|mbappe|haaland|足球/i.test(baseName)) {
            detectedCategory = '足球';
          } else if (/tcg|pokemon|yugioh|onepiece|寶可夢|遊戲王|航海王/i.test(baseName)) {
            detectedCategory = 'TCG';
          }
        }

        // 4. 偵測定價（搜尋結尾純數字或帶P的字樣，如 _1500, _2000P）
        let detectedPrice = 10;
        const priceMatch = baseName.match(/(?:[_\-\s])(\d{2,6})(?:p|元|點)?$/i);
        if (priceMatch) {
          const parsed = parseInt(priceMatch[1], 10);
          if (!isNaN(parsed) && parsed > 0) {
            detectedPrice = parsed;
          }
        }

        // 5. 格式化乾淨名稱（去除尾部價格或標記，用空格隔開底線）
        let cleanName = baseName
          .replace(/(?:[_\-\s])\d{2,6}(?:p|元|點)?$/i, '')
          .replace(/[_-]+/g, ' ')
          .trim();

        if (!cleanName) cleanName = '未命名卡片';

        newDrafts.push({
          id: uuidv4(),
          frontFile,
          backFile,
          frontPreview: URL.createObjectURL(frontFile),
          backPreview: backFile ? URL.createObjectURL(backFile) : undefined,
          name: cleanName,
          category: detectedCategory,
          sellPrice: detectedPrice,
          detectedGrade,
          detectedRarity,
          isPairMatched: Boolean(frontFile && backFile),
        });
      }

      // 如果同組還有剩餘未配對的圖片，單獨各成一張單面卡
      grp.others.forEach((otherFile) => {
        const cleanName = otherFile.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
        newDrafts.push({
          id: uuidv4(),
          frontFile: otherFile,
          frontPreview: URL.createObjectURL(otherFile),
          name: cleanName || '未命名卡片',
          category: '其他',
          sellPrice: 10,
          isPairMatched: false,
        });
      });
    });

    return newDrafts;
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    const parsed = parseFilesToDrafts(files);
    setDrafts((prev) => [...prev, ...parsed]);
    e.target.value = ''; // 清空 input 讓重複上傳同一檔案時能觸發
  };

  // 互換正反面
  const handleSwapFrontBack = (draftId: string) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.id !== draftId) return d;
        if (!d.backFile) return d;
        return {
          ...d,
          frontFile: d.backFile,
          backFile: d.frontFile,
          frontPreview: d.backPreview!,
          backPreview: d.frontPreview,
        };
      })
    );
  };

  // 獨立為某張卡補充背面圖
  const handleAddBackImage = (draftId: string, e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.id !== draftId) return d;
        return {
          ...d,
          backFile: file,
          backPreview: URL.createObjectURL(file),
          isPairMatched: true,
        };
      })
    );
    e.target.value = '';
  };

  // 移除卡片草稿
  const handleRemoveDraft = (draftId: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
  };

  // 更新單張草稿屬性
  const handleUpdateDraft = (draftId: string, updates: Partial<CardDraft>) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === draftId ? { ...d, ...updates } : d))
    );
  };

  // 批次統一設定分類
  const applyBatchCategory = () => {
    if (!batchCategory) return;
    setDrafts((prev) => prev.map((d) => ({ ...d, category: batchCategory })));
    toast({ title: '已批次更新分類', description: `所有草稿卡片已統一設為「${batchCategory}」` });
  };

  // 批次統一設定售價
  const applyBatchPrice = () => {
    const p = parseFloat(batchPrice);
    if (isNaN(p) || p < 0) return;
    setDrafts((prev) => prev.map((d) => ({ ...d, sellPrice: p })));
    toast({ title: '已批次更新售價', description: `所有草稿卡片已統一設定售價為 ${p} 點` });
  };

  // 執行上傳流程
  const startSmartUpload = async () => {
    if (!firestore || !storage || drafts.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    setCurrentProcessingIndex(1);

    let successCount = 0;
    const uploadTimestamp = new Date().toISOString();

    for (let i = 0; i < drafts.length; i++) {
      setCurrentProcessingIndex(i + 1);
      const draft = drafts[i];

      try {
        // 1. 上傳正面圖
        const frontExt = draft.frontFile.name.split('.').pop() || 'png';
        const frontStorageRef = ref(storage, `P-Carder/cards/${uuidv4()}.${frontExt}`);
        const frontUploadTask = uploadBytesResumable(frontStorageRef, draft.frontFile);

        const frontImageUrl = await new Promise<string>((resolve, reject) => {
          frontUploadTask.on('state_changed', null, reject, () => {
            getDownloadURL(frontUploadTask.snapshot.ref).then(resolve);
          });
        });

        // 2. 上傳背面圖 (若有)
        let backImageUrl: string | undefined = undefined;
        if (draft.backFile) {
          const backExt = draft.backFile.name.split('.').pop() || 'png';
          const backStorageRef = ref(storage, `P-Carder/cards/${uuidv4()}-back.${backExt}`);
          const backUploadTask = uploadBytesResumable(backStorageRef, draft.backFile);

          backImageUrl = await new Promise<string>((resolve, reject) => {
            backUploadTask.on('state_changed', null, reject, () => {
              getDownloadURL(backUploadTask.snapshot.ref).then(resolve);
            });
          });
        }

        // 3. 寫入 Firestore 集合 allCards
        const cardDoc: any = {
          name: draft.name.trim() || '未命名卡片',
          imageUrl: frontImageUrl,
          category: draft.category || '其他',
          sellPrice: Number(draft.sellPrice) || 10,
          isSold: area === 'group-break',
          dailyLimit: 0,
          minLevel: '新手收藏家',
          createdAt: uploadTimestamp,
        };

        if (backImageUrl) {
          cardDoc.backImageUrl = backImageUrl;
        }
        if (draft.detectedGrade) {
          cardDoc.grade = draft.detectedGrade;
        }
        if (draft.detectedRarity) {
          cardDoc.rarity = draft.detectedRarity;
        }
        if (area === 'group-break') {
          cardDoc.source = 'group-break';
        }

        await addDoc(collection(firestore, 'allCards'), cardDoc);
        successCount++;
      } catch (err) {
        console.error(`Error uploading card draft: ${draft.name}`, err);
      }

      setUploadProgress(Math.round(((i + 1) / drafts.length) * 100));
    }

    toast({
      title: '智慧批量上傳完成！',
      description: `成功入庫 ${successCount} 張卡片，已自動登記正反面與今日標籤。`,
    });

    setIsUploading(false);
    setDrafts([]);
    setIsOpen(false);
    onComplete(successCount);
  };

  // 統計數據
  const stats = useMemo(() => {
    const total = drafts.length;
    const paired = drafts.filter((d) => d.isPairMatched).length;
    const single = total - paired;
    return { total, paired, single };
  }, [drafts]);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="h-10 rounded-xl font-black bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md transition-all hover:scale-[1.01]"
      >
        <Sparkles className="mr-2 h-4 w-4 text-cyan-200" />
        智慧批量上傳
        <Badge className="ml-2 bg-white/20 text-white text-[10px] h-5 border-none font-bold">雙面配對</Badge>
      </Button>

      <Dialog open={isOpen} onOpenChange={(val) => !isUploading && setIsOpen(val)}>
        <DialogContent className="light sm:max-w-4xl max-h-[92vh] flex flex-col bg-white text-slate-900 border-none shadow-2xl rounded-3xl p-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="p-6 pb-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2.5 font-black text-xl text-slate-900">
                  <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  方案 A：智慧雙面配對與規格批量上傳
                </DialogTitle>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  支援大量圖片拖曳，自動依照「_front / _back」或「_A / _B」配對雙面，並自動解析球員、評級與價格。
                </p>
              </div>
              {drafts.length > 0 && (
                <div className="flex items-center gap-2 text-xs font-bold">
                  <Badge variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-800">
                    共 {stats.total} 張卡片
                  </Badge>
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                    雙面 {stats.paired}
                  </Badge>
                  {stats.single > 0 && (
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                      單面 {stats.single}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-5 custom-scrollbar">
            {!isUploading ? (
              <>
                {/* 拖曳上傳與檔案選擇區 */}
                <div className="border-2 border-dashed border-cyan-200 hover:border-cyan-400 bg-cyan-50/30 hover:bg-cyan-50/70 rounded-2xl p-6 text-center transition-all relative group cursor-pointer">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex items-center justify-center gap-4">
                    <div className="p-3 bg-white rounded-2xl shadow-sm text-cyan-600 group-hover:scale-110 transition-transform">
                      <UploadCloud className="h-8 w-8" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black text-slate-800">
                        點擊或拖曳多張卡片圖片至此（支援同時選取數十張）
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        💡 檔名小技巧：<code className="text-cyan-700 bg-cyan-100/60 px-1 py-0.5 rounded font-mono">Curry_PSA10_1500_front.jpg</code> 與 <code className="text-cyan-700 bg-cyan-100/60 px-1 py-0.5 rounded font-mono">_back.jpg</code> 會自動合成一張雙面卡！
                      </p>
                    </div>
                  </div>
                </div>

                {/* 批次全局設定列 (當有卡片時顯示) */}
                {drafts.length > 0 && (
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-slate-700 font-bold">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <span>快速批量賦值工具：</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* 統一分類 */}
                      <div className="flex items-center gap-1.5">
                        <Select value={batchCategory} onValueChange={setBatchCategory}>
                          <SelectTrigger className="h-8 text-xs w-28 bg-white border-slate-200 font-bold">
                            <SelectValue placeholder="選擇分類" />
                          </SelectTrigger>
                          <SelectContent>
                            {SPORT_CATEGORIES.filter((c) => c !== '全部').map((cat) => (
                              <SelectItem key={cat} value={cat} className="text-xs font-bold">
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={applyBatchCategory}
                          disabled={!batchCategory}
                          className="h-8 px-2.5 text-xs font-bold border-slate-200 bg-white"
                        >
                          套用分類
                        </Button>
                      </div>

                      <div className="h-4 w-px bg-slate-200 mx-1" />

                      {/* 統一售價 */}
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          placeholder="統一價格"
                          value={batchPrice}
                          onChange={(e) => setBatchPrice(e.target.value)}
                          className="h-8 w-24 text-xs bg-white border-slate-200 font-bold"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={applyBatchPrice}
                          disabled={!batchPrice}
                          className="h-8 px-2.5 text-xs font-bold border-slate-200 bg-white"
                        >
                          套用價格
                        </Button>
                      </div>

                      <div className="h-4 w-px bg-slate-200 mx-1" />

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDrafts([])}
                        className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold"
                      >
                        清空全部
                      </Button>
                    </div>
                  </div>
                )}

                {/* 卡片草稿列表 */}
                {drafts.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1">
                      <span>卡片預覽與配對清單（{drafts.length} 項）</span>
                      <span className="text-[11px] text-slate-400">可直接在此修改名稱、價格或互換正反面</span>
                    </div>

                    <div className="space-y-2.5">
                      {drafts.map((draft, idx) => (
                        <div
                          key={draft.id}
                          className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-cyan-300 shadow-sm transition-all flex flex-col md:flex-row items-start md:items-center gap-4"
                        >
                          {/* 序號 */}
                          <div className="text-xs font-black text-slate-400 font-mono w-6 text-center">
                            #{idx + 1}
                          </div>

                          {/* 雙面圖片預覽區 */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* 正面 */}
                            <div className="relative group w-14 h-20 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={draft.frontPreview}
                                alt="Front"
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute bottom-0 inset-x-0 bg-slate-900/80 text-white text-[9px] font-black text-center py-0.5">
                                正面
                              </span>
                            </div>

                            {/* 互換正反面按鈕 (僅在有背面時可點) */}
                            <button
                              type="button"
                              onClick={() => handleSwapFrontBack(draft.id)}
                              disabled={!draft.backFile}
                              title={draft.backFile ? '點擊互換正面與背面' : '尚無背面'}
                              className={cn(
                                'p-1 rounded-lg border transition-colors',
                                draft.backFile
                                  ? 'border-slate-200 hover:border-cyan-400 hover:bg-cyan-50 text-slate-600 hover:text-cyan-700'
                                  : 'border-transparent text-slate-300 cursor-not-allowed'
                              )}
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            </button>

                            {/* 背面 */}
                            {draft.backPreview ? (
                              <div className="relative group w-14 h-20 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={draft.backPreview}
                                  alt="Back"
                                  className="w-full h-full object-cover"
                                />
                                <span className="absolute bottom-0 inset-x-0 bg-slate-900/80 text-white text-[9px] font-black text-center py-0.5">
                                  背面
                                </span>
                              </div>
                            ) : (
                              <label className="w-14 h-20 rounded-xl border border-dashed border-slate-300 hover:border-cyan-400 bg-slate-50 hover:bg-cyan-50/50 flex flex-col items-center justify-center text-[10px] text-slate-400 hover:text-cyan-700 font-bold cursor-pointer transition-colors relative">
                                <Plus className="h-4 w-4 mb-0.5" />
                                <span>補背面</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleAddBackImage(draft.id, e)}
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                              </label>
                            )}
                          </div>

                          {/* 欄位資訊與即時編輯 */}
                          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                            {/* 卡片名稱 */}
                            <div className="sm:col-span-6 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">卡片名稱</span>
                                {draft.detectedGrade && (
                                  <Badge className="bg-amber-100 text-amber-900 border-none text-[9px] px-1.5 py-0 h-4 font-black">
                                    {draft.detectedGrade}
                                  </Badge>
                                )}
                                {draft.detectedRarity && (
                                  <Badge className="bg-purple-100 text-purple-900 border-none text-[9px] px-1.5 py-0 h-4 font-black">
                                    {draft.detectedRarity}
                                  </Badge>
                                )}
                              </div>
                              <Input
                                value={draft.name}
                                onChange={(e) => handleUpdateDraft(draft.id, { name: e.target.value })}
                                className="h-9 text-xs font-bold border-slate-200 bg-slate-50 focus:bg-white"
                                placeholder="輸入卡片名稱..."
                              />
                            </div>

                            {/* 類別 */}
                            <div className="sm:col-span-3 space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">分類</span>
                              <Select
                                value={draft.category}
                                onValueChange={(val) => handleUpdateDraft(draft.id, { category: val })}
                              >
                                <SelectTrigger className="h-9 text-xs font-bold border-slate-200 bg-slate-50 focus:bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {SPORT_CATEGORIES.filter((c) => c !== '全部').map((cat) => (
                                    <SelectItem key={cat} value={cat} className="text-xs font-bold">
                                      {cat}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* 售價 */}
                            <div className="sm:col-span-3 space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">售價點數</span>
                              <div className="relative">
                                <Input
                                  type="number"
                                  value={draft.sellPrice}
                                  onChange={(e) =>
                                    handleUpdateDraft(draft.id, {
                                      sellPrice: Math.max(0, parseInt(e.target.value, 10) || 0),
                                    })
                                  }
                                  className="h-9 text-xs font-bold border-slate-200 bg-slate-50 focus:bg-white pr-7"
                                />
                                <span className="absolute right-2.5 top-2 text-[10px] text-slate-400 font-bold">P</span>
                              </div>
                            </div>
                          </div>

                          {/* 刪除按鈕 */}
                          <button
                            type="button"
                            onClick={() => handleRemoveDraft(draft.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                            title="移除此卡片"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    目前尚未載入任何卡片圖片，請從上方拖曳或選取檔案開始。
                  </div>
                )}
              </>
            ) : (
              /* 上傳進行中狀態 */
              <div className="py-16 text-center space-y-6">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 rounded-full bg-cyan-100 animate-ping opacity-75" />
                  <div className="relative w-20 h-20 rounded-full bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600">
                    <Loader2 className="h-10 w-10 animate-spin" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-black text-lg text-slate-900">
                    正為您智慧上傳與入庫資料庫...
                  </h3>
                  <p className="text-xs text-slate-500 font-bold">
                    處理進度：第 {currentProcessingIndex} 張 / 共 {drafts.length} 張卡片
                  </p>
                </div>

                <div className="max-w-md mx-auto space-y-1.5">
                  <Progress value={uploadProgress} className="h-3 bg-slate-100" />
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono font-bold px-1">
                    <span>雙面資產存儲中</span>
                    <span>{uploadProgress}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="p-4 px-6 bg-slate-50 border-t border-slate-100 shrink-0 flex items-center justify-between sm:justify-between">
            <div className="text-xs text-slate-500 font-medium">
              {!isUploading && drafts.length > 0 && (
                <span>
                  共準備上傳 <strong className="text-slate-900 font-black">{drafts.length}</strong> 張卡片
                  （含 {stats.paired} 張雙面完整卡）
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setIsOpen(false)}
                disabled={isUploading}
                className="font-bold text-slate-600 text-xs h-10 px-4 rounded-xl"
              >
                取消
              </Button>

              <Button
                onClick={startSmartUpload}
                disabled={isUploading || drafts.length === 0}
                className="h-10 px-6 font-black bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg transition-all"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    正在入庫...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" />
                    確認開始智慧上傳 ({drafts.length})
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
