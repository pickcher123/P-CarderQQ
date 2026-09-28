'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  HelpCircle,
  Sparkles,
  ArrowRightLeft,
  Tag,
  DollarSign,
  Copy,
  Check,
  FileText,
  Lightbulb,
  Layers,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function CardUploadGuideDialog() {
  const [open, setOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const { toast } = useToast();

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast({
      title: '已複製範例檔名',
      description: text,
    });
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  };

  const EXAMPLES = [
    {
      title: '雙面球員卡（評級 + 價格）',
      front: 'StephenCurry_2023Prizm_PSA10_1500_front.jpg',
      back: 'StephenCurry_2023Prizm_PSA10_1500_back.jpg',
      result: {
        name: 'StephenCurry 2023Prizm PSA10',
        grade: 'PSA 10',
        price: '1,500 P',
        category: '籃球',
        isDouble: '雙面合一',
      },
    },
    {
      title: '棒球特卡（代號配對 + 售價）',
      front: '大谷翔平_Dodgers_BGS9.5_800_A.png',
      back: '大谷翔平_Dodgers_BGS9.5_800_B.png',
      result: {
        name: '大谷翔平 Dodgers BGS9.5',
        grade: 'BGS 9.5',
        price: '800 P',
        category: '棒球',
        isDouble: '雙面合一',
      },
    },
    {
      title: '限量/特卡（稀有度標籤）',
      front: 'LukaDoncic_NationalTreasures_1of1_3000_1.jpg',
      back: 'LukaDoncic_NationalTreasures_1of1_3000_2.jpg',
      result: {
        name: 'LukaDoncic NationalTreasures 1of1',
        grade: '1/1 限定',
        price: '3,000 P',
        category: '籃球',
        isDouble: '雙面合一',
      },
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="h-10 px-3.5 rounded-xl font-bold border-amber-200/90 bg-amber-50/70 hover:bg-amber-100/80 text-amber-900 transition-all shadow-xs group flex items-center gap-2"
        >
          <div className="p-1 rounded-lg bg-amber-200/60 text-amber-800 group-hover:scale-110 transition-transform">
            <Lightbulb className="h-4 w-4" />
          </div>
          <span className="text-xs">運作機制說明</span>
          <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px] h-4.5 px-1.5 border-none font-bold">
            必讀指南
          </Badge>
        </Button>
      </DialogTrigger>

      <DialogContent className="light sm:max-w-3xl max-h-[90vh] flex flex-col bg-white text-slate-900 border-none shadow-2xl rounded-3xl p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 shrink-0 bg-gradient-to-r from-amber-50/50 via-white to-cyan-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-800 shadow-xs">
              <Sparkles className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                智慧批量上傳・運作機制與命名規則
              </DialogTitle>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                透過自訂檔名規範，拖曳數十張圖片即可全自動配對雙面、提取評級與設定點數。
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* 四大運作機制介紹卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* 1. 雙面自動配對 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                <div className="p-1.5 rounded-lg bg-cyan-100 text-cyan-700">
                  <ArrowRightLeft className="h-4 w-4" />
                </div>
                <span>1. 正反雙面自動合成</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                只要檔名主體相同，結尾標註正面或背面代碼，系統自動合成為<strong>單一張完整雙面卡</strong>：
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] font-mono bg-cyan-50 border border-cyan-200 text-cyan-800 px-2 py-0.5 rounded-md font-bold">
                  正面：_front / _f / _a / _1 / _正面
                </span>
                <span className="text-[11px] font-mono bg-blue-50 border border-blue-200 text-blue-800 px-2 py-0.5 rounded-md font-bold">
                  背面：_back / _b / _2 / _背面
                </span>
              </div>
            </div>

            {/* 2. 評級與稀有度萃取 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <span>2. 評級與稀有度自動識別</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                檔名含有常見評級或限量詞彙時，自動辨識並打上對應色彩徽章：
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] font-mono bg-amber-50 border border-amber-200 text-amber-900 px-2 py-0.5 rounded-md font-bold">
                  評級：PSA 10 / PSA 9 / BGS 9.5 / CGC 10
                </span>
                <span className="text-[11px] font-mono bg-purple-50 border border-purple-200 text-purple-900 px-2 py-0.5 rounded-md font-bold">
                  稀有度：1/1 / SSR / UR / RC / AUTO / PATCH
                </span>
              </div>
            </div>

            {/* 3. 售價與點數提取 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <DollarSign className="h-4 w-4" />
                </div>
                <span>3. 售價點數自動填入</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                檔名末尾帶有純數字或點數單位時，系統自動填入卡片售價：
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] font-mono bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded-md font-bold">
                  範例：_1500 / _800P / _2000點 (自動設為對應售價)
                </span>
              </div>
            </div>

            {/* 4. 運動分類自動分配 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                  <Tag className="h-4 w-4" />
                </div>
                <span>4. 球類與項目自動歸類</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                依據熱門球星、隊名或項目關鍵字自動判定分類：
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] font-mono bg-indigo-50 border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded-md font-bold">
                  籃球 (Curry/NBA) • 棒球 (大谷/Dodgers) • 足球 • TCG
                </span>
              </div>
            </div>
          </div>

          {/* 命名範例與實際解析對照表 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-slate-600" />
                實戰命名與解析對照範例
              </h4>
              <span className="text-[11px] text-slate-400 font-medium">點擊右側按鈕可複製檔名參考</span>
            </div>

            <div className="space-y-2.5">
              {EXAMPLES.map((ex, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-2xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">{ex.title}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy(`${ex.front}\n${ex.back}`, idx)}
                      className="h-7 px-2 text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600 mr-1" />
                          已複製檔名
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          複製範例檔名
                        </>
                      )}
                    </Button>
                  </div>

                  {/* 檔案名稱 */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 font-mono text-[11px] space-y-1 text-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-700 font-bold">正面檔名：</span>
                      <span>{ex.front}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-700 font-bold">背面檔名：</span>
                      <span>{ex.back}</span>
                    </div>
                  </div>

                  {/* 自動解析結果 */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="text-[11px] font-bold text-slate-400">解析入庫結果：</span>
                    <Badge variant="outline" className="font-bold border-slate-300 bg-white text-slate-800">
                      名稱：{ex.result.name}
                    </Badge>
                    <Badge className="bg-amber-100 text-amber-900 border-none font-black text-[10px]">
                      {ex.result.grade}
                    </Badge>
                    <Badge className="bg-emerald-100 text-emerald-900 border-none font-black text-[10px]">
                      售價：{ex.result.price}
                    </Badge>
                    <Badge className="bg-indigo-100 text-indigo-900 border-none font-black text-[10px]">
                      分類：{ex.result.category}
                    </Badge>
                    <Badge className="bg-cyan-100 text-cyan-900 border-none font-black text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-1 text-cyan-600" />
                      {ex.result.isDouble}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 貼心提示 */}
          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 space-y-1 font-medium">
            <div className="font-black flex items-center gap-1.5 text-amber-950">
              <Lightbulb className="h-4 w-4 text-amber-600" />
              彈性操作貼心提示：
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800 pl-1">
              <li>若只有正面圖片也可以直接拖入，系統會建立單面卡，並在清單中提供「補背面」快捷按鈕。</li>
              <li>若發現正反面拍反，可點擊每張卡片預覽區的「⇄ 互換」按鈕秒速對調。</li>
              <li>上傳前可在彈窗頂端使用「快速批量賦值工具」，一鍵統一將整批卡片套用指定分類或統一售價。</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 bg-slate-50 border-t border-slate-100 shrink-0 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            祝您卡片建檔順暢高效！
          </span>
          <Button
            onClick={() => setOpen(false)}
            className="h-9 px-5 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 text-white text-xs"
          >
            我瞭解了，開始上傳
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
