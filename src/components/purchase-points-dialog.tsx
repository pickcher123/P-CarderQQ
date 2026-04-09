'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Gem, Loader2, Sparkles, Check, ArrowRight } from 'lucide-react';
import { PPlusIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

// 更新後的儲值包
const pointPackages = [
  { points: 1000, price: 1000, label: '1,000 點', bonus: null },
  { points: 2000, price: 2000, label: '2,000 點', bonus: null },
  { points: 3000, price: 3000, label: '3,000 點', bonus: null },
  { points: 5300, price: 5000, label: '5,000 點', bonus: 6 },
  { points: 10800, price: 10000, label: '10,000 點', bonus: 8 },
  { points: 33000, price: 30000, label: '30,000 點', bonus: 10 },
];

function postToPayUni(url: string, params: Record<string, string>) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  form.style.display = 'none';
  for (const key in params) {
    if (params.hasOwnProperty(key)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = params[key];
      form.appendChild(input);
    }
  }
  document.body.appendChild(form);
  form.submit();
}

export function PurchasePointsDialog({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<(typeof pointPackages)[0]>(pointPackages[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useUser();
  const { toast } = useToast();

  const handlePurchase = async () => {
    if (!user || !user.email) {
      toast({ variant: 'destructive', title: '錯誤', description: '您必須先登入才能儲值。' });
      return;
    }
    setIsProcessing(true);
    try {
      const response = await fetch('/api/payuni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          orderDetails: { amt: selectedPackage.price, prodDesc: `P+Carder 點數 - ${selectedPackage.label}`, email: user.email },
        }),
      });
      if (!response.ok) throw new Error('無法建立支付請求');
      const paymentData = await response.json();
      postToPayUni(paymentData.ApiUrl, { MerID: paymentData.MerID, Version: paymentData.Version, EncryptInfo: paymentData.EncryptInfo, HashInfo: paymentData.HashInfo });
      setIsOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: '儲值失敗' });
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-[min(95vw,580px)] p-0 overflow-hidden rounded-[2.5rem] bg-background/95 backdrop-blur-3xl border border-primary/20 shadow-2xl text-white">
        <div className="p-6 md:p-10">
            <DialogHeader className="mb-6 md:mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-2xl bg-primary/10 border border-primary/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                        <Gem className="h-5 w-5 md:h-6 md:w-6 text-primary animate-pulse" />
                    </div>
                    <DialogTitle className="text-xl md:text-3xl font-black font-headline tracking-widest text-white italic">點數儲值 RECHARGE</DialogTitle>
                </div>
                <DialogDescription className="text-muted-foreground text-xs md:text-sm font-medium tracking-wide">選擇您的儲值方案。高額方案享有最高 <span className="text-accent font-bold">10%</span> 點數回饋。</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-4 py-2 md:py-4">
                {pointPackages.map((pkg) => {
                    const isSelected = selectedPackage.price === pkg.price;
                    return (
                        <button
                            key={pkg.price}
                            onClick={() => setSelectedPackage(pkg)}
                            className={cn(
                                'relative group flex flex-col items-center justify-center p-3 md:p-6 border rounded-3xl transition-all duration-500 overflow-visible min-h-[90px] md:min-h-[120px]',
                                isSelected ? 'bg-primary/10 border-primary shadow-[0_0_30px_rgba(6,182,212,0.2)]' : 'bg-card/40 border-white/5 hover:border-primary/40'
                            )}
                        >
                            <div className={cn("text-lg md:text-2xl font-black font-code flex items-center", isSelected ? "text-white scale-110" : "text-white/60")}>
                                {pkg.points.toLocaleString()} <Gem className={cn("w-3.5 h-3.5 md:w-5 md:h-5 ml-1", isSelected ? "text-primary" : "text-muted-foreground")} />
                            </div>
                            <div className="text-[8px] md:text-xs font-bold text-muted-foreground mt-1.5 md:mt-2 tracking-widest uppercase">NT$ {pkg.price.toLocaleString()}</div>
                            {pkg.bonus && (
                                <div className="absolute -top-2 -right-1 z-10">
                                    <div className="bg-accent text-accent-foreground text-[7px] md:text-[9px] font-black px-2 py-0.5 rounded-lg shadow-xl border border-white/20 whitespace-nowrap">
                                        +{pkg.bonus}% 回饋
                                    </div>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="mt-6 md:mt-8 p-4 md:p-6 rounded-[1.5rem] bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 relative overflow-hidden group">
                <div className="flex justify-between items-center relative z-10">
                    <div className="space-y-0.5">
                        <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">Strategy Confirmation</p>
                        <p className="text-xs md:text-sm font-bold text-muted-foreground">方案：{selectedPackage.label}</p>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center justify-end gap-1.5 md:gap-2">
                            <span className="font-black font-code text-xl md:text-3xl text-white">{selectedPackage.points.toLocaleString()}</span>
                            <Gem className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                        </div>
                        {selectedPackage.bonus && <p className="text-[8px] md:text-[10px] text-accent font-black flex items-center justify-end gap-1 mt-0.5 animate-pulse"><PPlusIcon className="w-2.5 h-2.5" /> 已含回饋</p>}
                    </div>
                </div>
            </div>

            <DialogFooter className="mt-8 flex-col sm:flex-col gap-3">
                <Button onClick={handlePurchase} disabled={isProcessing} className="w-full h-14 md:h-16 rounded-2xl bg-primary text-primary-foreground text-base md:text-lg font-black shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all active:scale-95">
                    {isProcessing ? <Loader2 className="animate-spin" /> : <span className="flex items-center gap-2">前往支付 NT$ {selectedPackage.price.toLocaleString()} <ArrowRight className="w-4 h-4" /></span>}
                </Button>
                <p className="text-center text-[8px] text-muted-foreground uppercase font-headline tracking-[0.3em] opacity-40">Secure Transaction • P+Carder Official</p>
            </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
