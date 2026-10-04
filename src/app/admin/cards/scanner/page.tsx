'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ScanLine, 
  Sparkles, 
  RotateCw, 
  RotateCcw, 
  Crop, 
  UploadCloud, 
  Trash2, 
  Plus, 
  Layers, 
  Download, 
  CheckCircle2, 
  Loader2, 
  ArrowLeft, 
  Grid, 
  Sliders, 
  RefreshCw, 
  FileSpreadsheet, 
  Package, 
  ArrowRightLeft,
  Eye,
  Check,
  Tag,
  DollarSign,
  Maximize2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useStorage } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { 
  CropBox, 
  ScannedCardItem, 
  cropImageFromSource, 
  generateGridBoxes, 
  downloadCardsZip,
  compressImageForDetection,
  detectCardBoundariesLocally
} from '@/lib/card-scanner-utils';

const CATEGORIES = ["籃球", "棒球", "足球", "女孩卡", "女優", "TCG", "其他"];
const AREAS = [
  { id: 'all', name: '全部卡片庫存' },
  { id: 'draw', name: '抽卡區域' },
  { id: 'betting', name: '拼卡區域' },
  { id: 'lucky-bag', name: '福袋區域' },
  { id: 'group-break', name: '團拆區域' },
];

export default function CardScannerProPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  // 正面狀態
  const [frontImageSrc, setFrontImageSrc] = useState<string | null>(null);
  const [frontBoxes, setFrontBoxes] = useState<CropBox[]>([]);
  const [selectedFrontBoxId, setSelectedFrontBoxId] = useState<string | null>(null);
  const frontImgRef = useRef<HTMLImageElement | null>(null);

  // 背面狀態 (不需文字，自動對應)
  const [backImageSrc, setBackImageSrc] = useState<string | null>(null);
  const [backBoxes, setBackBoxes] = useState<CropBox[]>([]);
  const [selectedBackBoxId, setSelectedBackBoxId] = useState<string | null>(null);
  const backImgRef = useRef<HTMLImageElement | null>(null);

  // 統合卡片列表 (正面資訊 + 背面對應)
  const [cards, setCards] = useState<ScannedCardItem[]>([]);

  // 處理進度
  const [isAiDetectingFront, setIsAiDetectingFront] = useState(false);
  const [isAiDetectingBack, setIsAiDetectingBack] = useState(false);
  const [isBatchAiRunning, setIsBatchAiRunning] = useState(false);
  const [isSavingToDb, setIsSavingToDb] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number } | null>(null);

  // 全域設定
  const [lockStandardRatio, setLockStandardRatio] = useState(true); // 鎖定 2.5:3.5 比例

  // 處理正面圖片上傳
  const handleFrontImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setFrontImageSrc(url);
    // 預設給一個居中的標準框
    const initialBox: CropBox = {
      id: uuidv4(),
      x: 25,
      y: 15,
      width: 50,
      height: 70,
      rotation: 0,
    };
    setFrontBoxes([initialBox]);
    setSelectedFrontBoxId(initialBox.id);

    setCards([{
      id: uuidv4(),
      index: 1,
      frontCropBox: initialBox,
      name: file.name.replace(/\.[^/.]+$/, '').replace(/_front/i, ''),
      category: '籃球',
      sellPrice: 100,
      grade: 'RAW',
      targetArea: 'all',
    }]);

    toast({
      title: '已載入正面掃描圖',
      description: '您可以點選「AI 自動偵測邊框」或選擇網格快速分割多卡。',
    });
  };

  // 處理背面圖片上傳
  const handleBackImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setBackImageSrc(url);

    // 預設將正面的框複製到背面
    if (frontBoxes.length > 0) {
      const cloned = frontBoxes.map((b) => ({ ...b, id: uuidv4() }));
      setBackBoxes(cloned);
      setSelectedBackBoxId(cloned[0]?.id || null);
    }

    toast({
      title: '已載入背面掃描圖',
      description: '背面將自動對齊上方正面的卡片，無需重複輸入文字。',
    });
  };

  // 當正面框數量或位置變化時，同步 cards 結構
  useEffect(() => {
    setCards((prevCards) => {
      return frontBoxes.map((box, idx) => {
        const existing = prevCards[idx];
        const backBox = backBoxes[idx];
        return {
          id: existing?.id || uuidv4(),
          index: idx + 1,
          frontCropBox: box,
          frontPreview: existing?.frontPreview,
          frontBlob: existing?.frontBlob,
          backCropBox: backBox,
          backPreview: existing?.backPreview,
          backBlob: existing?.backBlob,
          name: existing?.name || `卡片 #${idx + 1}`,
          category: existing?.category || '籃球',
          sellPrice: existing?.sellPrice || 100,
          grade: existing?.grade || 'RAW',
          rarity: existing?.rarity || '',
          cardNumber: existing?.cardNumber || '',
          features: existing?.features || [],
          targetArea: existing?.targetArea || 'all',
        };
      });
    });
  }, [frontBoxes, backBoxes]);

  // 即時預覽重新採樣
  const refreshPreviews = async () => {
    if (!frontImgRef.current && !backImgRef.current) return;

    const updated = [...cards];
    for (let i = 0; i < updated.length; i++) {
      // 裁切正面
      if (frontImgRef.current && updated[i].frontCropBox) {
        try {
          const { blob, dataUrl } = await cropImageFromSource(
            frontImgRef.current,
            updated[i].frontCropBox
          );
          updated[i].frontBlob = blob;
          updated[i].frontPreview = dataUrl;
        } catch (e) {
          console.error('Front crop preview error:', e);
        }
      }

      // 裁切背面
      if (backImgRef.current && updated[i].backCropBox) {
        try {
          const { blob, dataUrl } = await cropImageFromSource(
            backImgRef.current,
            updated[i].backCropBox!
          );
          updated[i].backBlob = blob;
          updated[i].backPreview = dataUrl;
        } catch (e) {
          console.error('Back crop preview error:', e);
        }
      }
    }
    setCards(updated);
  };

  // 快速生成正面網格
  const applyFrontGrid = (rows: number, cols: number) => {
    const boxes = generateGridBoxes(rows, cols);
    setFrontBoxes(boxes);
    setSelectedFrontBoxId(boxes[0]?.id || null);

    // 如果背面也已上傳，自動同步框
    if (backImageSrc) {
      setBackBoxes(boxes.map(b => ({ ...b, id: uuidv4() })));
    }
    toast({ title: `已生成 ${rows}x${cols} 共 ${rows * cols} 張卡片裁切框` });
  };

  // 一鍵複製正面框到背面
  const copyFrontBoxesToBack = () => {
    if (frontBoxes.length === 0) return;
    const cloned = frontBoxes.map(b => ({ ...b, id: uuidv4() }));
    setBackBoxes(cloned);
    setSelectedBackBoxId(cloned[0]?.id || null);
    toast({ title: '已將正面框同步至背面', description: '卡片編號已自動一對一對應！' });
  };

  // 一鍵鏡像背面框（左右翻轉對調）
  const mirrorBackBoxes = () => {
    if (backBoxes.length === 0) return;
    // 將每個框的 x 座標水平鏡像翻轉：newX = 100 - x - width
    const mirrored = backBoxes.map(b => ({
      ...b,
      x: Math.round((100 - b.x - b.width) * 10) / 10,
    }));
    setBackBoxes(mirrored);
    toast({ title: '已鏡像翻轉背面框', description: '解決正反面翻轉掃描時左右順序對調的問題！' });
  };

  // AI 自動偵測邊界框 (雙重保障：雲端 Vision AI + 本地邊緣偵測備援)
  const runAiDetection = async (isFront: boolean) => {
    const imgRef = isFront ? frontImgRef : backImgRef;
    if (!imgRef.current) return;

    if (isFront) setIsAiDetectingFront(true);
    else setIsAiDetectingBack(true);

    try {
      // 1. 輕量化壓縮至 1024px，避免超出 HTTP Body 限制或超時
      const base64 = compressImageForDetection(imgRef.current, 1024);

      let detectedBoxes: CropBox[] = [];

      try {
        const res = await fetch('/api/admin/scan-cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, mode: 'detect' }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.boxes && data.boxes.length > 0) {
            detectedBoxes = data.boxes.map((b: any) => ({
              id: uuidv4(),
              x: Math.round((b.xmin / 10) * 10) / 10,
              y: Math.round((b.ymin / 10) * 10) / 10,
              width: Math.max(10, Math.round(((b.xmax - b.xmin) / 10) * 10) / 10),
              height: Math.max(10, Math.round(((b.ymax - b.ymin) / 10) * 10) / 10),
              rotation: 0,
            }));
          }
        }
      } catch (apiErr) {
        console.warn('Cloud AI detect failed, switching to local detector:', apiErr);
      }

      // 2. 若雲端未能回傳有效框，自動切換至純前端影像分析演算法備援
      if (detectedBoxes.length === 0) {
        detectedBoxes = detectCardBoundariesLocally(imgRef.current);
        toast({
          title: '已啟用本地智慧邊緣對比偵測',
          description: `成功分析並定位 ${detectedBoxes.length} 個卡片區域。`,
        });
      } else {
        toast({
          title: `PRO AI 成功精準定位 ${detectedBoxes.length} 張卡片邊界`,
          description: '您可以微調邊緣位置或角度。',
        });
      }

      if (isFront) {
        setFrontBoxes(detectedBoxes);
        setSelectedFrontBoxId(detectedBoxes[0]?.id || null);
      } else {
        setBackBoxes(detectedBoxes);
        setSelectedBackBoxId(detectedBoxes[0]?.id || null);
      }

    } catch (e: any) {
      toast({ variant: 'destructive', title: '偵測錯誤', description: e.message || '偵測出錯' });
    } finally {
      if (isFront) setIsAiDetectingFront(false);
      else setIsAiDetectingBack(false);
    }
  };

  // 單張卡片 PRO 智慧辨識
  const runSingleAiRecognize = async (index: number) => {
    const card = cards[index];
    if (!card || !frontImgRef.current) return;

    setCards(prev => prev.map((c, i) => i === index ? { ...c, isAiRecognizing: true } : c));

    try {
      const { dataUrl } = await cropImageFromSource(frontImgRef.current, card.frontCropBox);

      const res = await fetch('/api/admin/scan-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, mode: 'recognize' }),
      });

      if (!res.ok) throw new Error('AI 辨識失敗');
      const data = await res.json();

      setCards(prev => prev.map((c, i) => {
        if (i !== index) return c;
        return {
          ...c,
          isAiRecognizing: false,
          name: data.name || c.name,
          category: data.category || c.category,
          sellPrice: data.suggestedPrice || c.sellPrice,
          grade: data.grade || c.grade,
          rarity: data.features?.[0] || c.rarity,
          cardNumber: data.cardNumber || c.cardNumber,
          features: data.features || c.features,
          description: data.description || c.description,
        };
      }));

      toast({ title: `卡片 #${index + 1} PRO 智慧辨識完成！`, description: `${data.name} · ${data.grade}` });
    } catch (e: any) {
      setCards(prev => prev.map((c, i) => i === index ? { ...c, isAiRecognizing: false } : c));
      toast({ variant: 'destructive', title: '辨識出錯', description: e.message });
    }
  };

  // 一鍵 PRO 智慧辨識全部正面卡片
  const runBatchAiRecognize = async () => {
    if (!frontImgRef.current || cards.length === 0) return;
    setIsBatchAiRunning(true);

    try {
      toast({ title: '開始批次 PRO 智慧辨識...', description: `共 ${cards.length} 張卡片將依序進行 AI 視覺解析。` });

      for (let i = 0; i < cards.length; i++) {
        await runSingleAiRecognize(i);
      }

      toast({ title: '🎉 全部卡片 PRO 智慧辨識完畢！' });
    } finally {
      setIsBatchAiRunning(false);
    }
  };

  // 旋轉控制 (正面或背面選取框)
  const handleRotate = (isFront: boolean, deltaAngle: number) => {
    if (isFront) {
      setFrontBoxes(prev => prev.map(b => b.id === selectedFrontBoxId ? { ...b, rotation: (b.rotation + deltaAngle) % 360 } : b));
    } else {
      setBackBoxes(prev => prev.map(b => b.id === selectedBackBoxId ? { ...b, rotation: (b.rotation + deltaAngle) % 360 } : b));
    }
  };

  // 儲存並匯入卡片庫
  const handleSaveAllToDatabase = async () => {
    if (!firestore || !storage || cards.length === 0 || !frontImgRef.current) return;
    setIsSavingToDb(true);
    setSaveProgress({ current: 0, total: cards.length });

    try {
      let savedCount = 0;

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        setSaveProgress({ current: i + 1, total: cards.length });

        // 1. 高清裁切正面
        const frontResult = await cropImageFromSource(frontImgRef.current, card.frontCropBox);
        const frontStorageRef = ref(storage, `cards/scanned_${uuidv4()}_front.jpg`);
        await uploadBytes(frontStorageRef, frontResult.blob);
        const frontUrl = await getDownloadURL(frontStorageRef);

        // 2. 高清裁切背面 (若有)
        let backUrl: string | undefined = undefined;
        if (backImgRef.current && card.backCropBox) {
          try {
            const backResult = await cropImageFromSource(backImgRef.current, card.backCropBox);
            const backStorageRef = ref(storage, `cards/scanned_${uuidv4()}_back.jpg`);
            await uploadBytes(backStorageRef, backResult.blob);
            backUrl = await getDownloadURL(backStorageRef);
          } catch (be) {
            console.warn('Back upload failed, skipped:', be);
          }
        }

        // 3. 寫入 Firestore `allCards`
        await addDoc(collection(firestore, 'allCards'), {
          name: card.name,
          category: card.category,
          sellPrice: Number(card.sellPrice) || 100,
          grade: card.grade || 'RAW',
          rarity: card.rarity || '',
          cardNumber: card.cardNumber || '',
          features: card.features || [],
          imageUrl: frontUrl,
          backImageUrl: backUrl || null,
          source: card.targetArea || 'all',
          description: card.description || '',
          createdAt: serverTimestamp(),
          isRecycled: false,
        });

        savedCount++;
      }

      toast({
        title: '🎉 批次匯入成功！',
        description: `已成功將 ${savedCount} 張球員卡（含正面與背面）無損匯入卡片資產庫。`,
      });

      // 導回卡片管理主頁
      router.push('/admin/cards');
    } catch (e: any) {
      toast({ variant: 'destructive', title: '匯入失敗', description: e.message });
    } finally {
      setIsSavingToDb(false);
      setSaveProgress(null);
    }
  };

  // 批次下載 ZIP
  const handleDownloadZip = async () => {
    if (!frontImgRef.current || cards.length === 0) return;
    toast({ title: '正在打包高清裁切圖檔...' });

    // 先確保 Blob 都已採樣
    await refreshPreviews();
    await downloadCardsZip(cards, `CardScanner_Export_${Date.now()}.zip`);
    toast({ title: 'ZIP 下載已啟動！' });
  };

  const activeFrontBox = frontBoxes.find(b => b.id === selectedFrontBoxId);
  const activeBackBox = backBoxes.find(b => b.id === selectedBackBoxId);

  return (
    <div className="space-y-6 pb-20 text-slate-900">
      
      {/* 頂部 Header & 操作按鈕列 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-slate-500 hover:text-slate-900">
              <Link href="/admin/cards">
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回卡片庫
              </Link>
            </Button>
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-[10px] px-2">
              PRO 旗艦版
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <ScanLine className="w-7 h-7 text-amber-500" />
            <span>球員卡掃描自動分割工具</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            支援多卡整版掃描、PRO 智慧多模態辨識、正反面自動聯動、旋轉校正與高清無損批次儲存。
          </p>
        </div>

        {/* 快捷操作按鈕組 */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={runBatchAiRecognize}
            disabled={isBatchAiRunning || cards.length === 0 || !frontImageSrc}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs shadow-md gap-1.5"
          >
            {isBatchAiRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>PRO 智慧辨識全部</span>
          </Button>

          <Button
            onClick={handleDownloadZip}
            disabled={cards.length === 0 || !frontImageSrc}
            variant="outline"
            className="h-10 px-3.5 rounded-xl font-bold text-xs border-slate-200 hover:bg-slate-50 gap-1.5"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>打包下載 ZIP</span>
          </Button>

          <Button
            onClick={handleSaveAllToDatabase}
            disabled={isSavingToDb || cards.length === 0 || !frontImageSrc}
            className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-md gap-1.5"
          >
            {isSavingToDb ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>匯入中 ({saveProgress?.current}/{saveProgress?.total})</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>一鍵匯入卡片庫</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🚀 上方工作區塊：【正面編輯區 (Front Side)】                              */}
      {/* ========================================================================= */}
      <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/80 border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-xs">
                1
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>正面編輯工作台 (Front Side)</span>
                  <Badge variant="outline" className="text-xs font-bold text-amber-600 border-amber-300 bg-amber-50">
                    主資訊來源
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  上傳正面大圖，調整裁切邊界、旋轉校正，並由 AI 辨識球員、系列與定價。
                </CardDescription>
              </div>
            </div>

            {/* 正面控制按鈕 */}
            <div className="flex items-center gap-2 flex-wrap">
              <label className="cursor-pointer">
                <Input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFrontImageUpload} 
                  className="hidden" 
                />
                <div className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-bold text-xs transition-colors">
                  <UploadCloud className="w-4 h-4 text-amber-600" />
                  <span>{frontImageSrc ? '更換正面圖片' : '上傳正面掃描圖'}</span>
                </div>
              </label>

              {frontImageSrc && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runAiDetection(true)}
                    disabled={isAiDetectingFront}
                    className="h-9 px-3 rounded-xl text-xs font-bold border-slate-200 gap-1"
                  >
                    {isAiDetectingFront ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                    <span>AI 偵測邊框</span>
                  </Button>

                  {/* 網格切分快捷按鈕 */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => applyFrontGrid(1, 1)}
                      className="h-8 px-2 text-[11px] font-bold"
                    >
                      單卡
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => applyFrontGrid(2, 2)}
                      className="h-8 px-2 text-[11px] font-bold"
                    >
                      2x2
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => applyFrontGrid(2, 3)}
                      className="h-8 px-2 text-[11px] font-bold"
                    >
                      2x3
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => applyFrontGrid(3, 3)}
                      className="h-8 px-2 text-[11px] font-bold"
                    >
                      3x3
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-6">
          {!frontImageSrc ? (
            <label className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-amber-200 hover:border-amber-400 bg-amber-50/30 hover:bg-amber-50/60 rounded-3xl cursor-pointer transition-all">
              <UploadCloud className="w-12 h-12 text-amber-500 mb-3 animate-bounce" />
              <span className="text-base font-black text-slate-800">點擊或拖曳上傳卡片【正面】掃描大圖</span>
              <span className="text-xs text-slate-400 mt-1">支援 A4 掃描器整版圖、手機多卡拍照（JPG / PNG / WebP）</span>
              <Input type="file" accept="image/*" onChange={handleFrontImageUpload} className="hidden" />
            </label>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* 正面大圖畫布可視區 (7 欄) */}
              <div className="lg:col-span-7 space-y-3">
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 p-2 flex items-center justify-center min-h-[360px] max-h-[550px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={frontImgRef}
                    src={frontImageSrc}
                    alt="Front Source"
                    className="max-h-[520px] w-auto object-contain select-none pointer-events-none"
                    onLoad={refreshPreviews}
                  />

                  {/* 裁切框疊加層 */}
                  <div className="absolute inset-2 pointer-events-none">
                    {frontBoxes.map((box, idx) => {
                      const isSelected = box.id === selectedFrontBoxId;
                      return (
                        <div
                          key={box.id}
                          onClick={() => setSelectedFrontBoxId(box.id)}
                          style={{
                            left: `${box.x}%`,
                            top: `${box.y}%`,
                            width: `${box.width}%`,
                            height: `${box.height}%`,
                            transform: `rotate(${box.rotation}deg)`,
                          }}
                          className={`absolute pointer-events-auto cursor-pointer rounded-lg border-2 transition-all flex flex-col justify-between p-1.5 ${
                            isSelected
                              ? 'border-amber-400 bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.5)] z-20'
                              : 'border-cyan-400/80 bg-cyan-500/10 hover:border-cyan-300 z-10'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="px-1.5 py-0.5 rounded bg-slate-950/80 text-white text-[10px] font-black font-mono">
                              #{idx + 1}
                            </span>
                            {isSelected && (
                              <span className="px-1 py-0.5 rounded bg-amber-500 text-slate-950 text-[9px] font-black">
                                編輯中
                              </span>
                            )}
                          </div>

                          <div className="text-[9px] font-mono text-white/90 bg-slate-950/60 rounded px-1 self-start">
                            {box.rotation !== 0 ? `${box.rotation}°` : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 正面裁切微調控制工具列 */}
                {activeFrontBox && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-600">卡片 #{frontBoxes.findIndex(b => b.id === selectedFrontBoxId) + 1} 旋轉校正:</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRotate(true, -90)}
                        className="h-8 px-2 font-bold"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        -90°
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRotate(true, 90)}
                        className="h-8 px-2 font-bold"
                      >
                        <RotateCw className="w-3.5 h-3.5 mr-1" />
                        +90°
                      </Button>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <span className="text-slate-500 text-[11px]">微調角度 ({activeFrontBox.rotation}°):</span>
                      <Slider
                        min={-45}
                        max={45}
                        step={1}
                        value={[activeFrontBox.rotation]}
                        onValueChange={([val]) => {
                          setFrontBoxes(prev => prev.map(b => b.id === selectedFrontBoxId ? { ...b, rotation: val } : b));
                        }}
                        className="w-32"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 正面資訊編輯清單 (5 欄) */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700">已辨識卡片列表 ({cards.length} 張)</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={refreshPreviews}
                    className="h-7 px-2 text-xs text-slate-500 gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>更新預覽</span>
                  </Button>
                </div>

                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {cards.map((card, idx) => (
                    <div
                      key={card.id}
                      onClick={() => setSelectedFrontBoxId(card.frontCropBox.id)}
                      className={`p-3.5 rounded-xl border transition-all ${
                        card.frontCropBox.id === selectedFrontBoxId
                          ? 'border-amber-400 bg-amber-50/40 shadow-xs ring-1 ring-amber-300'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* 裁切縮圖 */}
                        <div className="w-16 h-22 rounded-lg bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
                          {card.frontPreview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={card.frontPreview} alt="Front Crop" className="w-full h-full object-cover" />
                          ) : (
                            <Crop className="w-5 h-5 text-slate-400" />
                          )}
                        </div>

                        {/* 卡片屬性輸入 */}
                        <div className="flex-1 space-y-2 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-black text-amber-600 font-mono">#{card.index}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                runSingleAiRecognize(idx);
                              }}
                              disabled={card.isAiRecognizing}
                              className="h-6 px-2 text-[10px] font-black bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                            >
                              {card.isAiRecognizing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1 text-amber-500" />}
                              PRO 辨識
                            </Button>
                          </div>

                          <Input
                            placeholder="球員/卡片名稱"
                            value={card.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCards(prev => prev.map((c, i) => i === idx ? { ...c, name: val } : c));
                            }}
                            className="h-8 text-xs font-bold"
                          />

                          <div className="grid grid-cols-2 gap-2">
                            <Select
                              value={card.category}
                              onValueChange={(val) => {
                                setCards(prev => prev.map((c, i) => i === idx ? { ...c, category: val } : c));
                              }}
                            >
                              <SelectTrigger className="h-7 text-[11px] font-bold">
                                <SelectValue placeholder="分類" />
                              </SelectTrigger>
                              <SelectContent>
                                {CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                              </SelectContent>
                            </Select>

                            <Input
                              type="number"
                              placeholder="售價點數"
                              value={card.sellPrice}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setCards(prev => prev.map((c, i) => i === idx ? { ...c, sellPrice: val } : c));
                              }}
                              className="h-7 text-[11px] font-mono font-bold"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <Input
                              placeholder="評級 (如 PSA 10)"
                              value={card.grade || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCards(prev => prev.map((c, i) => i === idx ? { ...c, grade: val } : c));
                              }}
                              className="h-7 text-[11px]"
                            />
                            <Select
                              value={card.targetArea || 'all'}
                              onValueChange={(val) => {
                                setCards(prev => prev.map((c, i) => i === idx ? { ...c, targetArea: val } : c));
                              }}
                            >
                              <SelectTrigger className="h-7 text-[11px]">
                                <SelectValue placeholder="入庫專區" />
                              </SelectTrigger>
                              <SelectContent>
                                {AREAS.map(a => <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </CardContent>
      </Card>


      {/* ========================================================================= */}
      {/* 🚀 下方工作區塊：【對應卡片背面 (Back Side)】                             */}
      {/* 依使用者指示：背面區域不需要再打文字跟說明，只要對應上面正面區塊！         */}
      {/* ========================================================================= */}
      <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/80 border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                2
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>對應卡片背面工作台 (Back Side)</span>
                  <Badge variant="outline" className="text-xs font-bold text-cyan-700 border-cyan-300 bg-cyan-50">
                    免填文字 · 自動對齊上方卡片
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  上傳背面掃描大圖，背面編號將一對一綁定上方正面的卡片；支援一鍵複製與水平鏡像翻轉。
                </CardDescription>
              </div>
            </div>

            {/* 背面控制按鈕 */}
            <div className="flex items-center gap-2 flex-wrap">
              <label className="cursor-pointer">
                <Input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleBackImageUpload} 
                  className="hidden" 
                />
                <div className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-900 font-bold text-xs transition-colors">
                  <UploadCloud className="w-4 h-4 text-cyan-600" />
                  <span>{backImageSrc ? '更換背面圖片' : '上傳背面掃描圖'}</span>
                </div>
              </label>

              {backImageSrc && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyFrontBoxesToBack}
                    className="h-9 px-3 rounded-xl text-xs font-bold border-cyan-200 text-cyan-800 hover:bg-cyan-50 gap-1"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>複製正面框</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={mirrorBackBoxes}
                    className="h-9 px-3 rounded-xl text-xs font-bold border-cyan-200 text-cyan-800 hover:bg-cyan-50 gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>一鍵鏡像左右翻轉</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-6">
          {!backImageSrc ? (
            <label className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-cyan-200 hover:border-cyan-400 bg-cyan-50/20 hover:bg-cyan-50/50 rounded-3xl cursor-pointer transition-all">
              <UploadCloud className="w-12 h-12 text-cyan-600 mb-3" />
              <span className="text-base font-black text-slate-800">點擊上傳卡片【背面】掃描大圖（可選）</span>
              <span className="text-xs text-slate-400 mt-1">若卡片為雙面展示，上傳後系統自動將正面與背面繫結為同張卡片</span>
              <Input type="file" accept="image/*" onChange={handleBackImageUpload} className="hidden" />
            </label>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* 背面大圖畫布可視區 (7 欄) */}
              <div className="lg:col-span-7 space-y-3">
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 p-2 flex items-center justify-center min-h-[360px] max-h-[550px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={backImgRef}
                    src={backImageSrc}
                    alt="Back Source"
                    className="max-h-[520px] w-auto object-contain select-none pointer-events-none"
                    onLoad={refreshPreviews}
                  />

                  {/* 裁切框疊加層 */}
                  <div className="absolute inset-2 pointer-events-none">
                    {backBoxes.map((box, idx) => {
                      const isSelected = box.id === selectedBackBoxId;
                      return (
                        <div
                          key={box.id}
                          onClick={() => setSelectedBackBoxId(box.id)}
                          style={{
                            left: `${box.x}%`,
                            top: `${box.y}%`,
                            width: `${box.width}%`,
                            height: `${box.height}%`,
                            transform: `rotate(${box.rotation}deg)`,
                          }}
                          className={`absolute pointer-events-auto cursor-pointer rounded-lg border-2 transition-all flex flex-col justify-between p-1.5 ${
                            isSelected
                              ? 'border-cyan-400 bg-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.5)] z-20'
                              : 'border-slate-400/80 bg-slate-500/10 hover:border-cyan-300 z-10'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="px-1.5 py-0.5 rounded bg-slate-950/80 text-white text-[10px] font-black font-mono">
                              #{idx + 1} (背面)
                            </span>
                            {isSelected && (
                              <span className="px-1 py-0.5 rounded bg-cyan-500 text-slate-950 text-[9px] font-black">
                                校正中
                              </span>
                            )}
                          </div>

                          <div className="text-[9px] font-mono text-white/90 bg-slate-950/60 rounded px-1 self-start">
                            {box.rotation !== 0 ? `${box.rotation}°` : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 背面旋轉控制列 */}
                {activeBackBox && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-600">背面卡片 #{backBoxes.findIndex(b => b.id === selectedBackBoxId) + 1} 旋轉:</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRotate(false, -90)}
                        className="h-8 px-2 font-bold"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        -90°
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRotate(false, 90)}
                        className="h-8 px-2 font-bold"
                      >
                        <RotateCw className="w-3.5 h-3.5 mr-1" />
                        +90°
                      </Button>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <span className="text-slate-500 text-[11px]">角度 ({activeBackBox.rotation}°):</span>
                      <Slider
                        min={-45}
                        max={45}
                        step={1}
                        value={[activeBackBox.rotation]}
                        onValueChange={([val]) => {
                          setBackBoxes(prev => prev.map(b => b.id === selectedBackBoxId ? { ...b, rotation: val } : b));
                        }}
                        className="w-32"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 背面與正面對齊並排檢視清單 (5 欄) */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700">正反面對照檢視（免填文字）</span>
                  <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50">
                    自動同步上方正面屬性
                  </Badge>
                </div>

                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {cards.map((card) => (
                    <div
                      key={`back-${card.id}`}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* 正面縮圖 */}
                        <div className="w-12 h-16 rounded-md bg-white border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
                          {card.frontPreview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={card.frontPreview} alt="Front" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-slate-400">正</span>
                          )}
                        </div>

                        {/* 箭頭 */}
                        <ArrowRightLeft className="w-4 h-4 text-slate-400 shrink-0" />

                        {/* 背面縮圖 */}
                        <div className="w-12 h-16 rounded-md bg-cyan-950/20 border border-cyan-400/40 shrink-0 overflow-hidden flex items-center justify-center">
                          {card.backPreview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={card.backPreview} alt="Back" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-cyan-600 font-bold">背</span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-slate-900 truncate">#{card.index} {card.name}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {card.category} · {card.grade} · {card.sellPrice} P
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <Badge className="bg-emerald-100 text-emerald-800 text-[10px] border-none font-bold">
                          已配對
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
