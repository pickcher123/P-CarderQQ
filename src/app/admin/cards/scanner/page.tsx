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
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import { 
  CropBox, 
  ScannedCardItem, 
  cropImageFromSource, 
  generateGridBoxes, 
  downloadCardsZip,
  compressImageForDetection,
  detectCardBoundariesLocally,
  removeTopLeftLabelFromImage,
  detectWhiteStickerBox,
  detectStickerAtPoint,
  safeLoadImage
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

  // 處理正面圖片上傳
  const handleFrontImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setFrontImageSrc(url);
    // 預設一個標準標準框
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
      name: file.name.replace(/\.[^/.]+$/, '').replace(/_front/i, ''),
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

    // 順利上傳正面後，自動前進至 SOP 步驟 2 (AI 偵測邊框)
    setCurrentSopStep(2);

    toast({
      title: '已載入正面掃描圖',
      description: 'SOP 步驟 1 完成！請點選「AI 偵測邊框」自動精準分割卡片。',
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

    // 上傳背面後，前進至步驟 6 (查詢卡價)
    setCurrentSopStep(6);

    toast({
      title: '已載入背面掃描圖',
      description: 'SOP 步驟 5 完成！背面已自動對齊正面卡片。',
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

    const updated = [...cards];
    for (let i = 0; i < updated.length; i++) {
      // 裁切正面 (若卡片已去除貼紙且具備修復圖，則予以保留，避免被大圖覆蓋還原)
      if (frontImgRef.current && updated[i].frontCropBox) {
        if (!updated[i].hasRemovedSticker || !updated[i].frontPreview) {
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

  // 🌟 AI 自動偵測邊界框 (精準修復卡片 #1 抓到全圖的問題)
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
            detectedBoxes = data.boxes
              .map((b: any) => ({
                id: uuidv4(),
                x: Math.round((b.xmin / 10) * 10) / 10,
                y: Math.round((b.ymin / 10) * 10) / 10,
                width: Math.max(10, Math.round(((b.xmax - b.xmin) / 10) * 10) / 10),
                height: Math.max(10, Math.round(((b.ymax - b.ymin) / 10) * 10) / 10),
                rotation: 0,
              }))
              // 🌟 嚴格過濾掉任何覆蓋整張大圖、掃描儀玻璃背景的外框（例如寬度>80且高度>80）
              .filter((b: CropBox) => {
                const isFullScreen = b.width > 80 && b.height > 80;
                const isTooLarge = (b.width * b.height) > 5500; // 面積大於 55%
                return !isFullScreen && !isTooLarge;
              });
          }
        }
      } catch (apiErr) {
        console.warn('Cloud AI detect failed, switching to local detector:', apiErr);
      }

      // 2. 若雲端未能回傳有效框，自動切換至純前端影像分析演算法備援
      if (detectedBoxes.length === 0) {
        detectedBoxes = detectCardBoundariesLocally(imgRef.current);
        // 本地過濾，若只回傳了一個覆蓋全圖的框，自動採用 2x3 網格
        if (detectedBoxes.length === 1 && (detectedBoxes[0].width > 75 && detectedBoxes[0].height > 75)) {
          detectedBoxes = generateGridBoxes(2, 3);
        }
        toast({
          title: '已啟用本地智慧邊緣對比偵測',
          description: `成功分析並定位 ${detectedBoxes.length} 個卡片區域。`,
        });
      } else {
        toast({
          title: `PRO AI 成功精準定位 ${detectedBoxes.length} 張卡片邊界`,
          description: '已過濾背景大圖，每張卡片皆已完整框選！',
        });
      }

      // 🌟 幾何精準排序：依照上下排（Y 差距大於 12% 視為不同排），然後由左至右（X）排序
      if (detectedBoxes.length > 1) {
        detectedBoxes.sort((a, b) => {
          if (Math.abs(a.y - b.y) > 12) {
            return a.y - b.y;
          }
          return a.x - b.x;
        });
      }

      if (isFront) {
        setFrontBoxes(detectedBoxes);
        setSelectedFrontBoxId(detectedBoxes[0]?.id || null);

        // 🌟 關鍵修復：立即針對所有 detectedBoxes 執行裁切生成全新的 cards 陣列！
        // 杜絕前次上傳時殘留的卡片 #1 全圖預覽，確保每張卡片在偵測當下立即展示真實裁切縮圖！
        if (imgRef.current) {
          const freshCards: ScannedCardItem[] = [];
          for (let i = 0; i < detectedBoxes.length; i++) {
            const box = detectedBoxes[i];
            let frontPreview = '';
            let frontBlob: Blob | undefined;
            try {
              const crop = await cropImageFromSource(imgRef.current, box);
              frontPreview = crop.dataUrl;
              frontBlob = crop.blob;
            } catch (err) {
              console.error('Crop preview generation error for box', i, err);
            }

            const existing = cards[i];
            freshCards.push({
              id: uuidv4(),
              index: i + 1,
              frontCropBox: box,
              frontPreview,
              frontBlob,
              name: (existing && !existing.name.startsWith('卡片 #')) ? existing.name : `卡片 #${i + 1}`,
              category: existing?.category || '籃球',
              sellPrice: existing?.sellPrice || 100,
              grade: existing?.grade || 'RAW',
              targetArea: existing?.targetArea || 'all',
              features: existing?.features || [],
              hasRemovedSticker: false,
            });
          }
          setCards(freshCards);
        }

        // SOP 流程前進至步驟 3 (PRO 智慧辨識全部)
        setCurrentSopStep(3);
      } else {
        setBackBoxes(detectedBoxes);
        setSelectedBackBoxId(detectedBoxes[0]?.id || null);
        // 上傳並辨識背面完成後前進至步驟 6 (查詢卡價)
        setCurrentSopStep(6);
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
        const newTitle = data.formattedTitle || data.name || c.name;
        return {
          ...c,
          isAiRecognizing: false,
          name: c.name.startsWith('卡片 #') && newTitle ? newTitle : (data.name || c.name),
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
        title: `卡片 #${index + 1} PRO 智慧辨識完成！`, 
        description: `${data.name} · ${data.grade}${data.slabLabelText ? ` · 已抓取標籤` : ''}` 
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
      const { dataUrl } = await cropImageFromSource(frontImgRef.current, card.frontCropBox);

      const res = await fetch('/api/admin/scan-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, mode: 'ocr_slab' }),
      });

      if (!res.ok) throw new Error('標籤辨識失敗');
      const data = await res.json();

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
          name: (c.name.startsWith('卡片 #') && newTitle) ? newTitle : c.name,
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

      toast({ title: '🎉 全部卡片 PRO 智慧辨識完畢！' });
      // 步驟 3 完成後，引導至步驟 4 (批次去除空白貼紙)
      setCurrentSopStep(4);
    } finally {
      setIsBatchAiRunning(false);
    }
  };

  // 🌟 SOP 步驟 6：查詢市場卡價行情 (比對 eBay / 130point / 台灣市場行情)
  const handleBatchPriceCheck = async () => {
    if (cards.length === 0) return;
    setIsBatchPriceChecking(true);

    try {
      toast({
        title: '正在查詢市場卡價行情...',
        description: `依據球員姓名、年份系列與評級等級，比對全體 ${cards.length} 張卡片的市場拍賣估價。`,
      });

      const payloadCards = cards.map(c => ({
        id: c.id,
        name: c.name,
        category: c.category,
        grade: c.grade || 'RAW',
        cardNumber: c.cardNumber || '',
        features: c.features || [],
        slabLabelText: c.slabLabelText || '',
        currentPrice: c.sellPrice,
      }));

      const res = await fetch('/api/admin/scan-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'price_estimate', cardList: payloadCards }),
      });

      if (!res.ok) throw new Error('市場行情查詢超時或伺服器錯誤');
      const data = await res.json();
      const estimates: Array<{ id: string; suggestedPrice: number; priceRange: string; rationale: string }> = data.estimates || [];

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

      // 步驟 6 完成後，前進至步驟 7 (再次詢問檢查) 並自動開啟 QC Modal
      setCurrentSopStep(7);
      setIsQcModalOpen(true);

      toast({
        title: '🎉 卡價行情查詢完畢！',
        description: '已成功估算全體卡片市場參考價值並更新建議售價，已為您開啟再次詢問品管檢查！',
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
            category: card.category,
            grade: card.grade || 'RAW',
            cardNumber: card.cardNumber || '',
            features: card.features || [],
            slabLabelText: card.slabLabelText || '',
            currentPrice: card.sellPrice,
          }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const est = data.estimates?.[0];
        if (est) {
          setCards(prev => prev.map((c, i) => i === index ? {
            ...c,
            sellPrice: est.suggestedPrice || c.sellPrice,
            priceRange: est.priceRange,
            priceRationale: est.rationale,
            isPriceChecking: false,
          } : c));
          toast({ title: `卡片 #${index + 1} 卡價行情已更新！`, description: `建議售價：${est.suggestedPrice} 點 (${est.priceRange})` });
          return;
        }
      }
    } catch (err: any) {
      console.warn('Single price check err:', err);
    }
    setCards(prev => prev.map((c, i) => i === index ? { ...c, isPriceChecking: false } : c));
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
      
      {/* 🌟 頂部 Header & 簡約整合 SOP 流程指揮台 */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
        {/* 頂部標題與核心輔助功能 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-slate-500 hover:text-slate-900">
                <Link href="/admin/cards">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  返回卡片庫
                </Link>
              </Button>
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-[10px] px-2">
                PRO 旗艦版
              </Badge>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <ScanLine className="w-6 h-6 text-amber-500" />
              <span>球員卡掃描自動分割工具</span>
            </h1>
          </div>

          {/* 右上角極簡狀態指示 (去除干擾按鈕，引導依循 SOP 步驟) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              SOP 引導模式 · 進行中
            </span>
          </div>
        </div>

        {/* 🌟 現代極簡 8 步 SOP 流程進度條 (點擊即可跳轉檢視) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              助理 SOP 標準作業程序 (步驟 {currentSopStep} / 8)
            </span>
            <span className="text-[11px] text-slate-400">依序完成下方 8 個步驟，完成後點擊下一步</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {[
              { num: 1, title: '1.上傳正面', shortDesc: '載入合拍照', isDone: Boolean(frontImageSrc) },
              { num: 2, title: '2.AI邊框', shortDesc: '自動精準分割', isDone: frontBoxes.length > 0 && Boolean(frontImageSrc) },
              { num: 3, title: '3.智慧辨識', shortDesc: 'PRO 全卡OCR', isDone: cards.some(c => c.name && !c.name.startsWith('卡片 #')) },
              { num: 4, title: '4.去貼紙', shortDesc: '左上無痕消除', isDone: cards.some(c => c.hasRemovedSticker) || currentSopStep > 4 },
              { num: 5, title: '5.上傳背面', shortDesc: '正反面鏡像對齊', isDone: Boolean(backImageSrc) || currentSopStep > 5 },
              { num: 6, title: '6.查詢卡價', shortDesc: '市場行情估價', isDone: cards.some(c => Boolean(c.priceRange)) || currentSopStep > 6 },
              { num: 7, title: '7.檢查QC', shortDesc: '入庫前品管防呆', isDone: currentSopStep > 7 },
              { num: 8, title: '8.一鍵入庫', shortDesc: '寫入卡片資料庫', isDone: isSavingToDb },
            ].map((item) => {
              const isCurrent = currentSopStep === item.num;
              return (
                <button
                  key={item.num}
                  type="button"
                  onClick={() => setCurrentSopStep(item.num)}
                  className={`text-left p-2.5 rounded-xl border transition-all flex flex-col justify-between ${
                    isCurrent
                      ? 'bg-amber-500/10 border-amber-500 shadow-xs ring-2 ring-amber-400/30'
                      : item.isDone
                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 hover:bg-emerald-100/70'
                      : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded ${
                      isCurrent
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
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
                  <span className={`text-xs font-black truncate w-full ${isCurrent ? 'text-amber-900' : item.isDone ? 'text-emerald-900' : 'text-slate-600'}`}>
                    {item.title}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate w-full block mt-0.5">
                    {item.shortDesc}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 🌟 當前步驟專屬聚焦指揮區 (清晰單一指令，不再混亂！) */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 via-orange-50/40 to-slate-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500 text-white font-black text-xs flex items-center justify-center shadow-xs">
                {currentSopStep}
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <span>
                    {currentSopStep === 1 && '步驟 1：請上傳正面照片（可多張合拍照或掃描圖）'}
                    {currentSopStep === 2 && '步驟 2：執行 AI 邊框偵測，自動切分所有卡片'}
                    {currentSopStep === 3 && '步驟 3：PRO 智慧辨識全部，自動抓取球員名、系列與 PSA/BGS 標籤'}
                    {currentSopStep === 4 && '步驟 4：批次消除左上角空白標籤貼紙 (無痕羽化修復，0 AI 點數消耗)'}
                    {currentSopStep === 5 && '步驟 5：上傳背面照片（自動鏡像對齊；若是單面卡可直接跳過）'}
                    {currentSopStep === 6 && '步驟 6：查詢市場參考卡價 (比對 eBay / 130point / 台灣市場行情)'}
                    {currentSopStep === 7 && '步驟 7：入庫前品管防呆核對 (確認品名、售價、評級與去貼紙效果)'}
                    {currentSopStep === 8 && '步驟 8：確認無誤，一鍵匯入卡片庫！'}
                  </span>
                </p>
                <p className="text-[11px] text-slate-500">
                  {currentSopStep === 1 && '支援 JPG / PNG / WebP 格式，整版掃描圖可一次切分多張。'}
                  {currentSopStep === 2 && '已修復背景誤判問題，每張卡片皆會精準裁切，不抓整張原圖。'}
                  {currentSopStep === 3 && '精準 OCR 評級標籤文字、證號與小分，並建議標準拍賣品名。'}
                  {currentSopStep === 4 && '僅對貼有白色標籤的卡片消除貼紙，乾淨評級卡自動完整保留原貌。'}
                  {currentSopStep === 5 && '背面將自動套用正面裁切框與順序，無需重複填寫屬性。'}
                  {currentSopStep === 6 && '根據球員知名度與 PSA 10 / BGS 9.5 評級自動估算市場建議售價。'}
                  {currentSopStep === 7 && '可點擊縮圖放大檢查「消除貼紙前後對比」，確保外觀完美無痕。'}
                  {currentSopStep === 8 && '自動將高清正面與背面卡片寫入庫存資料庫，上架完成！'}
                </p>
              </div>
            </div>

            {/* 核心操作大按鈕 (依據當前步驟動態呈現，功能完整保留且專注當前任務) */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {currentSopStep === 1 && (
                <>
                  <label className="cursor-pointer">
                    <Input type="file" accept="image/*" onChange={handleFrontImageUpload} className="hidden" />
                    <div className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md transition-all">
                      <UploadCloud className="w-4 h-4" />
                      <span>{frontImageSrc ? '更換正面圖片' : '上傳正面照片'}</span>
                    </div>
                  </label>
                  {frontImageSrc && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentSopStep(2)}
                      className="h-9 px-3 rounded-xl border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold gap-1 shadow-xs"
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
                    <span>進入步驟 3：PRO 辨識</span>
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
                    <span>PRO 智慧辨識全部</span>
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
                    <span>進入步驟 4：去貼紙</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}

              {currentSopStep === 4 && (
                <>
                  <Button
                    size="sm"
                    onClick={handleBatchRemoveStickers}
                    disabled={isBatchRemovingStickers || cards.length === 0}
                    className="h-9 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-black text-xs shadow-md gap-1.5"
                  >
                    {isBatchRemovingStickers ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eraser className="w-4 h-4" />}
                    <span>批次去空白貼紙 (0點數)</span>
                  </Button>

                  {cards.some(c => c.hasRemovedSticker) && (
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-1.5 rounded-xl border border-emerald-300">
                      ✓ 已修復 {cards.filter(c => c.hasRemovedSticker).length} 張
                    </span>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentSopStep(5)}
                    className="h-9 px-3 rounded-xl border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold gap-1 shadow-xs"
                  >
                    <span>進入步驟 5：上傳背面</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}

              {currentSopStep === 5 && (
                <>
                  <label className="cursor-pointer">
                    <Input type="file" accept="image/*" onChange={handleBackImageUpload} className="hidden" />
                    <div className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md transition-all">
                      <UploadCloud className="w-4 h-4" />
                      <span>{backImageSrc ? '更換背面圖片' : '上傳背面照片'}</span>
                    </div>
                  </label>

                  {backImageSrc && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={copyFrontBoxesToBack}
                        className="h-9 px-3 rounded-xl text-xs font-bold border-cyan-300 bg-cyan-50/80 hover:bg-cyan-100 text-cyan-900 gap-1 shadow-2xs"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-700" />
                        <span>複製正面框</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={mirrorBackBoxes}
                        className="h-9 px-3 rounded-xl text-xs font-bold border-cyan-300 bg-cyan-50/80 hover:bg-cyan-100 text-cyan-900 gap-1 shadow-2xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-cyan-700" />
                        <span>鏡像左右翻轉</span>
                      </Button>
                    </>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentSopStep(6)}
                    className="h-9 px-3 rounded-xl border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold gap-1 shadow-xs"
                  >
                    <span>{backImageSrc ? '進入步驟 6：查詢卡價' : '單面卡 (跳過背面，直接查價)'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}

              {currentSopStep === 6 && (
                <>
                  <Button
                    size="sm"
                    onClick={handleBatchPriceCheck}
                    disabled={isBatchPriceChecking || cards.length === 0}
                    className="h-9 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-md gap-1.5"
                  >
                    {isBatchPriceChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span>查詢卡價行情</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCurrentSopStep(7);
                      setIsQcModalOpen(true);
                    }}
                    className="h-9 px-3 rounded-xl border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold gap-1 shadow-xs"
                  >
                    <span>進入步驟 7：品管防呆核對</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}

              {currentSopStep === 7 && (
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
                    onClick={() => setCurrentSopStep(8)}
                    className="h-9 px-3 rounded-xl border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold gap-1 shadow-xs"
                  >
                    <span>確認無誤，前往一鍵入庫</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}

              {currentSopStep === 8 && (
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

            {/* 簡約純淨標題列，不放干擾功能選項，引導助理專注當前 SOP 步驟 */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 font-mono bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                正面已載入 {frontBoxes.length} 個裁切框 · {cards.filter(c => Boolean(c.frontPreview)).length} 張就緒
              </span>
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
                            {!hideBoxBadges ? (
                              <span className="px-1.5 py-0.5 rounded bg-slate-950/80 text-white text-[10px] font-black font-mono">
                                #{idx + 1}
                              </span>
                            ) : <span />}
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
                      className={`p-3.5 rounded-xl border transition-all ${
                        card.frontCropBox.id === selectedFrontBoxId
                          ? 'border-amber-400 bg-amber-50/40 shadow-xs ring-1 ring-amber-300'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
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
                            className="w-18 h-24 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center relative group cursor-pointer hover:border-amber-400 hover:shadow-md transition-all text-left"
                            title="點擊放大檢視卡片大圖與貼紙消除效果"
                          >
                            {card.frontPreview ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={card.frontPreview} alt="Front Crop" className="w-full h-full object-cover" />
                            ) : (
                              <Crop className="w-5 h-5 text-slate-400" />
                            )}
                            {card.hasRemovedSticker && (
                              <span className="absolute top-1 left-1 px-1 py-0.5 rounded bg-emerald-600/90 text-white text-[8px] font-black shadow-xs">
                                已去標籤
                              </span>
                            )}
                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold">
                              <ZoomIn className="w-4 h-4 text-white drop-shadow mb-0.5" />
                              <span>點擊放大</span>
                            </div>
                          </button>

                          {/* 🌟 僅在「步驟 4：去貼紙」或已去貼紙時顯示專屬微調按鈕，其他步驟保持畫面乾淨 */}
                          {(currentSopStep === 4 || card.hasRemovedSticker) && (
                            <div className="flex items-center gap-1 w-full justify-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveSticker(idx);
                                }}
                                disabled={card.isRemovingSticker}
                                className={`h-6 px-1.5 text-[9px] font-bold rounded-md border transition-all flex-1 ${
                                  card.hasRemovedSticker 
                                    ? 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100' 
                                    : 'border-slate-200 text-slate-700 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                                }`}
                                title={card.hasRemovedSticker ? "復原左上角標籤貼紙" : "一鍵自動偵測去除左上角空白標籤貼紙"}
                              >
                                {card.isRemovingSticker ? (
                                  <Loader2 className="w-2.5 h-2.5 animate-spin mr-0.5 text-rose-600" />
                                ) : (
                                  <Eraser className="w-2.5 h-2.5 mr-0.5 text-rose-500" />
                                )}
                                <span>{card.hasRemovedSticker ? '↺ 復原' : '去貼紙'}</span>
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openStickerEraser(idx);
                                }}
                                className="h-6 w-6 p-0 rounded-md border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 bg-white hover:bg-indigo-50"
                                title="開啟貼紙消除工作台 (微調選取範圍與即時預覽)"
                              >
                                <Crosshair className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* 卡片屬性輸入 */}
                        <div className="flex-1 space-y-2 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-black text-amber-600 font-mono">#{card.index}</span>
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
                                className="h-6 px-2 text-[10px] font-black bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 border-amber-200 hover:bg-amber-100 shadow-2xs"
                              >
                                {card.isAiRecognizing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1 text-amber-500" />}
                                PRO 辨識
                              </Button>
                            )}
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

                          {/* 🌟 PSA / BGS 評級標籤文字專區 */}
                          <div className="p-2 rounded-lg bg-indigo-50/50 border border-indigo-100 space-y-1.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-black text-indigo-900 flex items-center gap-1">
                                <Tag className="w-3 h-3 text-indigo-600" />
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

                          {/* 🌟 市場卡價參考行情 (僅在步驟 6 顯示查價按鈕，其餘步驟靜態顯示) */}
                          <div className="flex items-center justify-between text-[10px] bg-emerald-50/70 border border-emerald-100 rounded-md px-2 py-1 text-emerald-950">
                            <div className="flex items-center gap-1 overflow-hidden">
                              <DollarSign className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="font-bold shrink-0">市場行情:</span>
                              <span className="font-mono text-emerald-800 font-bold truncate">
                                {card.priceRange || '尚未查詢行情'}
                              </span>
                            </div>
                            {currentSopStep === 6 && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  runSinglePriceCheck(idx);
                                }}
                                disabled={card.isPriceChecking}
                                className="h-5 px-1.5 text-[9px] font-bold text-emerald-700 hover:bg-emerald-100/80 shrink-0"
                                title="依球員名與評級查詢市場行情"
                              >
                                {card.isPriceChecking ? <Loader2 className="w-2.5 h-2.5 animate-spin mr-0.5" /> : <Search className="w-2.5 h-2.5 mr-0.5" />}
                                查卡價
                              </Button>
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
                  setCurrentSopStep(8);
                  handleSaveAllToDatabase();
                }}
                disabled={isSavingToDb || cards.length === 0}
                className="h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md gap-2 border border-emerald-500 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSavingToDb ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <CheckCircle2 className="w-4 h-4 text-emerald-200" />}
                <span>確認無誤，執行第 8 步一鍵入庫！</span>
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
