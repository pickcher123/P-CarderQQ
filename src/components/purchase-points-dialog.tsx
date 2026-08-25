'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight, ShieldCheck, Check, Sparkles, Wallet } from 'lucide-react';
import { DiamondIcon, PPlusIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { UserProfile } from '@/types/user-profile';

// 儲值包方案定義
const pointPackages = [
  { points: 1000, basePoints: 1000, bonusPoints: 0, price: 1000, label: '1,000 點', bonus: null },
  { points: 2000, basePoints: 2000, bonusPoints: 0, price: 2000, label: '2,000 點', bonus: null },
  { points: 3000, basePoints: 3000, bonusPoints: 0, price: 3000, label: '3,000 點', bonus: null },
  { points: 5300, basePoints: 5000, bonusPoints: 300, price: 5000, label: '5,000 點', bonus: 6 },
  { points: 10800, basePoints: 10000, bonusPoints: 800, price: 10000, label: '10,000 點', bonus: 8 },
  { points: 33000, basePoints: 30000, bonusPoints: 3000, price: 30000, label: '30,000 點', bonus: 10 },
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
  const firestore = useFirestore();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

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
          orderDetails: {
            amt: selectedPackage.price,
            prodDesc: `P+Carder 點數 - ${selectedPackage.label}`,
            email: user.email,
          },
        }),
      });
      if (!response.ok) throw new Error('無法建立支付請求');
      const paymentData = await response.json();
      postToPayUni(paymentData.ApiUrl, {
        MerID: paymentData.MerID,
        Version: paymentData.Version,
        EncryptInfo: paymentData.EncryptInfo,
        HashInfo: paymentData.HashInfo,
      });
      setIsOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: '儲值失敗', description: '無法連接支付閘道，請稍後再試。' });
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-[min(92vw,390px)] p-0 overflow-hidden rounded-2xl bg-[#080d1a] border border-cyan-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.85)] text-white">
        
        {/* Top Glow Accent */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-20 bg-cyan-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee]" />

        <div className="relative z-10 p-4 sm:p-5 space-y-4">
          {/* Header */}
          <DialogHeader className="space-y-1 text-left pr-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                  <DiamondIcon className="h-4 w-4 text-cyan-400" />
                </div>
                <DialogTitle className="text-lg font-black font-headline tracking-wide text-white">
                  點數儲值
                </DialogTitle>
              </div>

              {/* Current Points Badge */}
              {user && (
                <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-900/90 border border-cyan-500/20 text-xs font-mono">
                  <span className="text-[11px] text-slate-400">餘額</span>
                  <span className="font-bold text-cyan-300">{(userProfile?.points ?? 0).toLocaleString()}</span>
                </div>
              )}
            </div>

            <DialogDescription className="text-slate-400 text-xs">
              即時入帳 • 高額方案享最高 <span className="text-amber-400 font-bold">10%</span> 加贈
            </DialogDescription>
          </DialogHeader>

          {/* Package Selection Grid (3 Columns) */}
          <div className="grid grid-cols-3 gap-2 pt-0.5">
            {pointPackages.map((pkg) => {
              const isSelected = selectedPackage.price === pkg.price;
              return (
                <button
                  key={pkg.price}
                  type="button"
                  onClick={() => setSelectedPackage(pkg)}
                  className={cn(
                    'relative flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all duration-150 text-center outline-none cursor-pointer',
                    isSelected
                      ? 'bg-gradient-to-b from-cyan-950/80 to-slate-900 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/50 scale-[1.02]'
                      : 'bg-slate-900/60 border-white/10 hover:border-cyan-500/40 hover:bg-slate-900/90'
                  )}
                >
                  {/* Bonus Tag */}
                  {pkg.bonus ? (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
                      <div className="bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full shadow border border-amber-300/40 whitespace-nowrap">
                        +{pkg.bonus}%
                      </div>
                    </div>
                  ) : null}

                  {/* Main Points Amount */}
                  <div className="flex items-center justify-center gap-0.5 mt-0.5">
                    <span
                      className={cn(
                        'text-base font-black font-mono tracking-tight',
                        isSelected ? 'text-cyan-300' : 'text-slate-100'
                      )}
                    >
                      {pkg.points.toLocaleString()}
                    </span>
                    <DiamondIcon className="w-3 h-3 text-cyan-400 shrink-0" />
                  </div>

                  {/* NT$ Price */}
                  <div
                    className={cn(
                      'text-[10px] font-mono font-bold mt-1 px-1.5 py-0.5 rounded transition-colors',
                      isSelected
                        ? 'bg-cyan-500/20 text-cyan-200'
                        : 'text-slate-400 bg-white/5'
                    )}
                  >
                    ${pkg.price.toLocaleString()}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Action Button & Security Notice */}
          <div className="space-y-2 pt-1">
            <Button
              onClick={handlePurchase}
              disabled={isProcessing}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-sm shadow-[0_0_20px_rgba(6,182,212,0.35)] transition-all active:scale-[0.98] cursor-pointer"
            >
              {isProcessing ? (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>連接金流中...</span>
                </div>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <span>支付 NT$ {selectedPackage.price.toLocaleString()}（得 {selectedPackage.points.toLocaleString()} 點）</span>
                  <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </span>
              )}
            </Button>

            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 font-mono">
              <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>支援 信用卡 / ATM 轉帳 • PAYUNi 安全加密</span>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

