'use client';

import { useState, ChangeEvent } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useStorage } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, query, orderBy, serverTimestamp, addDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, uploadString } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, Image as ImageIcon, Save, Loader2, Sparkles, LayoutGrid, Link as LinkIcon, Eye, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { SafeImage } from '@/components/safe-image';
import { Progress } from '@/components/ui/progress';

interface Advertisement {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  isActive: boolean;
  order: number;
  createdAt: any;
}

export default function AdvertisementAdminPage() {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Form states
  const [adTitle, setAdTitle] = useState('');
  const [adLink, setAdLink] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const adsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'advertisements'), orderBy('order', 'asc'));
  }, [firestore]);

  const { data: ads, isLoading } = useCollection<Advertisement>(adsQuery);

  const resetForm = () => {
    setAdTitle('');
    setAdLink('');
    setAiPrompt('');
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadProgress(null);
    setIsProcessing(false);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleAiGenerate = async () => {
    toast({ variant: 'destructive', title: '功能已停用', description: 'AI 生成功能目前不可用。' });
  };

  const handleSaveAd = async () => {
    if (!adTitle.trim() || !previewUrl || !firestore) return;
    setIsProcessing(true);

    try {
      let finalImageUrl = previewUrl;

      // If it's a new file upload
      if (selectedFile && storage) {
        const fileExtension = selectedFile.name.split('.').pop();
        const fileName = `P-Carder/ads/${uuidv4()}.${fileExtension}`;
        const storageRef = ref(storage, fileName);
        const uploadTask = uploadBytesResumable(storageRef, selectedFile);

        finalImageUrl = await new Promise((resolve, reject) => {
          uploadTask.on('state_changed', 
            (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
            reject,
            () => getDownloadURL(uploadTask.snapshot.ref).then(resolve)
          );
        });
      } 
      // If it's from AI (data URI)
      else if (previewUrl.startsWith('data:image') && storage) {
        const fileName = `P-Carder/ads/ai-${uuidv4()}.png`;
        const storageRef = ref(storage, fileName);
        const uploadTask = await uploadString(storageRef, previewUrl, 'data_url');
        finalImageUrl = await getDownloadURL(uploadTask.ref);
      }

      await addDoc(collection(firestore, 'advertisements'), {
        title: adTitle,
        imageUrl: finalImageUrl,
        linkUrl: adLink,
        isActive: true,
        order: (ads?.length ?? 0) + 1,
        createdAt: serverTimestamp(),
      });

      toast({ title: '成功', description: '廣告已新增並上傳。' });
      setIsAddDialogOpen(false);
      setIsAiDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '儲存失敗' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleActive = async (adId: string, currentStatus: boolean) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, 'advertisements', adId), { isActive: !currentStatus });
      toast({ title: '狀態已更新' });
    } catch (e) {
      toast({ variant: 'destructive', title: '更新失敗' });
    }
  };

  const handleDelete = async (adId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'advertisements', adId));
      toast({ title: '已刪除' });
    } catch (e) {
      toast({ variant: 'destructive', title: '刪除失敗' });
    }
  };

  return (
    <div className="container mx-auto p-6 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <LayoutGrid className="h-8 w-8 text-primary" /> 廣告輪播管理
          </h1>
          <p className="mt-2 text-slate-600 font-bold">管理抽卡專區頂部的 21:9 橫幅廣告。支援 AI 生成或手動上傳。</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { resetForm(); setIsAiDialogOpen(true); }} className="bg-slate-900 text-white font-bold h-12 px-6 shadow-xl">
            <Sparkles className="mr-2 h-4 w-4 text-primary" /> AI 產生廣告
          </Button>
          <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }} variant="outline" className="font-bold h-12 border-slate-200">
            <PlusCircle className="mr-2 h-4 w-4" /> 手動新增
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 bg-white overflow-hidden shadow-sm rounded-2xl">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-20 text-center text-[10px] font-black uppercase py-5">排序</TableHead>
              <TableHead className="w-48 text-[10px] font-black uppercase">預覽圖</TableHead>
              <TableHead className="text-[10px] font-black uppercase">廣告標題</TableHead>
              <TableHead className="text-[10px] font-black uppercase">跳轉連結</TableHead>
              <TableHead className="w-24 text-[10px] font-black uppercase">狀態</TableHead>
              <TableHead className="text-right pr-8 text-[10px] font-black uppercase">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={6} className="p-6"><Skeleton className="h-12 w-full rounded-xl" /></TableCell>
              </TableRow>
            ))}
            {ads?.map((ad) => (
              <TableRow key={ad.id} className="hover:bg-slate-50/50 transition-colors border-b-slate-100 group">
                <TableCell className="text-center">
                  <Input 
                    type="number" 
                    defaultValue={ad.order} 
                    className="w-12 h-8 text-center font-code bg-white mx-auto border-slate-200"
                    onBlur={(e) => updateDoc(doc(firestore!, 'advertisements', ad.id), { order: Number(e.target.value) })}
                  />
                </TableCell>
                <TableCell>
                  <div className="relative aspect-[21/9] w-40 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                    <SafeImage src={ad.imageUrl} alt={ad.title} fill className="object-cover" />
                  </div>
                </TableCell>
                <TableCell className="font-black text-slate-900">{ad.title}</TableCell>
                <TableCell className="text-xs font-medium text-slate-400 truncate max-w-[200px]">
                  {ad.linkUrl || <span className="italic">無連結</span>}
                </TableCell>
                <TableCell>
                  <Switch checked={ad.isActive} onCheckedChange={() => handleToggleActive(ad.id, ad.isActive)} />
                </TableCell>
                <TableCell className="text-right pr-8">
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-600 rounded-xl" onClick={() => handleDelete(ad.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!isLoading && ads?.length === 0 && (
          <div className="text-center py-20 text-slate-400 font-bold italic flex flex-col items-center gap-4">
            <ImageIcon className="h-12 w-12 opacity-10" />
            尚未建立任何廣告
          </div>
        )}
      </Card>

      {/* AI Generation Dialog */}
      <Dialog open={isAiDialogOpen} onOpenChange={(v) => !isProcessing && setIsAiDialogOpen(v)}>
        <DialogContent className="light sm:max-w-2xl bg-white rounded-[2rem] p-8 shadow-2xl border-none text-slate-900">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" /> AI 廣告視覺生成系統
            </DialogTitle>
            <DialogDescription className="font-medium text-slate-500">輸入主題描述，Gemini 將為您設計專屬的橫幅背景。</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">廣告主題描述</Label>
              <div className="flex gap-2">
                <Input 
                  value={aiPrompt} 
                  onChange={e => setAiPrompt(e.target.value)} 
                  placeholder="例如：2024 NBA 全明星賽特輯，充滿霓虹燈光與科幻感"
                  disabled={isAiGenerating || isProcessing}
                  className="h-12 border-slate-200 bg-white text-slate-900 font-bold"
                />
                <Button onClick={handleAiGenerate} disabled={isAiGenerating || !aiPrompt} className="bg-primary text-primary-foreground font-bold h-12 px-6">
                  {isAiGenerating ? <Loader2 className="animate-spin h-4 w-4" /> : '生成圖片'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">生成結果預覽 (21:9)</Label>
              <div className="relative aspect-[21/9] w-full bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center">
                {isAiGenerating ? (
                  <div className="text-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                    <p className="text-sm font-black text-slate-400 animate-pulse">Gemini 正在構思視覺方案...</p>
                  </div>
                ) : previewUrl ? (
                  <SafeImage src={previewUrl} alt="preview" fill className="object-cover" />
                ) : (
                  <ImageIcon className="h-12 w-12 text-slate-200" />
                )}
              </div>
            </div>

            {previewUrl && !isAiGenerating && (
              <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">廣告標題</Label>
                  <Input value={adTitle} onChange={e => setAdTitle(e.target.value)} placeholder="顯示於廣告左下角" className="h-12 border-slate-200 bg-white text-slate-900 font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">點擊跳轉網址</Label>
                  <Input value={adLink} onChange={e => setAdLink(e.target.value)} placeholder="/draw/categoryId" className="h-12 border-slate-200 bg-white text-slate-900 font-bold" />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAiDialogOpen(false)} disabled={isProcessing} className="font-bold">取消</Button>
            <Button onClick={handleSaveAd} disabled={isProcessing || !previewUrl || !adTitle} className="bg-slate-900 text-white font-black h-12 px-10 rounded-xl shadow-xl">
              {isProcessing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4"/>}
              確認上傳並發布
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(v) => !isProcessing && setIsAddDialogOpen(v)}>
        <DialogContent className="light sm:max-w-md bg-white rounded-2xl p-8 text-slate-900 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">手動上傳廣告</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase">標題</Label>
              <Input value={adTitle} onChange={e => setAdTitle(e.target.value)} className="h-12 bg-white text-slate-900 font-bold border-slate-200" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase">廣告圖片 (21:9 比例佳)</Label>
              <div className="flex flex-col gap-4">
                <div className="aspect-[21/9] relative w-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center">
                  {previewUrl ? <SafeImage src={previewUrl} alt="preview" fill className="object-cover" /> : <ImageIcon className="text-slate-200" />}
                </div>
                <Input type="file" accept="image/*" onChange={handleFileChange} className="text-xs" />
                {uploadProgress !== null && <Progress value={uploadProgress} className="h-1.5" />}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase">跳轉連結</Label>
              <Input value={adLink} onChange={e => setAdLink(e.target.value)} placeholder="/draw/..." className="h-12 bg-white text-slate-900 font-bold border-slate-200" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddDialogOpen(false)} className="font-bold">取消</Button>
            <Button onClick={handleSaveAd} disabled={isProcessing || !previewUrl || !adTitle} className="bg-slate-900 text-white font-bold h-12 px-8 rounded-xl">
              儲存廣告
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
