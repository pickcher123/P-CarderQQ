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
  EyeOff,
  Check,
  Tag,
  DollarSign,
  Maximize2,
  ZoomIn,
  Copy,
  Zap,
  Eraser,
  FileText,
  Crosshair,
  Undo2,
  Search,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  CheckSquare,
  HelpCircle,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
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
import { collection, addDoc, serverTimestamp } from '@/lib/audited-firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import { 
  CropBox, 
  ScannedCardItem, 
  cropImageFromSource, 
  cropImageForAi,
  generateGridBoxes, 
  downloadCardsZip,
  compressImageForDetection,
  detectCardBoundariesLocally,
  sortCropBoxes,
  removeTopLeftLabelFromImage,
  detectWhiteStickerBox,
  detectStickerAtPoint,
  safeLoadImage
} from '@/lib/card-scanner-utils';
import { InteractiveCropOverlay } from '@/components/admin/InteractiveCropOverlay';

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

  // 🌟 SOP 標準作業程序步驟狀態 (1 到 8)
  const [currentSopStep, setCurrentSopStep] = useState<number>(1);
  const [isBatchPriceChecking, setIsBatchPriceChecking] = useState<boolean>(false);
  const [isQcModalOpen, setIsQcModalOpen] = useState<boolean>(false);

  // 🌟 卡片高清放大檢視與貼紙消除前後對比狀態 (Lightbox Zoom)
  const [zoomCardIdx, setZoomCardIdx] = useState<number | null>(null);
  const [zoomShowOriginal, setZoomShowOriginal] = useState<boolean>(false);
  const [zoomSide, setZoomSide] = useState<'front' | 'back'>('front');

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
  const [isBatchSlabOcrRunning, setIsBatchSlabOcrRunning] = useState(false);
  const [isBatchRemovingStickers, setIsBatchRemovingStickers] = useState(false);
  const [isSavingToDb, setIsSavingToDb] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number } | null>(null);

  // 全域設定與檢視偏好
  const [lockStandardRatio, setLockStandardRatio] = useState(true); // 鎖定 2.5:3.5 比例
  const [hideBoxBadges, setHideBoxBadges] = useState(false); // 隱藏裁切框左上角 #1 編號標籤以方便看清卡片

  // 🌟 互動式空白貼紙橡皮擦工作台狀態
  const [eraserCardIdx, setEraserCardIdx] = useState<number | null>(null);
  const [eraserBox, setEraserBox] = useState<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 60, height: 25 });
  const [eraserBaseImage, setEraserBaseImage] = useState<string | null>(null);
  const [eraserImageDims, setEraserImageDims] = useState<{ width: number; height: number }>({ width: 500, height: 700 });
  const [eraserCleanPreviewUrl, setEraserCleanPreviewUrl] = useState<string | null>(null);
  const [showCleanPreview, setShowCleanPreview] = useState<boolean>(false);
  const [isEraserProcessing, setIsEraserProcessing] = useState<boolean>(false);
  const [isDraggingFront, setIsDraggingFront] = useState<boolean>(false);
  const [isDraggingBack, setIsDraggingBack] = useState<boolean>(false);

  // 處理正面圖片載入（支援點擊選擇與拖曳放置）
  const processFrontFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: '格式不支援', description: '請上傳 JPG、PNG 或 WebP 圖片檔案。' });
      return;
    }

    const url = URL.createObjectURL(file);
    setFrontImageSrc(url);
    // 預設一個標準框
    const initialBox: CropBox = {
      id: uuidv4(),
      x: 10,
      y: 8,
      width: 25,
      height: 40,
      rotation: 0,
    };
    setFrontBoxes([initialBox]);
    setSelectedFrontBoxId(initialBox.id);

    setCards([{
      id: uuidv4(),
      index: 1,
      frontCropBox: initialBox,
      name: '卡片 #1',
      category: '籃球',
      sellPrice: 100,
      grade: 'RAW',
      targetArea: 'all',
      slabLabelText: '',
      certNumber: '',
      subgrades: '',
      formattedTitle: '',
      hasRemovedSticker: false,
    }]);

    // 若背面圖也已就緒，自動前進至步驟 2 (AI 邊框對齊)；否則留在步驟 1 方便順手補上背面圖
    if (backImageSrc) {
      setCurrentSopStep(2);
      toast({
        title: '正反面掃描圖已全部就緒！',
        description: '步驟 1 完成！請點選「AI 偵測邊框」自動精準分割正反面卡片。',
      });
    } else {
      toast({
        title: '已載入正面掃描圖',
        description: '建議順手於右側上傳【背面】照片（卡號、限量編號更齊全，查價更準確），或直接點選「進入步驟 2」。',
      });
    }
  };

  const handleFrontImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFrontFile(file);
  };

  // 處理背面圖片載入（支援點擊選擇與拖曳放置）
  const processBackFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: '格式不支援', description: '請上傳 JPG、PNG 或 WebP 圖片檔案。' });
      return;
    }

    const url = URL.createObjectURL(file);
    setBackImageSrc(url);

    // 預設將正面的框複製到背面
    if (frontBoxes.length > 0) {
      const cloned = frontBoxes.map((b) => ({ ...b, id: uuidv4() }));
      setBackBoxes(cloned);
      setSelectedBackBoxId(cloned[0]?.id || null);
    }

    // 若正面已上傳且仍在步驟 1，順暢前進至步驟 2 (AI 邊框對齊)
    if (frontImageSrc && currentSopStep === 1) {
      setCurrentSopStep(2);
      toast({
        title: '正反面掃描圖已就緒！',
        description: '步驟 1 完成！請點選「AI 偵測邊框」自動分割並同步正反面裁切框。',
      });
    } else {
      toast({
        title: '已載入背面掃描圖',
        description: frontImageSrc
          ? '正反面皆已載入，系統將自動整合正反面資訊進行 AI 辨識與精準查價！'
          : '背面已就緒！請再上傳【正面】掃描圖即可開始 AI 分割與雙面辨識。',
      });
    }
  };

  // 處理背面圖片上傳
  const handleBackImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processBackFile(file);
  };

  // 依最新正面裁切框即時重新裁切預覽圖（支援僅重裁單一變動框，不影響其他已完成去貼紙的卡片）
  const recropFrontPreviews = async (
    boxesToCrop: CropBox[],
    forceAll: boolean = true,
    onlyBoxId?: string
  ) => {
    if (!frontImgRef.current) return;
    const croppedMap = new Map<string, { preview: string; blob?: Blob }>();
    for (let i = 0; i < boxesToCrop.length; i++) {
      const box = boxesToCrop[i];
      if (onlyBoxId && box.id !== onlyBoxId) continue;
      try {
        const res = await cropImageFromSource(frontImgRef.current, box);
        croppedMap.set(box.id, { preview: res.dataUrl, blob: res.blob });
      } catch (e) {
        console.error('Front crop preview error:', e);
      }
    }
    setCards((prevCards) =>
      boxesToCrop.map((box, idx) => {
        const existing = prevCards.find((c) => c.frontCropBox.id === box.id) || prevCards[idx];
        const recropped = croppedMap.get(box.id);
        const keepCleaned = !recropped
          ? Boolean(existing?.hasRemovedSticker)
          : !forceAll && Boolean(existing?.hasRemovedSticker && existing?.frontPreview);
        return {
          id: existing?.id || uuidv4(),
          index: idx + 1,
          frontCropBox: box,
          frontPreview: keepCleaned ? existing?.frontPreview : recropped?.preview || existing?.frontPreview,
          frontBlob: keepCleaned ? existing?.frontBlob : recropped?.blob || existing?.frontBlob,
          backCropBox: existing?.backCropBox,
          backPreview: existing?.backPreview,
          backBlob: existing?.backBlob,
          name: existing?.name || `卡片 #${idx + 1}`,
          category: existing?.category || '籃球',
          sellPrice: existing?.sellPrice || 100,
          grade: existing?.grade || 'RAW',
          rarity: existing?.rarity || '',
          cardNumber: existing?.cardNumber || '',
          features: existing?.features || [],
          description: existing?.description || '',
          targetArea: existing?.targetArea || 'all',
          slabLabelText: existing?.slabLabelText || '',
          certNumber: existing?.certNumber || '',
          subgrades: existing?.subgrades || '',
          formattedTitle: existing?.formattedTitle || '',
          hasRemovedSticker: keepCleaned,
          originalFrontBlob: keepCleaned ? existing?.originalFrontBlob : undefined,
          originalFrontPreview: keepCleaned ? existing?.originalFrontPreview : undefined,
          priceRange: existing?.priceRange || '',
          priceRationale: existing?.priceRationale || '',
        };
      })
    );
  };

  // 依最新背面裁切框即時重新裁切背面縮圖
  const recropBackPreviews = async (boxesToCrop: CropBox[]) => {
    if (!backImgRef.current) return;
    const croppedResults: Array<{ preview: string; blob?: Blob }> = [];
    for (let i = 0; i < boxesToCrop.length; i++) {
      try {
        const res = await cropImageFromSource(backImgRef.current, boxesToCrop[i]);
        croppedResults.push({ preview: res.dataUrl, blob: res.blob });
      } catch (e) {
        console.error('Back crop preview error:', e);
        croppedResults.push({ preview: '' });
      }
    }
    setCards((prevCards) =>
      prevCards.map((card, idx) => ({
        ...card,
        backCropBox: boxesToCrop[idx],
        backPreview: croppedResults[idx]?.preview || undefined,
        backBlob: croppedResults[idx]?.blob || undefined,
      }))
    );
  };

  // 新增手動裁切框
  const handleAddCropBox = async (isFront: boolean) => {
    const currentBoxes = isFront ? frontBoxes : backBoxes;
    const offset = (currentBoxes.length % 5) * 3;
    const newBox: CropBox = {
      id: uuidv4(),
      x: Math.min(68, 12 + offset),
      y: Math.min(55, 10 + offset),
      width: 26,
      height: 38,
      rotation: 0,
    };
    const nextBoxes = [...currentBoxes, newBox];
    if (isFront) {
      setFrontBoxes(nextBoxes);
      setSelectedFrontBoxId(newBox.id);
      await recropFrontPreviews(nextBoxes, false);
    } else {
      setBackBoxes(nextBoxes);
      setSelectedBackBoxId(newBox.id);
      await recropBackPreviews(nextBoxes);
    }
    toast({ title: `已新增${isFront ? '正面' : '背面'}裁切框 #${nextBoxes.length}`, description: '可直接拖曳框體與四邊角點微調大小與位置。' });
  };

  // 刪除指定裁切框
  const handleDeleteCropBox = async (isFront: boolean, boxId: string) => {
    const currentBoxes = isFront ? frontBoxes : backBoxes;
    if (currentBoxes.length <= 1) {
      toast({ variant: 'destructive', title: '至少需保留 1 個裁切框' });
      return;
    }
    const nextBoxes = currentBoxes.filter((b) => b.id !== boxId);
    if (isFront) {
      setFrontBoxes(nextBoxes);
      setSelectedFrontBoxId(nextBoxes[0]?.id || null);
      await recropFrontPreviews(nextBoxes, false);
    } else {
      setBackBoxes(nextBoxes);
      setSelectedBackBoxId(nextBoxes[0]?.id || null);
      await recropBackPreviews(nextBoxes);
    }
  };

  // 當正面框數量或位置變化時，同步 cards 結構（不覆蓋已生成的最新預覽）
  useEffect(() => {
    setCards((prevCards) => {
      return frontBoxes.map((box, idx) => {
        const existing = prevCards.find((c) => c.frontCropBox.id === box.id) || prevCards[idx];
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
          description: existing?.description || '',
          targetArea: existing?.targetArea || 'all',
          slabLabelText: existing?.slabLabelText || '',
          certNumber: existing?.certNumber || '',
          subgrades: existing?.subgrades || '',
          formattedTitle: existing?.formattedTitle || '',
          hasRemovedSticker: existing?.hasRemovedSticker || false,
          originalFrontBlob: existing?.originalFrontBlob,
          originalFrontPreview: existing?.originalFrontPreview,
          priceRange: existing?.priceRange || '',
          priceRationale: existing?.priceRationale || '',
        };
      });
    });
  }, [frontBoxes, backBoxes]);

  // 即時預覽重新採樣
  const refreshPreviews = async () => {
    if (!frontImgRef.current && !backImgRef.current) return;
    if (frontImgRef.current && frontBoxes.length > 0) {
      await recropFrontPreviews(frontBoxes, false);
    }
    if (backImgRef.current && backBoxes.length > 0) {
      await recropBackPreviews(backBoxes);
    }
  };

  // 快速生成正面網格並立即為每張卡片精確重新裁切
  const applyFrontGrid = async (rows: number, cols: number) => {
    const boxes = generateGridBoxes(rows, cols);
    setFrontBoxes(boxes);
    setSelectedFrontBoxId(boxes[0]?.id || null);

    if (backImageSrc) {
      setBackBoxes(boxes.map(b => ({ ...b, id: uuidv4() })));
    }

    // 立即為每張卡片生成高清獨立預覽，杜絕殘留舊圖或全圖
    if (frontImgRef.current) {
      const freshCards: ScannedCardItem[] = [];
      for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i];
        let preview = '';
        let blob: Blob | undefined;
        try {
          const crop = await cropImageFromSource(frontImgRef.current, box);
          preview = crop.dataUrl;
          blob = crop.blob;
        } catch (err) {
          console.error('Grid crop error:', err);
        }
        freshCards.push({
          id: uuidv4(),
          index: i + 1,
          frontCropBox: box,
          frontPreview: preview,
          frontBlob: blob,
          name: `卡片 #${i + 1}`,
          category: '籃球',
          sellPrice: 100,
          grade: 'RAW',
          targetArea: 'all',
          features: [],
          hasRemovedSticker: false,
        });
      }
      setCards(freshCards);
    }

    setCurrentSopStep(3);
    toast({ title: `已生成 ${rows}x${cols} 共 ${rows * cols} 張卡片裁切框` });
  };

  // 一鍵複製正面框到背面並立即重新裁切背面縮圖
  const copyFrontBoxesToBack = async () => {
    if (frontBoxes.length === 0) return;
    const cloned = frontBoxes.map(b => ({ ...b, id: uuidv4() }));
    setBackBoxes(cloned);
    setSelectedBackBoxId(cloned[0]?.id || null);
    await recropBackPreviews(cloned);
    toast({ title: '已將正面框同步至背面', description: '卡片編號與背面縮圖已自動一對一對應！' });
  };

  // 一鍵鏡像背面框（左右翻轉對調）並立即重新裁切背面縮圖
  const mirrorBackBoxes = async () => {
    if (backBoxes.length === 0) return;
    const mirrored = backBoxes.map(b => ({
      ...b,
      x: Math.round((100 - b.x - b.width) * 10) / 10,
    }));
    setBackBoxes(mirrored);
    await recropBackPreviews(mirrored);
    toast({ title: '已鏡像翻轉背面框', description: '解決正反面翻轉掃描時左右順序對調的問題！' });
  };

  // 🌟 AI 自動偵測邊界框（使用 Gemini 4 原生 box_2d 精準定位，不再被本地演算法誤覆蓋）
  const runAiDetection = async (isFront: boolean) => {
    const imgRef = isFront ? frontImgRef : backImgRef;
    if (!imgRef.current) return;

    if (isFront) setIsAiDetectingFront(true);
    else setIsAiDetectingBack(true);

    try {
      // 1. 壓縮至 1536px 高清 JPEG（兼顧多卡邊緣清晰度與網路傳輸穩定性）
      const base64 = compressImageForDetection(imgRef.current, 1536);

      let detectedBoxes: CropBox[] = [];
      let cloudErrorMsg = '';

      try {
        const res = await fetch('/api/admin/scan-cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, mode: 'detect' }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          cloudErrorMsg = data?.error || `雲端 AI 偵測失敗 (HTTP ${res.status})`;
          console.error('Cloud AI detect error:', cloudErrorMsg);
        } else if (Array.isArray(data.boxes) && data.boxes.length > 0) {
          const rawCount = data.boxes.length;
          detectedBoxes = data.boxes
            .map((b: any) => {
              const x = Math.max(0, Math.min(99, Math.round((Number(b.xmin) / 10) * 10) / 10));
              const y = Math.max(0, Math.min(99, Math.round((Number(b.ymin) / 10) * 10) / 10));
              const right = Math.max(x + 4, Math.min(100, Math.round((Number(b.xmax) / 10) * 10) / 10));
              const bottom = Math.max(y + 4, Math.min(100, Math.round((Number(b.ymax) / 10) * 10) / 10));
              return {
                id: uuidv4(),
                x,
                y,
                width: Math.round((right - x) * 10) / 10,
                height: Math.round((bottom - y) * 10) / 10,
                rotation: 0,
              };
            })
            .filter((b: CropBox) => {
              if (b.width < 4 || b.height < 4) return false;
              // 多卡時排除誤框整張掃描底板的超大框；單卡時保留滿版近拍卡
              if (rawCount > 1 && b.width > 92 && b.height > 92) return false;
              return true;
            });
        }
      } catch (apiErr: any) {
        cloudErrorMsg = apiErr?.message || '網路連線異常';
        console.warn('Cloud AI detect request failed:', apiErr);
      }

      // 2. 僅在雲端 AI 失敗或完全未偵測到卡片時才啟用本地備援（絕不覆蓋有效的雲端 AI 結果！）
      let usedLocalFallback = false;
      if (detectedBoxes.length === 0) {
        detectedBoxes = detectCardBoundariesLocally(imgRef.current);
        usedLocalFallback = true;
      }

      // 3. 動態行分群排序（由上而下、同一排由左而右）
      detectedBoxes = sortCropBoxes(detectedBoxes);

      if (usedLocalFallback) {
        toast({
          variant: cloudErrorMsg ? 'destructive' : 'default',
          title: cloudErrorMsg ? '雲端 AI 偵測異常，已切換本地邊緣偵測' : '已啟用本地智慧邊緣偵測',
          description: cloudErrorMsg
            ? `${cloudErrorMsg}。已先為您框出 ${detectedBoxes.length} 張卡片，您可直接拖曳邊框微調。`
            : `已定位 ${detectedBoxes.length} 張卡片邊界，可直接拖曳邊框與角點微調。`,
        });
      } else {
        toast({
          title: `PRO AI 成功精準定位 ${detectedBoxes.length} 張卡片邊界`,
          description: '若需微調任一邊界，可直接拖曳畫布上的裁切框或四角控制點！',
        });
      }

      if (isFront) {
        setFrontBoxes(detectedBoxes);
        setSelectedFrontBoxId(detectedBoxes[0]?.id || null);

        // 立即生成每張卡片的真實高清裁切預覽
        await recropFrontPreviews(detectedBoxes, true);

        // 若背面圖已於步驟 1 一併上傳，立即自動同步背面裁切框並產出背面縮圖
        if (backImageSrc) {
          const clonedBack = detectedBoxes.map((b) => ({ ...b, id: uuidv4() }));
          setBackBoxes(clonedBack);
          setSelectedBackBoxId(clonedBack[0]?.id || null);
          await recropBackPreviews(clonedBack);
        }

        // SOP 流程前進至步驟 3 (正反面雙面 AI 辨識)
        setCurrentSopStep(3);
      } else {
        setBackBoxes(detectedBoxes);
        setSelectedBackBoxId(detectedBoxes[0]?.id || null);
        await recropBackPreviews(detectedBoxes);
        // 偵測背面完成後前進至步驟 3 (正反面雙面 AI 辨識)
        setCurrentSopStep(3);
      }

    } catch (e: any) {
      toast({ variant: 'destructive', title: '偵測錯誤', description: e.message || '偵測出錯' });
    } finally {
      if (isFront) setIsAiDetectingFront(false);
      else setIsAiDetectingBack(false);
    }
  };

  // 單張卡片 PRO 智慧辨識（若有背面圖會自動連同背面一起送給 AI 雙面聯判，精準抓出卡號與限量編號）
  const runSingleAiRecognize = async (index: number) => {
    const card = cards[index];
    if (!card || !frontImgRef.current) return;

    setCards(prev => prev.map((c, i) => i === index ? { ...c, isAiRecognizing: true } : c));

    try {
      // 使用輕量高清 JPEG（<= 1280px）送給 AI，杜絕原始大尺寸 PNG 導致 413 傳輸失敗
      const aiDataUrl = await cropImageForAi(frontImgRef.current, card.frontCropBox, 1280);
      let backAiDataUrl: string | undefined;
      const targetBackBox = card.backCropBox || backBoxes[index];
      if (backImgRef.current && targetBackBox) {
        try {
          backAiDataUrl = await cropImageForAi(backImgRef.current, targetBackBox, 1280);
        } catch (backCropErr) {
          console.warn('Back crop for AI failed, continuing with front only:', backCropErr);
        }
      }

      const res = await fetch('/api/admin/scan-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: aiDataUrl,
          ...(backAiDataUrl ? { backImage: backAiDataUrl } : {}),
          mode: 'recognize',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `AI 辨識失敗 (HTTP ${res.status})`);

      setCards(prev => prev.map((c, i) => {
        if (i !== index) return c;
        const newTitle = data.formattedTitle || data.name || c.name;
        return {
          ...c,
          isAiRecognizing: false,
          name: newTitle,
          category: data.category || c.category,
          sellPrice: data.suggestedPrice || c.sellPrice,
          grade: data.grade || c.grade,
          rarity: data.features?.[0] || c.rarity,
          cardNumber: data.cardNumber || c.cardNumber,
          features: data.features || c.features,
          description: data.description || c.description,
          slabLabelText: data.slabLabelText || c.slabLabelText || '',
          certNumber: data.certNumber || c.certNumber || '',
          subgrades: data.subgrades || c.subgrades || '',
          formattedTitle: data.formattedTitle || c.formattedTitle || '',
        };
      }));

      toast({ 
        title: `卡片 #${index + 1} ${backAiDataUrl ? '正反面雙圖' : '正面'}智慧辨識完成！`, 
        description: `${data.name} · ${data.grade}${data.cardNumber ? ` · ${data.cardNumber}` : ''}${data.slabLabelText ? ` · 已抓取標籤` : ''}` 
      });
    } catch (e: any) {
      setCards(prev => prev.map((c, i) => i === index ? { ...c, isAiRecognizing: false } : c));
      toast({ variant: 'destructive', title: '辨識出錯', description: e.message });
    }
  };

  // 單張卡片專屬：PSA/BGS 標籤文字自動抓取 (OCR)
  const runSingleSlabOcr = async (index: number) => {
    const card = cards[index];
    if (!card || !frontImgRef.current) return;

    setCards(prev => prev.map((c, i) => i === index ? { ...c, isOcrRunning: true } : c));

    try {
      const aiDataUrl = await cropImageForAi(frontImgRef.current, card.frontCropBox, 1280);

      const res = await fetch('/api/admin/scan-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: aiDataUrl, mode: 'ocr_slab' }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `標籤辨識失敗 (HTTP ${res.status})`);

      setCards(prev => prev.map((c, i) => {
        if (i !== index) return c;
        const newSlabText = data.slabLabelText || c.slabLabelText || '';
        const newTitle = data.formattedTitle || newSlabText || c.name;
        return {
          ...c,
          isOcrRunning: false,
          slabLabelText: newSlabText,
          certNumber: data.certNumber || c.certNumber || '',
          subgrades: data.subgrades || c.subgrades || '',
          formattedTitle: data.formattedTitle || c.formattedTitle || '',
          grade: data.grade || c.grade,
          name: newTitle || c.name,
          category: data.category || c.category,
          cardNumber: data.cardNumber || c.cardNumber,
          sellPrice: (c.sellPrice === 100 && data.suggestedPrice) ? data.suggestedPrice : c.sellPrice,
        };
      }));

      toast({ 
        title: `卡片 #${index + 1} PSA/BGS 標籤文字抓取成功！`, 
        description: data.slabLabelText ? `抓取: ${data.slabLabelText.slice(0, 36)}...` : (data.grade || '完成標籤提取') 
      });
    } catch (e: any) {
      setCards(prev => prev.map((c, i) => i === index ? { ...c, isOcrRunning: false } : c));
      toast({ variant: 'destructive', title: '標籤抓取失敗', description: e.message });
    }
  };

  // 一鍵自動抓取全體 PSA/BGS 標籤文字
  const runBatchSlabOcr = async () => {
    if (!frontImgRef.current || cards.length === 0) return;
    setIsBatchSlabOcrRunning(true);

    try {
      toast({ title: '開始抓取全體 PSA/BGS 標籤文字...', description: `共 ${cards.length} 張卡片依序解析鑑定標籤。` });

      for (let i = 0; i < cards.length; i++) {
        await runSingleSlabOcr(i);
      }

      toast({ title: '🎉 全體卡片 PSA/BGS 標籤文字抓取完畢！' });
    } finally {
      setIsBatchSlabOcrRunning(false);
    }
  };

  // 套用標籤文字或標準格式化品名為卡片名稱
  const applySlabTextToTitle = (index: number) => {
    const card = cards[index];
    if (!card) return;
    const targetText = card.formattedTitle || card.slabLabelText;
    if (!targetText) {
      toast({ variant: 'destructive', title: '尚無標籤文字', description: '請先點擊「抓取標籤」進行辨識。' });
      return;
    }
    setCards(prev => prev.map((c, i) => i === index ? { ...c, name: targetText } : c));
    toast({ title: '已將標籤文字套用為卡片品名！' });
  };

  // 複製標籤文字至剪貼簿
  const copySlabText = (index: number) => {
    const card = cards[index];
    if (!card?.slabLabelText) {
      toast({ variant: 'destructive', title: '尚無標籤文字可複製' });
      return;
    }
    navigator.clipboard.writeText(card.slabLabelText);
    toast({ title: '已複製標籤文字至剪貼簿！' });
  };

  // 復原單張卡片原圖 (保留貼紙標籤)
  const handleRestoreOriginalCard = (index: number) => {
    const card = cards[index];
    if (!card || !card.hasRemovedSticker) return;

    if (card.originalFrontBlob && card.originalFrontPreview) {
      setCards(prev => prev.map((c, i) => i === index ? {
        ...c,
        frontBlob: c.originalFrontBlob,
        frontPreview: c.originalFrontPreview,
        hasRemovedSticker: false,
      } : c));
      toast({ title: `卡片 #${index + 1} 已復原原始圖片（保留貼紙標籤）` });
    }
    if (eraserCardIdx === index) {
      setEraserCardIdx(null);
    }
  };

  // 開啟貼紙微調與消除工作台
  const openStickerEraser = async (index: number) => {
    const card = cards[index];
    if (!card) return;

    let baseImgUrl = card.originalFrontPreview || card.frontPreview;
    if (!baseImgUrl && frontImgRef.current) {
      const crop = await cropImageFromSource(frontImgRef.current, card.frontCropBox);
      baseImgUrl = crop.dataUrl;
    }

    if (!baseImgUrl) {
      toast({ variant: 'destructive', title: '尚未生成正面卡片影像' });
      return;
    }

    setEraserCardIdx(index);
    setEraserBaseImage(baseImgUrl);
    setShowCleanPreview(false);
    setEraserCleanPreviewUrl(null);

    // 取得圖片自然寬高並自動鎖定貼紙 (使用 safeLoadImage 杜絕 CORS 載入失敗)
    try {
      const img = await safeLoadImage(baseImgUrl);
      const w = img.naturalWidth || 500;
      const h = img.naturalHeight || 700;
      setEraserImageDims({ width: w, height: h });

      const detected = await detectWhiteStickerBox(img);
      setEraserBox({
        x: detected.x,
        y: detected.y,
        width: detected.width,
        height: detected.height,
      });
    } catch (e) {
      console.warn('Sticker detection fallback in modal:', e);
      setEraserBox({
        x: 15,
        y: 15,
        width: 80,
        height: 30,
      });
    }
  };

  // 在工作台圖片上點擊，自動連通捕捉貼紙邊界
  const handleEraserImageClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!eraserBaseImage) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickRatioX = (e.clientX - rect.left) / rect.width;
    const clickRatioY = (e.clientY - rect.top) / rect.height;

    const px = Math.round(clickRatioX * eraserImageDims.width);
    const py = Math.round(clickRatioY * eraserImageDims.height);

    try {
      const snapped = await detectStickerAtPoint(eraserBaseImage, px, py);
      setEraserBox({
        x: snapped.x,
        y: snapped.y,
        width: snapped.width,
        height: snapped.height,
      });
      setShowCleanPreview(false);
      setEraserCleanPreviewUrl(null);
      toast({ title: '🎯 已自動連通捕捉貼紙邊界！' });
    } catch (err) {
      console.warn('Click snap error:', err);
    }
  };

  // 預覽消除效果切換
  const handleToggleEraserPreview = async (enable: boolean) => {
    if (!enable) {
      setShowCleanPreview(false);
      return;
    }
    if (!eraserBaseImage) return;

    try {
      setIsEraserProcessing(true);
      const cleaned = await removeTopLeftLabelFromImage(eraserBaseImage, eraserBox);
      setEraserCleanPreviewUrl(cleaned.dataUrl);
      setShowCleanPreview(true);
    } catch (e: any) {
      toast({ variant: 'destructive', title: '預覽生成失敗', description: e.message });
    } finally {
      setIsEraserProcessing(false);
    }
  };

  // 確認套用消除結果
  const handleApplyEraserClean = async () => {
    if (eraserCardIdx === null || !eraserBaseImage) return;
    setIsEraserProcessing(true);

    try {
      const card = cards[eraserCardIdx];
      const backupBlob = card.originalFrontBlob || card.frontBlob;
      const backupPreview = card.originalFrontPreview || card.frontPreview || eraserBaseImage;

      const cleaned = await removeTopLeftLabelFromImage(eraserBaseImage, eraserBox);

      setCards(prev => prev.map((c, i) => i === eraserCardIdx ? {
        ...c,
        frontBlob: cleaned.blob,
        frontPreview: cleaned.dataUrl,
        originalFrontBlob: backupBlob,
        originalFrontPreview: backupPreview,
        hasRemovedSticker: true,
        isRemovingSticker: false,
      } : c));

      toast({
        title: `🎉 卡片 #${eraserCardIdx + 1} 左上空白貼紙已成功消除！`,
        description: `已平滑修復選取範圍 (${eraserBox.width}x${eraserBox.height}px)。`,
      });

      setEraserCardIdx(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: '消除失敗', description: e.message });
    } finally {
      setIsEraserProcessing(false);
    }
  };

  // 單張卡片：一鍵快速去除左上角白色空白貼紙 (或復原)
  const handleRemoveSticker = async (index: number) => {
    const card = cards[index];
    if (!card) return;

    // 若已經去除過標籤，再次點擊為「復原原始圖片」
    if (card.hasRemovedSticker) {
      handleRestoreOriginalCard(index);
      return;
    }

    // 開始執行去除
    setCards(prev => prev.map((c, i) => i === index ? { ...c, isRemovingSticker: true } : c));

    try {
      let sourceDataUrl = card.frontPreview;
      if (!sourceDataUrl && frontImgRef.current) {
        const crop = await cropImageFromSource(frontImgRef.current, card.frontCropBox);
        sourceDataUrl = crop.dataUrl;
      }

      if (!sourceDataUrl) throw new Error('尚未生成正面預覽圖');

      const backupBlob = card.frontBlob;
      const backupPreview = card.frontPreview || sourceDataUrl;

      // 呼叫智慧無痕修復演算法 (具備全自動連通與標準位置備援)
      const cleaned = await removeTopLeftLabelFromImage(sourceDataUrl);

      setCards(prev => prev.map((c, i) => i === index ? {
        ...c,
        frontBlob: cleaned.blob,
        frontPreview: cleaned.optimizedDataUrl || cleaned.dataUrl,
        originalFrontBlob: backupBlob,
        originalFrontPreview: backupPreview,
        hasRemovedSticker: true,
        isRemovingSticker: false,
      } : c));

      toast({ 
        title: `🎉 卡片 #${index + 1} 左上空白貼紙已成功去除！`, 
        description: '已無痕修復外殼與卡面邊界，若需自訂選框可點擊「🎯」調整。' 
      });
    } catch (e: any) {
      setCards(prev => prev.map((c, i) => i === index ? { ...c, isRemovingSticker: false } : c));
      toast({ variant: 'destructive', title: '去除標籤出錯', description: e.message });
      openStickerEraser(index);
    }
  };

  // 批次去除全體卡片左上角白色標籤貼紙
  const handleBatchRemoveStickers = async () => {
    if (cards.length === 0) return;
    setIsBatchRemovingStickers(true);
    toast({ title: '開始全體掃描去除左上角白色貼紙標籤...' });
    let count = 0;
    const removedIndices: number[] = [];

    try {
      const updatedCards = [...cards];

      for (let i = 0; i < updatedCards.length; i++) {
        const card = updatedCards[i];
        if (card.hasRemovedSticker) continue;

        let sourceDataUrl = card.frontPreview;
        let sourceBlob = card.frontBlob;
        if (!sourceDataUrl && frontImgRef.current && card.frontCropBox) {
          const crop = await cropImageFromSource(frontImgRef.current, card.frontCropBox);
          sourceDataUrl = crop.dataUrl;
          sourceBlob = crop.blob;
        }
        if (!sourceDataUrl) continue;

        // 僅對檢測出含有白色貼紙標籤的卡片進行處理 (避免破壞乾淨無貼紙的 PSA 卡)
        const detected = await detectWhiteStickerBox(sourceDataUrl);
        if (detected && detected.found) {
          const backupBlob = sourceBlob;
          const backupPreview = sourceDataUrl;
          const cleaned = await removeTopLeftLabelFromImage(sourceDataUrl, detected);

          updatedCards[i] = {
            ...card,
            frontBlob: cleaned.blob,
            frontPreview: cleaned.optimizedDataUrl || cleaned.dataUrl,
            originalFrontBlob: backupBlob,
            originalFrontPreview: backupPreview,
            hasRemovedSticker: true,
          };
          count++;
          removedIndices.push(i + 1);
        }
      }

      setCards(updatedCards);

      if (count > 0) {
        toast({ 
          title: `🎉 成功為 ${count} 張卡片清除左上角空白標籤貼紙！`, 
          description: `已處理卡片：#${removedIndices.join(', #')}。未貼標籤的乾淨評級卡已自動完整保留原貌。`
        });
      } else {
        toast({ 
          title: '已檢查全體卡片：未偵測到需要去除的空白貼紙', 
          description: '若卡片上有特殊標籤，可點選卡片縮圖旁的「去掉貼紙」或「🎯 調整」手動圈選清除。'
        });
      }

      // 步驟 4 完成後，引導至步驟 5 (上傳背面照片)
      setCurrentSopStep(5);
    } catch (e: any) {
      toast({ variant: 'destructive', title: '批次處理失敗', description: e.message });
    } finally {
      setIsBatchRemovingStickers(false);
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

      toast({ title: '🎉 全部卡片 PRO 智慧辨識完畢！', description: '已結合正反面資訊完成辨識，接下來可直接聯網查詢精準市場卡價。' });
      // 步驟 3 完成後，引導至步驟 4 (聯網查詢卡價)
      setCurrentSopStep(4);
    } finally {
      setIsBatchAiRunning(false);
    }
  };

  // 🌟 SOP 步驟 4：查詢市場卡價行情 (整合正反面卡號、限量、評級標籤，聯網比對 eBay / 130point / 台灣市場行情)
  const handleBatchPriceCheck = async () => {
    if (cards.length === 0) return;
    setIsBatchPriceChecking(true);

    try {
      toast({
        title: '正在聯網查詢市場卡價行情...',
        description: `依據正反面完整品名、卡號、限量與評級等級，比對全體 ${cards.length} 張卡片的近期成交估價。`,
      });

      const payloadCards = cards.map(c => ({
        id: c.id,
        name: c.name,
        formattedTitle: c.formattedTitle || '',
        category: c.category,
        grade: c.grade || 'RAW',
        cardNumber: c.cardNumber || '',
        certNumber: c.certNumber || '',
        subgrades: c.subgrades || '',
        rarity: c.rarity || '',
        features: c.features || [],
        slabLabelText: c.slabLabelText || '',
        description: c.description || '',
        hasBackImage: Boolean(c.backPreview),
        currentPrice: c.sellPrice,
      }));

      const res = await fetch('/api/admin/scan-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'price_estimate', cardList: payloadCards }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `市場行情查詢失敗 (HTTP ${res.status})`);
      const estimates: Array<{ id: string; suggestedPrice: number; priceRange: string; rationale: string }> = data.estimates || [];

      if (estimates.length === 0) {
        throw new Error('AI 未回傳有效估價資料，請確認卡片品名與評級後重試');
      }

      setCards(prev => prev.map(card => {
        const est = estimates.find(e => e.id === card.id);
        if (est) {
          return {
            ...card,
            sellPrice: est.suggestedPrice || card.sellPrice,
            priceRange: est.priceRange || '',
            priceRationale: est.rationale || '',
          };
        }
        return card;
      }));

      // 步驟 4 完成後，前進至步驟 5 (品管核對) 並開啟 QC Modal
      setCurrentSopStep(5);
      setIsQcModalOpen(true);

      toast({
        title: data.usedLiveSearch ? '🎉 即時聯網卡價查詢完畢！' : '🎉 AI 卡價行情估算完畢！',
        description: `已更新 ${estimates.length} 張卡片建議售價與行情依據，請於品管視窗確認。`,
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '卡價行情查詢失敗', description: e.message });
    } finally {
      setIsBatchPriceChecking(false);
    }
  };

  // 單張卡片獨立查價
  const runSinglePriceCheck = async (index: number) => {
    const card = cards[index];
    if (!card) return;
    setCards(prev => prev.map((c, i) => i === index ? { ...c, isPriceChecking: true } : c));
    try {
      const res = await fetch('/api/admin/scan-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'price_estimate',
          cardList: [{
            id: card.id,
            name: card.name,
            formattedTitle: card.formattedTitle || '',
            category: card.category,
            grade: card.grade || 'RAW',
            cardNumber: card.cardNumber || '',
            certNumber: card.certNumber || '',
            subgrades: card.subgrades || '',
            rarity: card.rarity || '',
            features: card.features || [],
            slabLabelText: card.slabLabelText || '',
            description: card.description || '',
            hasBackImage: Boolean(card.backPreview),
            currentPrice: card.sellPrice,
          }],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `查價失敗 (HTTP ${res.status})`);
      }
      const est = data.estimates?.[0];
      if (est) {
        setCards(prev => prev.map((c, i) => i === index ? {
          ...c,
          sellPrice: est.suggestedPrice || c.sellPrice,
          priceRange: est.priceRange,
          priceRationale: est.rationale,
          isPriceChecking: false,
        } : c));
        toast({
          title: `卡片 #${index + 1} ${data.usedLiveSearch ? '即時聯網' : 'AI'}卡價已更新！`,
          description: `建議售價：${est.suggestedPrice.toLocaleString()} 點（${est.priceRange}）`,
        });
        return;
      }
      throw new Error('未取得該卡片估價結果');
    } catch (err: any) {
      toast({ variant: 'destructive', title: `卡片 #${index + 1} 查價失敗`, description: err?.message || '請稍後再試' });
    }
    setCards(prev => prev.map((c, i) => i === index ? { ...c, isPriceChecking: false } : c));
  };

  // 旋轉控制 (正面或背面選取框，並即時更新對應預覽圖)
  const handleRotate = (isFront: boolean, deltaAngle: number) => {
    if (isFront) {
      const next = frontBoxes.map(b => b.id === selectedFrontBoxId ? { ...b, rotation: (b.rotation + deltaAngle) % 360 } : b);
      setFrontBoxes(next);
      recropFrontPreviews(next, true, selectedFrontBoxId || undefined);
    } else {
      const next = backBoxes.map(b => b.id === selectedBackBoxId ? { ...b, rotation: (b.rotation + deltaAngle) % 360 } : b);
      setBackBoxes(next);
      recropBackPreviews(next);
    }
  };

  // 儲存並匯入卡片庫
  const handleSaveAllToDatabase = async () => {
    if (!firestore || cards.length === 0 || !frontImgRef.current) return;
    setIsSavingToDb(true);
    setSaveProgress({ current: 0, total: cards.length });

    try {
      let savedCount = 0;
      let usedFallbackStorage = false;

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        setSaveProgress({ current: i + 1, total: cards.length });

        // 1. 高清正面圖處理（若已去標籤，優先使用已修復之圖片）
        let frontUrl = '';

        if (card.frontBlob && storage) {
          try {
            const frontStorageRef = ref(storage, `cards/scanned_${uuidv4()}_front.jpg`);
            await uploadBytes(frontStorageRef, card.frontBlob);
            frontUrl = await getDownloadURL(frontStorageRef);
          } catch (storageErr: any) {
            console.warn('Firebase Storage upload fallback:', storageErr);
            usedFallbackStorage = true;
          }
        }

        // 🌟 若已去標籤或已有預覽圖，Storage 失敗時直接採用已修復之正面圖
        if (!frontUrl && card.hasRemovedSticker && card.frontPreview) {
          frontUrl = card.frontPreview;
        }

        // 備援裁切（僅限尚未產生預覽且未去標籤的卡片）
        if (!frontUrl && frontImgRef.current) {
          const frontResult = await cropImageFromSource(frontImgRef.current, card.frontCropBox);
          if (storage) {
            try {
              const frontStorageRef = ref(storage, `cards/scanned_${uuidv4()}_front.jpg`);
              await uploadBytes(frontStorageRef, frontResult.blob);
              frontUrl = await getDownloadURL(frontStorageRef);
            } catch (storageErr: any) {
              usedFallbackStorage = true;
            }
          }
          if (!frontUrl) {
            frontUrl = frontResult.optimizedDataUrl || frontResult.dataUrl;
          }
        }

        if (!frontUrl && card.frontPreview) {
          frontUrl = card.frontPreview;
        }

        // 壓縮檢查：若為 Data URL 且體積較大，即時縮小以保證不超過 Firestore 1MB 上限
        if (frontUrl && frontUrl.startsWith('data:image/') && frontUrl.length > 500000) {
          try {
            const imgEl = await safeLoadImage(frontUrl);
            const compCanvas = document.createElement('canvas');
            const compW = Math.min(720, imgEl.naturalWidth || 720);
            const compH = Math.round((compW / (imgEl.naturalWidth || 1)) * (imgEl.naturalHeight || 1));
            compCanvas.width = compW;
            compCanvas.height = compH;
            const compCtx = compCanvas.getContext('2d');
            if (compCtx) {
              compCtx.drawImage(imgEl, 0, 0, compW, compH);
              frontUrl = compCanvas.toDataURL('image/jpeg', 0.82);
            }
          } catch (compErr) {
            console.warn('Compress fallback error:', compErr);
          }
        }

        // 2. 高清裁切背面 (若有)
        let backUrl: string | undefined = undefined;
        if (backImgRef.current && card.backCropBox) {
          try {
            const backResult = await cropImageFromSource(backImgRef.current, card.backCropBox);
            if (storage) {
              try {
                const backStorageRef = ref(storage, `cards/scanned_${uuidv4()}_back.jpg`);
                await uploadBytes(backStorageRef, backResult.blob);
                backUrl = await getDownloadURL(backStorageRef);
              } catch (storageErr) {
                usedFallbackStorage = true;
              }
            }
            if (!backUrl) {
              backUrl = backResult.optimizedDataUrl || backResult.dataUrl;
            }
          } catch (be) {
            console.warn('Back crop failed, skipped:', be);
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
          slabLabelText: card.slabLabelText || null,
          certNumber: card.certNumber || null,
          subgrades: card.subgrades || null,
          hasRemovedSticker: card.hasRemovedSticker || false,
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
        description: usedFallbackStorage
          ? `已成功將 ${savedCount} 張球員卡以高清直存模式安全匯入卡片資產庫！`
          : `已成功將 ${savedCount} 張球員卡（含正面與背面）無損匯入卡片資產庫。`,
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
      
      {/* 🌟 頂部 Header & 簡潔明亮 7 步 SOP 流程指揮台 */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-5 text-slate-900">
        {/* 頂部標題與核心輔助功能 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-[3px] h-11 rounded-full bg-gradient-to-b from-amber-400 to-amber-600 shrink-0 mt-1" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Button variant="ghost" size="sm" asChild className="h-7 px-2 -ml-2 text-slate-500 hover:text-slate-900">
                  <Link href="/admin/cards">
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                    返回卡片庫
                  </Link>
                </Button>
                <Badge className="bg-amber-100 text-amber-800 border border-amber-200 font-black text-[10px] px-2.5 rounded-full">
                  PRO AI 旗艦版
                </Badge>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                <ScanLine className="w-6 h-6 text-amber-500" />
                <span>球員卡掃描自動分割工具</span>
              </h1>
            </div>
          </div>

          {/* 右上角極簡狀態指示 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3.5 py-1.5 rounded-full border border-slate-200 tabular-nums">
              步驟 {currentSopStep} / 6 · {cards.length} 張卡片
            </span>
          </div>
        </div>

        {/* 🌟 精簡 6 步 SOP 流程進度條（先上傳正反面 → AI 邊框對齊 → 雙面辨識 → 聯網精準查價） */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span className="font-bold text-slate-700 flex items-center gap-1.5 tabular-nums">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              助理 SOP 標準作業程序 (步驟 {currentSopStep} / 6)
            </span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">先備齊正反面，再辨識與查價最精準 · 支援隨時點擊跳轉</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { num: 1, title: '1.上傳正反面', shortDesc: '先備齊正面與背面', isDone: Boolean(frontImageSrc) && (Boolean(backImageSrc) || currentSopStep > 1) },
              { num: 2, title: '2.AI邊框對齊', shortDesc: '自動分割同步正反面', isDone: frontBoxes.length > 0 && Boolean(frontImageSrc) && currentSopStep > 2 },
              { num: 3, title: '3.雙面辨識', shortDesc: '正反面 AI 聯合判讀', isDone: cards.some(c => c.name && !c.name.startsWith('卡片 #')) },
              { num: 4, title: '4.查詢卡價', shortDesc: '整合雙面資訊聯網估價', isDone: cards.some(c => Boolean(c.priceRange)) || currentSopStep > 4 },
              { num: 5, title: '5.檢查QC', shortDesc: '入庫前品管核對', isDone: currentSopStep > 5 },
              { num: 6, title: '6.一鍵入庫', shortDesc: '寫入卡片資料庫', isDone: isSavingToDb },
            ].map((item) => {
              const isCurrent = currentSopStep === item.num;
              return (
                <button
                  key={item.num}
                  type="button"
                  onClick={() => setCurrentSopStep(item.num)}
                  className={`text-left p-2.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                    isCurrent
                      ? 'bg-amber-50 border-amber-400 text-amber-950 shadow-xs ring-2 ring-amber-300/40'
                      : item.isDone
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 hover:bg-emerald-50'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded tabular-nums ${
                      isCurrent
                        ? 'bg-amber-500 text-white'
                        : item.isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      #{item.num}
                    </span>
                    {item.isDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : isCurrent ? (
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                    ) : null}
                  </div>
                  <span className={`text-xs font-black truncate w-full ${isCurrent ? 'text-amber-950' : item.isDone ? 'text-emerald-900' : 'text-slate-700'}`}>
                    {item.title}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate w-full block mt-0.5">
                    {item.shortDesc}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 🌟 當前步驟專屬聚焦指揮區（乾淨明亮白灰風格） */}
          <div className="p-4 rounded-xl bg-slate-50/90 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0 tabular-nums">
                {currentSopStep}
              </div>
              <div>
                <p className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <span>
                    {currentSopStep === 1 && '先上傳卡片【正面】與【背面】掃描圖（備齊雙面資訊，後續辨識與查價更精準）'}
                    {currentSopStep === 2 && '執行 AI 邊框偵測，自動切分正面並同步對齊背面裁切框'}
                    {currentSopStep === 3 && '正反面 PRO 智慧辨識，同時讀取正面球星與背面卡號／限量編號'}
                    {currentSopStep === 4 && '聯網查詢市場卡價（帶著正反面完整卡號、限量與評級比對 eBay / 130point 行情）'}
                    {currentSopStep === 5 && '入庫前品管核對（確認品名、售價、評級與外觀）'}
                    {currentSopStep === 6 && '確認無誤，一鍵匯入卡片資產庫！'}
                  </span>
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {currentSopStep === 1 && (frontImageSrc && backImageSrc ? '正面與背面皆已就緒！可直接前往下一步執行 AI 邊框分割。' : frontImageSrc ? '正面圖已就緒！建議順手補上傳背面照片（含卡號與限量編號），或單面卡直接前往下一步。' : '請於下方工作台一次拖曳或選擇正面與背面圖片（支援單卡近拍或多卡合拍）。')}
                  {currentSopStep === 2 && '偵測完成後會自動同步套用至背面，若翻面左右相反可按「鏡像左右翻轉」。'}
                  {currentSopStep === 3 && 'AI 會同時判讀正面與背面圖片，自動補齊卡號、限量編號、年份、品牌與 PSA/BGS 標籤。'}
                  {currentSopStep === 4 && 'AI 即時聯網搜尋近期真實成交紀錄，自動帶入建議售價與行情依據。'}
                  {currentSopStep === 5 && '核對全部卡片資料無誤後即可一鍵批次入庫。'}
                  {currentSopStep === 6 && '自動將高清正面與背面卡片寫入庫存資料庫。'}
                </p>
              </div>
            </div>

            {/* 核心操作按鈕 */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {currentSopStep === 1 && (
                <>
                  <label className="cursor-pointer">
                    <Input type="file" accept="image/*" onChange={handleFrontImageUpload} className="hidden" />
                    <div className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs transition-all">
                      <UploadCloud className="w-3.5 h-3.5 text-amber-600" />
                      <span>{frontImageSrc ? '更換正面圖' : '上傳正面圖'}</span>
                    </div>
                  </label>
                  <label className="cursor-pointer">
                    <Input type="file" accept="image/*" onChange={handleBackImageUpload} className="hidden" />
                    <div className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 font-bold text-xs transition-all">
                      <UploadCloud className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{backImageSrc ? '更換背面圖' : '上傳背面圖（推薦）'}</span>
                    </div>
                  </label>
                  {frontImageSrc && (
                    <Button
                      size="sm"
                      onClick={() => setCurrentSopStep(2)}
                      className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black gap-1.5 shadow-sm"
                    >
                      <span>進入步驟 2：AI 邊框</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </>
              )}

              {currentSopStep === 2 && (
                <>
                  <Button
                    size="sm"
                    onClick={() => runAiDetection(true)}
                    disabled={isAiDetectingFront || !frontImageSrc}
                    className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md gap-1.5"
                  >
                    {isAiDetectingFront ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>AI 偵測邊框</span>
                  </Button>

                  {/* 網格切分快捷輔助選項 (專屬步驟 2) */}
                  <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-xl border border-slate-300 shadow-2xs">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => applyFrontGrid(1, 1)}
                      className="h-8 px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                    >
                      單卡
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => applyFrontGrid(2, 2)}
                      className="h-8 px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                    >
                      2x2
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => applyFrontGrid(2, 3)}
                      className="h-8 px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                    >
                      2x3
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => applyFrontGrid(3, 3)}
                      className="h-8 px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                    >
                      3x3
                    </Button>
                  </div>

                  {backImageSrc && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={copyFrontBoxesToBack}
                        className="h-9 px-3 rounded-xl text-xs font-bold border-cyan-300 bg-cyan-50/80 hover:bg-cyan-100 text-cyan-900 gap-1 shadow-2xs"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-700" />
                        <span>同步背面框</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={mirrorBackBoxes}
                        className="h-9 px-3 rounded-xl text-xs font-bold border-cyan-300 bg-cyan-50/80 hover:bg-cyan-100 text-cyan-900 gap-1 shadow-2xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-cyan-700" />
                        <span>鏡像翻轉背面</span>
                      </Button>
                    </>
                  )}

                  {/* 隱藏/顯示 編號標記 */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setHideBoxBadges(!hideBoxBadges)}
                    className={`h-9 px-2.5 text-[11px] font-bold rounded-xl border ${
                      hideBoxBadges ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-white border-slate-300 text-slate-700'
                    }`}
                    title={hideBoxBadges ? "點擊顯示卡片邊框編號" : "點擊隱藏編號以清晰檢視卡片"}
                  >
                    {hideBoxBadges ? <EyeOff className="w-3.5 h-3.5 mr-1 text-amber-700" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                    <span>{hideBoxBadges ? "已隱藏編號" : "隱藏編號"}</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentSopStep(3)}
                    className="h-9 px-3 rounded-xl border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold gap-1 shadow-xs"
                  >
                    <span>進入步驟 3：雙面辨識</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}

              {currentSopStep === 3 && (
                <>
                  <Button
                    size="sm"
                    onClick={runBatchAiRecognize}
                    disabled={isBatchAiRunning || cards.length === 0}
                    className="h-9 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs shadow-md gap-1.5"
                  >
                    {isBatchAiRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>{backImageSrc ? '正反面 PRO 智慧辨識全部' : 'PRO 智慧辨識全部'}</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={runBatchSlabOcr}
                    disabled={isBatchSlabOcrRunning || cards.length === 0}
                    className="h-9 px-3 rounded-xl border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 text-xs font-bold gap-1.5 shadow-2xs"
                    title="單獨針對 PSA/BGS 卡殼頂部標籤文字與證號執行 OCR"
                  >
                    {isBatchSlabOcrRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" /> : <FileText className="w-3.5 h-3.5 text-indigo-600" />}
                    <span>抓取 PSA/BGS 標籤</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentSopStep(4)}
                    className="h-9 px-3 rounded-xl border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold gap-1 shadow-xs"
                  >
                    <span>進入步驟 4：查詢卡價</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}

              {currentSopStep === 4 && (
                <>
                  <Button
                    size="sm"
                    onClick={handleBatchPriceCheck}
                    disabled={isBatchPriceChecking || cards.length === 0}
                    className="h-9 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-md gap-1.5"
                  >
                    {isBatchPriceChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span>AI 聯網查詢全體卡價</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCurrentSopStep(5);
                      setIsQcModalOpen(true);
                    }}
                    className="h-9 px-3 rounded-xl border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold gap-1 shadow-xs"
                  >
                    <span>進入步驟 5：品管核對</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}

              {currentSopStep === 5 && (
                <>
                  <Button
                    size="sm"
                    onClick={() => setIsQcModalOpen(true)}
                    className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>開啟品管檢查核對 (QC)</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentSopStep(6)}
                    className="h-9 px-3 rounded-xl border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold gap-1 shadow-xs"
                  >
                    <span>確認無誤，前往一鍵入庫</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}

              {currentSopStep === 6 && (
                <>
                  <Button
                    size="sm"
                    onClick={handleSaveAllToDatabase}
                    disabled={isSavingToDb || cards.length === 0}
                    className="h-9 px-5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-md gap-1.5"
                  >
                    {isSavingToDb ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-emerald-300" />}
                    <span>確認無誤，執行一鍵匯入！</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadZip}
                    disabled={cards.length === 0 || !frontImageSrc}
                    className="h-9 px-3.5 rounded-xl font-bold text-xs border-slate-300 bg-white hover:bg-slate-100 text-slate-700 gap-1.5 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>下載 ZIP 備份檔</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🚀 上方工作區塊：【正面編輯區 (Front Side)】                              */}
      {/* ========================================================================= */}
      <Card className="border-slate-200/90 shadow-xs bg-white rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-4 px-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
                1
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>正面編輯工作台</span>
                  <Badge variant="outline" className="text-[10px] font-bold text-amber-700 border-amber-300 bg-amber-50 rounded-full">
                    主資訊來源
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  上傳正面掃描大圖，支援拖曳調整邊界、旋轉校正與 AI 辨識完整品名。
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 font-mono bg-white px-3 py-1.5 rounded-full border border-slate-200 tabular-nums">
                {frontBoxes.length} 個裁切框 · <span className="text-amber-600">{cards.filter(c => Boolean(c.frontPreview)).length}</span> 張就緒
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-6">
          {!frontImageSrc ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 左欄：正面掃描圖上傳 */}
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingFront(true);
                }}
                onDragLeave={() => setIsDraggingFront(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingFront(false);
                  const droppedFile = e.dataTransfer.files?.[0];
                  if (droppedFile) processFrontFile(droppedFile);
                }}
                className={cn(
                  "flex flex-col items-center justify-center py-11 px-5 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 group",
                  isDraggingFront
                    ? "bg-amber-50 border-amber-400 ring-4 ring-amber-200/60 scale-[1.005]"
                    : "bg-slate-50/70 border-slate-300 hover:border-amber-400 hover:bg-amber-50/30"
                )}
              >
                <div className="flex flex-col items-center text-center space-y-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center group-hover:scale-105 group-hover:border-amber-300 transition-all shadow-sm">
                    <UploadCloud className="w-7 h-7 text-amber-500" />
                  </div>
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5">
                      <Badge className="bg-amber-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full">必填</Badge>
                      <p className="text-base font-black text-slate-900">
                        {isDraggingFront ? '放開滑鼠立即上傳正面' : '步驟 1A：上傳卡片【正面】'}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">
                      支援單卡近拍、2×3、3×3 合拍與 PSA / BGS 鑑定殼
                    </p>
                  </div>
                  <div className="pt-1">
                    <span className="inline-flex items-center gap-2 h-9 px-5 rounded-xl bg-amber-500 group-hover:bg-amber-600 text-white font-black text-xs shadow-sm transition-all">
                      <UploadCloud className="w-4 h-4" />
                      選擇正面圖片檔案
                    </span>
                  </div>
                </div>
                <Input type="file" accept="image/*" onChange={handleFrontImageUpload} className="hidden" />
              </label>

              {/* 右欄：背面掃描圖上傳（先上傳正反面，辨識與查價資訊更齊全） */}
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingBack(true);
                }}
                onDragLeave={() => setIsDraggingBack(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingBack(false);
                  const droppedFile = e.dataTransfer.files?.[0];
                  if (droppedFile) processBackFile(droppedFile);
                }}
                className={cn(
                  "flex flex-col items-center justify-center py-11 px-5 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 group",
                  backImageSrc
                    ? "bg-emerald-50/50 border-emerald-400"
                    : isDraggingBack
                    ? "bg-indigo-50 border-indigo-400 ring-4 ring-indigo-200/60 scale-[1.005]"
                    : "bg-indigo-50/25 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50"
                )}
              >
                <div className="flex flex-col items-center text-center space-y-3.5">
                  {backImageSrc ? (
                    <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-sm bg-slate-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={backImageSrc} alt="Back Preview" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-white border border-indigo-200 flex items-center justify-center group-hover:scale-105 group-hover:border-indigo-400 transition-all shadow-sm">
                      <UploadCloud className="w-7 h-7 text-indigo-500" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5">
                      <Badge className={cn("font-black text-[10px] px-2 py-0.5 rounded-full", backImageSrc ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white")}>
                        {backImageSrc ? '已就緒' : '強烈推薦'}
                      </Badge>
                      <p className="text-base font-black text-slate-900">
                        {backImageSrc ? '背面掃描圖已載入（點擊可更換）' : isDraggingBack ? '放開滑鼠立即上傳背面' : '步驟 1B：上傳卡片【背面】'}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">
                      先補齊背面卡號、限量編號與年份，AI 辨識與聯網查價更精準
                    </p>
                  </div>
                  <div className="pt-1">
                    <span className={cn(
                      "inline-flex items-center gap-2 h-9 px-5 rounded-xl font-black text-xs shadow-sm transition-all",
                      backImageSrc
                        ? "bg-emerald-600 group-hover:bg-emerald-700 text-white"
                        : "bg-indigo-600 group-hover:bg-indigo-700 text-white"
                    )}>
                      <UploadCloud className="w-4 h-4" />
                      {backImageSrc ? '更換背面圖片檔案' : '選擇背面圖片檔案'}
                    </span>
                  </div>
                </div>
                <Input type="file" accept="image/*" onChange={handleBackImageUpload} className="hidden" />
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* 正面大圖畫布可視區 (7 欄) */}
              <div className="lg:col-span-7 space-y-3">
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 p-2 flex items-center justify-center min-h-[360px] max-h-[550px]">
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={frontImgRef}
                      src={frontImageSrc}
                      alt="Front Source"
                      className="block max-w-full max-h-[520px] w-auto h-auto select-none pointer-events-none"
                      onLoad={refreshPreviews}
                    />

                    {/* 可拖曳與八向縮放裁切框疊加層（與圖片像素 1:1 貼合） */}
                    <InteractiveCropOverlay
                      boxes={frontBoxes}
                      selectedBoxId={selectedFrontBoxId}
                      onSelectBox={setSelectedFrontBoxId}
                      onChangeBoxes={setFrontBoxes}
                      onCommitBoxes={(committed, changedBoxId) => recropFrontPreviews(committed, true, changedBoxId)}
                      onDeleteBox={(id) => handleDeleteCropBox(true, id)}
                      hideBoxBadges={hideBoxBadges}
                      variant="front"
                    />
                  </div>
                </div>

                {/* 正面裁切微調與框體管理控制工具列 */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runAiDetection(true)}
                        disabled={isAiDetectingFront}
                        className="h-8 px-2.5 font-bold border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900"
                      >
                        {isAiDetectingFront ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-600" />}
                        AI 重新偵測
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddCropBox(true)}
                        className="h-8 px-2.5 font-bold bg-white"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        新增裁切框
                      </Button>
                      {activeFrontBox && frontBoxes.length > 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteCropBox(true, activeFrontBox.id)}
                          className="h-8 px-2.5 font-bold text-rose-600 border-rose-200 hover:bg-rose-50 bg-white"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          刪除框 #{frontBoxes.findIndex(b => b.id === selectedFrontBoxId) + 1}
                        </Button>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500">
                      可直接拖曳框體移動，或拉動四周圓點微調裁切邊界
                    </span>
                  </div>

                  {activeFrontBox && (
                    <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-600">
                          卡片 #{frontBoxes.findIndex(b => b.id === selectedFrontBoxId) + 1} 旋轉:
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRotate(true, -90)}
                          className="h-7 px-2 font-bold bg-white"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          -90°
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRotate(true, 90)}
                          className="h-7 px-2 font-bold bg-white"
                        >
                          <RotateCw className="w-3 h-3 mr-1" />
                          +90°
                        </Button>
                        {activeFrontBox.rotation !== 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const next = frontBoxes.map(b => b.id === selectedFrontBoxId ? { ...b, rotation: 0 } : b);
                              setFrontBoxes(next);
                              recropFrontPreviews(next, true, selectedFrontBoxId || undefined);
                            }}
                            className="h-7 px-2 text-[11px] text-slate-500 hover:text-slate-900"
                          >
                            歸零
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <span className="text-slate-500 text-[11px] font-mono">
                          微調角度 ({activeFrontBox.rotation}°):
                        </span>
                        <Slider
                          min={-45}
                          max={45}
                          step={1}
                          value={[Math.max(-45, Math.min(45, activeFrontBox.rotation))]}
                          onValueChange={([val]) => {
                            setFrontBoxes(prev => prev.map(b => b.id === selectedFrontBoxId ? { ...b, rotation: val } : b));
                          }}
                          onValueCommit={([val]) => {
                            const next = frontBoxes.map(b => b.id === selectedFrontBoxId ? { ...b, rotation: val } : b);
                            recropFrontPreviews(next, true, selectedFrontBoxId || undefined);
                          }}
                          className="w-32"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 正面資訊編輯清單 (5 欄) */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700">已辨識卡片列表 ({cards.length} 張)</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={refreshPreviews}
                    className="h-7 px-2 text-xs text-slate-500 hover:text-slate-800 gap-1"
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
                      className={`p-4 rounded-2xl border transition-all ${
                        card.frontCropBox.id === selectedFrontBoxId
                          ? 'border-amber-400 bg-amber-50/40 shadow-md ring-1 ring-amber-300/60'
                          : 'border-slate-200/90 bg-white hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        {/* 裁切縮圖與去標籤控制 */}
                        <div className="flex flex-col items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setZoomCardIdx(idx);
                              setZoomSide('front');
                              setZoomShowOriginal(false);
                            }}
                            className="w-20 h-28 rounded-xl bg-slate-900/5 border border-slate-200 overflow-hidden flex items-center justify-center relative group cursor-pointer hover:border-amber-400 hover:shadow-md transition-all text-left p-0.5"
                            title="點擊放大檢視卡片大圖與貼紙消除效果"
                          >
                            {card.frontPreview ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={card.frontPreview} alt="Front Crop" className="w-full h-full object-contain rounded-lg" />
                            ) : (
                              <Crop className="w-5 h-5 text-slate-400" />
                            )}
                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold">
                              <ZoomIn className="w-4 h-4 text-white drop-shadow mb-0.5" />
                              <span>點擊放大</span>
                            </div>
                          </button>
                        </div>

                        {/* 卡片屬性輸入 */}
                        <div className="flex-1 space-y-2.5 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-900 text-[#FDE68A] text-[10px] font-black font-mono tabular-nums">
                              #{card.index}
                            </span>
                            {/* 🌟 僅在「步驟 3：PRO 智慧辨識」時突顯單卡辨識按鈕 */}
                            {currentSopStep === 3 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  runSingleAiRecognize(idx);
                                }}
                                disabled={card.isAiRecognizing}
                                className="h-6 px-2.5 text-[10px] font-black bg-gradient-to-r from-[#FDE68A] to-amber-300 text-[#120d02] border-amber-300 hover:brightness-105 shadow-2xs rounded-full"
                              >
                                {card.isAiRecognizing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
                                PRO 辨識
                              </Button>
                            )}
                          </div>

                          {/* 雙行完整品名輸入框，避免長系列名稱被截斷 */}
                          <textarea
                            rows={2}
                            placeholder="球員 / 完整系列品名"
                            value={card.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCards(prev => prev.map((c, i) => i === idx ? { ...c, name: val } : c));
                            }}
                            className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900 leading-snug resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all"
                          />

                          {/* 🌟 PSA / BGS 評級標籤文字專區 */}
                          <div className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-black text-slate-700 flex items-center gap-1">
                                <Tag className="w-3 h-3 text-amber-600" />
                                評級標籤文字 (PSA/BGS OCR)
                              </span>
                              {/* 僅在步驟 3 或已擷取標籤時顯示輔助操作按鈕 */}
                              {(currentSopStep === 3 || Boolean(card.slabLabelText)) && (
                                <div className="flex items-center gap-1">
                                  {currentSopStep === 3 && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        runSingleSlabOcr(idx);
                                      }}
                                      disabled={card.isOcrRunning}
                                      className="h-5 px-1.5 text-[9px] font-bold text-indigo-700 hover:bg-indigo-100/70"
                                      title="抓取 PSA/BGS 標籤文字"
                                    >
                                      {card.isOcrRunning ? <Loader2 className="w-2.5 h-2.5 animate-spin mr-0.5" /> : <FileText className="w-2.5 h-2.5 mr-0.5" />}
                                      抓取
                                    </Button>
                                  )}
                                  {card.slabLabelText && (
                                    <>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          applySlabTextToTitle(idx);
                                        }}
                                        className="h-5 px-1.5 text-[9px] font-bold text-amber-800 hover:bg-amber-100/70"
                                        title="套用標籤為上方卡片品名"
                                      >
                                        <Zap className="w-2.5 h-2.5 mr-0.5 text-amber-600" />
                                        套用
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copySlabText(idx);
                                        }}
                                        className="h-5 px-1.5 text-[9px] font-bold text-slate-600 hover:bg-slate-200"
                                        title="複製標籤文字"
                                      >
                                        <Copy className="w-2.5 h-2.5" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>

                            <Input
                              placeholder="PSA/BGS 標籤文字 (由步驟 3 PRO 智慧辨識自動帶入)"
                              value={card.slabLabelText || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCards(prev => prev.map((c, i) => i === idx ? { ...c, slabLabelText: val } : c));
                              }}
                              className="h-6 text-[10px] font-mono bg-white border-indigo-200/80 text-indigo-950 placeholder:text-slate-400"
                            />

                            {(card.certNumber || card.subgrades) && (
                              <div className="flex items-center justify-between text-[9px] text-indigo-800 font-mono pt-0.5">
                                {card.certNumber && <span>證號: <span className="font-bold">{card.certNumber}</span></span>}
                                {card.subgrades && <span className="truncate max-w-[140px] text-slate-500">{card.subgrades}</span>}
                              </div>
                            )}
                          </div>

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

                          {/* 評級等級與一鍵快捷標籤（取代原冗餘入庫專區選單） */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <Input
                                placeholder="評級 (如 PSA 10, RAW)"
                                value={card.grade || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCards(prev => prev.map((c, i) => i === idx ? { ...c, grade: val } : c));
                                }}
                                className="h-7 text-[11px] font-bold text-slate-900 bg-white"
                              />
                              <div className="flex items-center gap-1 shrink-0">
                                {['PSA 10', 'PSA 9', 'BGS 9.5', 'RAW'].map(quickGrade => (
                                  <button
                                    key={quickGrade}
                                    type="button"
                                    onClick={() => {
                                      setCards(prev => prev.map((c, i) => i === idx ? { ...c, grade: quickGrade } : c));
                                    }}
                                    className={cn(
                                      "px-1.5 py-0.5 rounded text-[9px] font-black transition-all cursor-pointer border",
                                      card.grade === quickGrade
                                        ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                                    )}
                                  >
                                    {quickGrade}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* 🌟 市場卡價參考行情（隨時可單張 AI 聯網查價，並顯示行情依據） */}
                          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-lg px-2.5 py-1.5 text-emerald-950 space-y-1">
                            <div className="flex items-center justify-between gap-2 text-[10px]">
                              <div className="flex items-center gap-1 overflow-hidden">
                                <DollarSign className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span className="font-bold shrink-0">市場行情:</span>
                                <span className="font-mono text-emerald-800 font-bold truncate tabular-nums">
                                  {card.priceRange || '尚未查詢行情'}
                                </span>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  runSinglePriceCheck(idx);
                                }}
                                disabled={card.isPriceChecking}
                                className="h-5 px-2 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100/80 shrink-0 rounded-md"
                                title="依品名與評級即時聯網查詢市場行情"
                              >
                                {card.isPriceChecking ? <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" /> : <Search className="w-2.5 h-2.5 mr-1" />}
                                {card.isPriceChecking ? '查詢中...' : 'AI 查價'}
                              </Button>
                            </div>
                            {card.priceRationale && (
                              <p className="text-[10px] text-emerald-900/80 leading-relaxed line-clamp-2">
                                {card.priceRationale}
                              </p>
                            )}
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

            {/* 簡約純淨標題列，不放干擾功能選項，引導助理專注當前 SOP 步驟 */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-cyan-800 font-mono bg-cyan-50 px-3 py-1.5 rounded-xl border border-cyan-200">
                {backImageSrc ? `背面已對齊 ${backBoxes.length} 張卡片` : '單面卡模式 (可免填背面)'}
              </span>
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
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={backImgRef}
                      src={backImageSrc}
                      alt="Back Source"
                      className="block max-w-full max-h-[520px] w-auto h-auto select-none pointer-events-none"
                      onLoad={refreshPreviews}
                    />

                    {/* 可拖曳與八向縮放裁切框疊加層（與圖片像素 1:1 貼合） */}
                    <InteractiveCropOverlay
                      boxes={backBoxes}
                      selectedBoxId={selectedBackBoxId}
                      onSelectBox={setSelectedBackBoxId}
                      onChangeBoxes={setBackBoxes}
                      onCommitBoxes={(committed) => recropBackPreviews(committed)}
                      onDeleteBox={(id) => handleDeleteCropBox(false, id)}
                      hideBoxBadges={hideBoxBadges}
                      variant="back"
                      badgeSuffix=" (背面)"
                    />
                  </div>
                </div>

                {/* 背面裁切微調與旋轉控制列 */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runAiDetection(false)}
                        disabled={isAiDetectingBack}
                        className="h-8 px-2.5 font-bold border-cyan-300 bg-cyan-50 hover:bg-cyan-100 text-cyan-900"
                      >
                        {isAiDetectingBack ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1 text-cyan-600" />}
                        AI 偵測背面
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddCropBox(false)}
                        className="h-8 px-2.5 font-bold bg-white"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        新增背面框
                      </Button>
                      {activeBackBox && backBoxes.length > 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteCropBox(false, activeBackBox.id)}
                          className="h-8 px-2.5 font-bold text-rose-600 border-rose-200 hover:bg-rose-50 bg-white"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          刪除框 #{backBoxes.findIndex(b => b.id === selectedBackBoxId) + 1}
                        </Button>
                      )}
                    </div>
                  </div>

                  {activeBackBox && (
                    <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-600">
                          背面卡片 #{backBoxes.findIndex(b => b.id === selectedBackBoxId) + 1} 旋轉:
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRotate(false, -90)}
                          className="h-7 px-2 font-bold bg-white"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          -90°
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRotate(false, 90)}
                          className="h-7 px-2 font-bold bg-white"
                        >
                          <RotateCw className="w-3 h-3 mr-1" />
                          +90°
                        </Button>
                        {activeBackBox.rotation !== 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const next = backBoxes.map(b => b.id === selectedBackBoxId ? { ...b, rotation: 0 } : b);
                              setBackBoxes(next);
                              recropBackPreviews(next);
                            }}
                            className="h-7 px-2 text-[11px] text-slate-500 hover:text-slate-900"
                          >
                            歸零
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <span className="text-slate-500 text-[11px] font-mono">
                          角度 ({activeBackBox.rotation}°):
                        </span>
                        <Slider
                          min={-45}
                          max={45}
                          step={1}
                          value={[Math.max(-45, Math.min(45, activeBackBox.rotation))]}
                          onValueChange={([val]) => {
                            setBackBoxes(prev => prev.map(b => b.id === selectedBackBoxId ? { ...b, rotation: val } : b));
                          }}
                          onValueCommit={([val]) => {
                            const next = backBoxes.map(b => b.id === selectedBackBoxId ? { ...b, rotation: val } : b);
                            recropBackPreviews(next);
                          }}
                          className="w-32"
                        />
                      </div>
                    </div>
                  )}
                </div>
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

      {/* 🎯 貼紙清除與微調工作台彈窗 */}
      <Dialog open={eraserCardIdx !== null} onOpenChange={(open) => !open && setEraserCardIdx(null)}>
        <DialogContent className="max-w-3xl bg-slate-900 text-white border-slate-800 p-6 overflow-hidden rounded-2xl shadow-2xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center gap-2 text-lg font-black text-rose-400">
              <Eraser className="w-5 h-5 text-rose-400" />
              左上角空白標籤貼紙消除工作台 - 卡片 #{eraserCardIdx !== null ? eraserCardIdx + 1 : ''}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              專門消除黏貼在外殼、卡膜或評級卡左上角的空白白色貼紙（如第 4、6 張卡）。演算法將無痕混合四週材質與顏色。
            </DialogDescription>
          </DialogHeader>

          {eraserBaseImage && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 my-2">
              {/* 左側：卡片畫布與點擊捕捉區 */}
              <div className="md:col-span-7 flex flex-col items-center">
                <div 
                  onClick={handleEraserImageClick}
                  className="relative max-h-[460px] w-auto aspect-[2.5/3.5] bg-slate-950 border border-slate-700/80 rounded-xl overflow-hidden cursor-crosshair shadow-lg group select-none flex items-center justify-center"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={showCleanPreview && eraserCleanPreviewUrl ? eraserCleanPreviewUrl : eraserBaseImage} 
                    alt="Card Inpaint" 
                    className="w-full h-full object-contain pointer-events-none"
                  />

                  {/* 貼紙消除選取框 (僅在非預覽模式下顯示) */}
                  {!showCleanPreview && eraserImageDims.width > 0 && (
                    <div 
                      className="absolute border-2 border-rose-500 bg-rose-500/25 pointer-events-none rounded-xs transition-all shadow-[0_0_12px_rgba(244,63,94,0.6)]"
                      style={{
                        left: `${(eraserBox.x / eraserImageDims.width) * 100}%`,
                        top: `${(eraserBox.y / eraserImageDims.height) * 100}%`,
                        width: `${(eraserBox.width / eraserImageDims.width) * 100}%`,
                        height: `${(eraserBox.height / eraserImageDims.height) * 100}%`,
                      }}
                    >
                      <span className="absolute -top-5 left-0 px-1 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black whitespace-nowrap shadow-xs">
                        貼紙範圍 ({eraserBox.width}×{eraserBox.height}px)
                      </span>
                    </div>
                  )}

                  {/* 懸浮提示 */}
                  <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1.5 rounded-lg bg-black/75 backdrop-blur-xs text-[10px] text-slate-300 pointer-events-none text-center">
                    💡 提示：點擊卡片上貼紙的任何位置即可自動捕捉貼紙！
                  </div>
                </div>
              </div>

              {/* 右側：選取範圍微調與控制面板 */}
              <div className="md:col-span-5 flex flex-col justify-between space-y-4 text-xs">
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-3">
                    <span className="font-bold text-slate-200 block text-xs">🎯 貼紙位置與尺寸微調</span>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>水平位置 (X):</span>
                        <span className="font-mono text-rose-400">{eraserBox.x} px</span>
                      </div>
                      <Slider
                        min={0}
                        max={Math.max(50, Math.round(eraserImageDims.width * 0.4))}
                        step={1}
                        value={[eraserBox.x]}
                        onValueChange={([val]) => {
                          setEraserBox(prev => ({ ...prev, x: val }));
                          setShowCleanPreview(false);
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>垂直位置 (Y):</span>
                        <span className="font-mono text-rose-400">{eraserBox.y} px</span>
                      </div>
                      <Slider
                        min={0}
                        max={Math.max(50, Math.round(eraserImageDims.height * 0.25))}
                        step={1}
                        value={[eraserBox.y]}
                        onValueChange={([val]) => {
                          setEraserBox(prev => ({ ...prev, y: val }));
                          setShowCleanPreview(false);
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>貼紙寬度 (W):</span>
                        <span className="font-mono text-rose-400">{eraserBox.width} px</span>
                      </div>
                      <Slider
                        min={10}
                        max={Math.max(60, Math.round(eraserImageDims.width * 0.45))}
                        step={1}
                        value={[eraserBox.width]}
                        onValueChange={([val]) => {
                          setEraserBox(prev => ({ ...prev, width: val }));
                          setShowCleanPreview(false);
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>貼紙高度 (H):</span>
                        <span className="font-mono text-rose-400">{eraserBox.height} px</span>
                      </div>
                      <Slider
                        min={6}
                        max={Math.max(30, Math.round(eraserImageDims.height * 0.15))}
                        step={1}
                        value={[eraserBox.height]}
                        onValueChange={([val]) => {
                          setEraserBox(prev => ({ ...prev, height: val }));
                          setShowCleanPreview(false);
                        }}
                      />
                    </div>
                  </div>

                  {/* 預覽與重新鎖定 */}
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleEraserPreview(!showCleanPreview)}
                      disabled={isEraserProcessing}
                      className={`h-9 w-full font-bold border transition-all ${
                        showCleanPreview 
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500 hover:bg-rose-500/30' 
                          : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {isEraserProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                      ) : showCleanPreview ? (
                        <EyeOff className="w-4 h-4 mr-1.5 text-rose-400" />
                      ) : (
                        <Eye className="w-4 h-4 mr-1.5 text-emerald-400" />
                      )}
                      <span>{showCleanPreview ? '返回選取範圍模式' : '👁️ 即時預覽消除後效果'}</span>
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (!eraserBaseImage) return;
                        const detected = await detectWhiteStickerBox(eraserBaseImage);
                        if (detected && detected.found) {
                          setEraserBox({ x: detected.x, y: detected.y, width: detected.width, height: detected.height });
                          setShowCleanPreview(false);
                          toast({ title: '已重新自動鎖定貼紙邊界' });
                        } else {
                          toast({ title: '未自動鎖定，請點選圖片上的貼紙' });
                        }
                      }}
                      className="h-8 text-xs text-slate-400 hover:text-white"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-400" />
                      重新自動偵測貼紙
                    </Button>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-800/40 text-[11px] text-slate-400 border border-slate-800 space-y-1">
                  <p className="font-bold text-slate-300">適用情境：</p>
                  <p>• 第 4 張黑框外殼左上貼紙：自動融合為黑框質感。</p>
                  <p>• 第 6 張 Beckett 鑑定殼左上貼紙：四邊平滑混色還原銀面。</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between gap-3 border-t border-slate-800 pt-4 mt-2">
            <div>
              {eraserCardIdx !== null && cards[eraserCardIdx]?.hasRemovedSticker && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestoreOriginalCard(eraserCardIdx)}
                  className="h-9 text-xs font-bold border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                >
                  <Undo2 className="w-3.5 h-3.5 mr-1" />
                  復原原圖 (保留貼紙)
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEraserCardIdx(null)}
                className="h-9 text-xs text-slate-400 hover:text-white"
              >
                取消
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleApplyEraserClean}
                disabled={isEraserProcessing}
                className="h-9 px-4 text-xs font-black bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl shadow-md gap-1.5"
              >
                {isEraserProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                確認消除並套用
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 🌟 步驟 7 專用：【入庫前再次詢問檢查與品質防呆確認對話框 (QC Modal)】       */}
      {/* ========================================================================= */}
      <Dialog open={isQcModalOpen} onOpenChange={setIsQcModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white text-slate-900 border-slate-200 p-6">
          <DialogHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-black">
                SOP 步驟 7
              </Badge>
              <span className="text-xs text-slate-500 font-mono">QUALITY CHECKLIST</span>
            </div>
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span>入庫前再次詢問品管檢查 (Quality Check)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              請助理逐項核對即將匯入卡片庫的卡片資訊，確認品名、售價、評級等級與貼紙清除狀態無誤。
            </DialogDescription>
          </DialogHeader>

          {/* 品質指標摘要儀表板 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-[10px] text-slate-500 font-bold block mb-1">總待入庫卡數</span>
              <span className="text-2xl font-black text-slate-900 font-mono">{cards.length}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">張收藏卡</span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
              <span className="text-[10px] text-emerald-700 font-bold block mb-1">正面裁切狀態</span>
              <span className="text-2xl font-black text-emerald-800 font-mono">
                {cards.filter(c => Boolean(c.frontPreview)).length} / {cards.length}
              </span>
              <span className="text-[10px] text-emerald-600 block mt-0.5">全部已就緒</span>
            </div>

            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-center">
              <span className="text-[10px] text-indigo-700 font-bold block mb-1">背面圖片狀態</span>
              <span className="text-xl font-black text-indigo-900 font-mono">
                {backImageSrc ? `${cards.filter(c => Boolean(c.backPreview)).length} 張已對齊` : '單面卡模式'}
              </span>
              <span className="text-[10px] text-indigo-600 block mt-0.5">
                {backImageSrc ? '正反面已聯動' : '無背面照片'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-center">
              <span className="text-[10px] text-rose-700 font-bold block mb-1">空白貼紙消除</span>
              <span className="text-2xl font-black text-rose-800 font-mono">
                {cards.filter(c => c.hasRemovedSticker).length}
              </span>
              <span className="text-[10px] text-rose-600 block mt-0.5">張已無痕修復</span>
            </div>
          </div>

          {/* 警告提醒區塊（若有卡片價格異常或未命名前端警告） */}
          {cards.some(c => c.sellPrice <= 0 || c.name.startsWith('卡片 #')) && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-black">助理核對提醒：</p>
                <p className="text-amber-800/90 text-[11px] mt-0.5">
                  部分卡片品名為預設編號或售價未變更，請確認是否已點擊「步驟 3：PRO 智慧辨識」與「步驟 6：查詢卡價」。
                </p>
              </div>
            </div>
          )}

          {/* 卡片清單總核對表格 */}
          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[340px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-800 sticky top-0 z-10 font-black text-xs border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">卡片外觀 (正/反縮圖)</th>
                  <th className="py-2.5 px-3">球員 / 卡片品名</th>
                  <th className="py-2.5 px-3">評級等級</th>
                  <th className="py-2.5 px-3">分類</th>
                  <th className="py-2.5 px-3">建議售價 / 行情</th>
                  <th className="py-2.5 px-3">貼紙修復檢視</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {cards.map((card, i) => (
                  <tr key={`qc-${card.id}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-3 font-mono font-bold text-amber-600 text-xs">#{i + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        {/* 正面縮圖（點擊放大） */}
                        <button
                          type="button"
                          onClick={() => {
                            setZoomCardIdx(i);
                            setZoomSide('front');
                            setZoomShowOriginal(false);
                          }}
                          className="w-14 h-20 rounded-lg bg-slate-100 border-2 border-slate-300 overflow-hidden shrink-0 relative group cursor-pointer hover:border-amber-500 hover:shadow-md transition-all shadow-2xs"
                          title="點擊放大檢視正面與貼紙消除效果"
                        >
                          {card.frontPreview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={card.frontPreview} alt="Front" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-slate-400">正</span>
                          )}
                          <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-black">
                            <ZoomIn className="w-4 h-4 text-white drop-shadow mb-0.5" />
                            <span>放大</span>
                          </div>
                          {card.hasRemovedSticker && (
                            <div className="absolute top-0.5 left-0.5 bg-emerald-600 text-white rounded px-1 text-[8px] font-black shadow">
                              無痕
                            </div>
                          )}
                        </button>

                        {/* 背面縮圖（點擊放大） */}
                        {card.backPreview && (
                          <button
                            type="button"
                            onClick={() => {
                              setZoomCardIdx(i);
                              setZoomSide('back');
                              setZoomShowOriginal(false);
                            }}
                            className="w-14 h-20 rounded-lg bg-cyan-950/20 border-2 border-cyan-400/50 overflow-hidden shrink-0 relative group cursor-pointer hover:border-cyan-500 hover:shadow-md transition-all shadow-2xs"
                            title="點擊放大檢視背面"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={card.backPreview} alt="Back" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-black">
                              <ZoomIn className="w-4 h-4 text-white drop-shadow mb-0.5" />
                              <span>放大</span>
                            </div>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 max-w-[240px]">
                      <span className="font-black text-slate-900 block text-xs truncate" title={card.name}>
                        {card.name}
                      </span>
                      {card.slabLabelText && (
                        <span className="text-[10px] text-slate-500 block truncate font-mono mt-0.5" title={card.slabLabelText}>
                          {card.slabLabelText}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {/* 🌟 紅圈 1 修復：超清晰高對比深色評級文字標籤，100% 清晰可見 */}
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-1 rounded-md font-mono text-xs font-black shadow-2xs tracking-tight border",
                        card.grade?.includes('10')
                          ? "bg-amber-400 text-slate-950 border-amber-500 font-black shadow-amber-400/20"
                          : card.grade?.includes('9.5') || card.grade?.includes('9')
                          ? "bg-emerald-600 text-white border-emerald-700 font-black"
                          : card.grade?.startsWith('PSA') || card.grade?.startsWith('BGS')
                          ? "bg-slate-900 text-white border-slate-800 font-black"
                          : "bg-slate-200 text-slate-900 border-slate-300 font-bold"
                      )}>
                        {card.grade || 'RAW'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-800 font-bold text-xs">{card.category}</td>
                    <td className="py-2 px-3">
                      <span className="font-black font-mono text-emerald-700 text-sm block">
                        {card.sellPrice?.toLocaleString() || 100} P
                      </span>
                      {card.priceRange && (
                        <span className="text-[10px] text-slate-500 block font-mono font-medium mt-0.5">
                          {card.priceRange}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {card.hasRemovedSticker ? (
                        <button
                          type="button"
                          onClick={() => {
                            setZoomCardIdx(i);
                            setZoomSide('front');
                            setZoomShowOriginal(false);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black shadow-xs cursor-pointer transition-colors"
                          title="點擊放大對比消除貼紙效果"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-200" />
                          <span>已去貼紙 (點擊放大)</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">原貌乾淨</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 pt-4 mt-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <CheckSquare className="w-4 h-4 text-emerald-600" />
              <span>所有欄位確認無誤後，請點選右側「執行第 8 步一鍵入庫」</span>
            </div>

            <div className="flex items-center gap-2">
              {/* 🌟 紅圈 2 修復：高對比清晰白底深灰字按鈕，絕不變黑磚 */}
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsQcModalOpen(false)}
                className="h-10 px-6 rounded-xl text-xs font-black bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-300 hover:border-slate-400 shadow-xs cursor-pointer"
              >
                返回修改
              </Button>

              <Button
                type="button"
                onClick={() => {
                  setIsQcModalOpen(false);
                  setCurrentSopStep(6);
                  handleSaveAllToDatabase();
                }}
                disabled={isSavingToDb || cards.length === 0}
                className="h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md gap-2 border border-emerald-500 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSavingToDb ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <CheckCircle2 className="w-4 h-4 text-emerald-200" />}
                <span>確認無誤，執行一鍵入庫！</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 🌟 卡片高清放大檢視器與貼紙消除前後對比視窗 (Card Zoom & Inspection Modal) */}
      {/* ========================================================================= */}
      <Dialog open={zoomCardIdx !== null} onOpenChange={(open) => { if (!open) setZoomCardIdx(null); }}>
        <DialogContent className="max-w-2xl bg-white text-slate-900 border-slate-200 p-5 overflow-hidden">
          {zoomCardIdx !== null && cards[zoomCardIdx] && (() => {
            const zCard = cards[zoomCardIdx];
            const hasStickerRemoved = Boolean(zCard.hasRemovedSticker);
            const currentImg = zoomSide === 'back' 
              ? zCard.backPreview 
              : (zoomShowOriginal && zCard.originalFrontPreview ? zCard.originalFrontPreview : zCard.frontPreview);

            return (
              <div className="space-y-4">
                <DialogHeader className="border-b border-slate-100 pb-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs">
                        #{zCard.index}
                      </span>
                      <DialogTitle className="text-base font-black text-slate-900 truncate max-w-[340px]">
                        {zCard.name}
                      </DialogTitle>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* 正面 / 背面 切換 */}
                      {zCard.backPreview && (
                        <div className="flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
                          <button
                            type="button"
                            onClick={() => setZoomSide('front')}
                            className={`px-2.5 py-1 rounded-md font-bold transition-all ${zoomSide === 'front' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
                          >
                            正面
                          </button>
                          <button
                            type="button"
                            onClick={() => setZoomSide('back')}
                            className={`px-2.5 py-1 rounded-md font-bold transition-all ${zoomSide === 'back' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
                          >
                            背面
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 貼紙消除前後對比按鈕 (若該卡片有消除貼紙) */}
                  {zoomSide === 'front' && hasStickerRemoved && zCard.originalFrontPreview && (
                    <div className="flex items-center justify-between bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 mt-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <span className="font-black text-emerald-950 block">左上角貼紙消除檢視</span>
                          <span className="text-[10px] text-emerald-700">可切換檢視「消除後無痕圖」與「原始含貼紙圖」進行比對</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-emerald-200 text-xs shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setZoomShowOriginal(false)}
                          className={`px-2.5 py-1 rounded-md font-black text-[11px] transition-all ${!zoomShowOriginal ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                          ✨ 消除後 (無痕修復)
                        </button>
                        <button
                          type="button"
                          onClick={() => setZoomShowOriginal(true)}
                          className={`px-2.5 py-1 rounded-md font-black text-[11px] transition-all ${zoomShowOriginal ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                          📷 消除前 (原始貼紙)
                        </button>
                      </div>
                    </div>
                  )}
                </DialogHeader>

                {/* 大圖展示畫布 */}
                <div className="relative bg-slate-950 rounded-2xl p-3 flex items-center justify-center min-h-[380px] max-h-[540px] overflow-hidden border border-slate-800">
                  {currentImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentImg}
                      alt="Zoomed Card"
                      className="max-h-[500px] w-auto object-contain rounded-lg shadow-2xl select-none"
                    />
                  ) : (
                    <span className="text-slate-400 text-xs">無預覽圖片</span>
                  )}

                  {/* 貼紙消除區域提示標籤 */}
                  {zoomSide === 'front' && hasStickerRemoved && !zoomShowOriginal && (
                    <div className="absolute top-5 left-5 px-2.5 py-1 rounded-lg bg-emerald-600/90 text-white text-[11px] font-black shadow-lg backdrop-blur-xs flex items-center gap-1.5 border border-emerald-400/40">
                      <Check className="w-3.5 h-3.5" />
                      <span>左上角貼紙已無痕羽化修復</span>
                    </div>
                  )}
                  {zoomSide === 'front' && hasStickerRemoved && zoomShowOriginal && (
                    <div className="absolute top-5 left-5 px-2.5 py-1 rounded-lg bg-rose-600/90 text-white text-[11px] font-black shadow-lg backdrop-blur-xs flex items-center gap-1.5 border border-rose-400/40">
                      <Eraser className="w-3.5 h-3.5" />
                      <span>顯示原始含空白貼紙狀態</span>
                    </div>
                  )}
                </div>

                {/* 底部資訊與微調按鈕 */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                      {zCard.grade || 'RAW'}
                    </span>
                    <span className="font-bold text-emerald-700 font-mono">
                      {zCard.sellPrice} P
                    </span>
                    {zCard.certNumber && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        證號: {zCard.certNumber}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const targetIdx = zoomCardIdx;
                        setZoomCardIdx(null);
                        openStickerEraser(targetIdx);
                      }}
                      className="h-8 px-3 rounded-xl border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 text-xs font-bold gap-1 shadow-2xs"
                    >
                      <Crosshair className="w-3.5 h-3.5 text-indigo-600" />
                      <span>手動微調貼紙消除範圍</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setZoomCardIdx(null)}
                      className="h-8 px-4 rounded-xl text-xs font-bold border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                    >
                      關閉放大檢視
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

    </div>
  );
}
