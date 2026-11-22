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
import { useSystemConfig } from '@/components/providers/system-config-provider';
import { RefinedPoints } from '@/components/ui/refined-points';
import { getBonusMultiplier, isBonusEventActive } from '@/lib/bonus-event';

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

export function PurchasePointsDialog({
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = controlledOnOpenChange ?? setInternalOpen;
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

  const { systemConfig } = useSystemConfig();

  const bonusMultiplier = getBonusMultiplier(systemConfig?.bonusEvent, 'purchase');
  const isBonusActive = isBonusEventActive(systemConfig?.bonusEvent) && bonusMultiplier > 1;

  const effectivePackages = pointPackages.map(pkg => {
    if (!pkg.bonusPoints || !isBonusActive) return { ...pkg, isDoubleEvent: false };
    const multipliedBonus = pkg.bonusPoints * bonusMultiplier;
    return {
      ...pkg,
      bonusPoints: multipliedBonus,
      points: pkg.basePoints + multipliedBonus,
      bonus: pkg.bonus ? pkg.bonus * bonusMultiplier : null,
      isDoubleEvent: true,
    };
  });

  const currentSelectedPkg = effectivePackages.find(p => p.price === selectedPackage.price) || selectedPackage;

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
            amt: currentSelectedPkg.price,
            prodDesc: `P+Carder 點數 - ${currentSelectedPkg.label}`,
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
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent className="max-w-[min(94vw,440px)] p-0 overflow-hidden rounded-2xl bg-[#0a0f1c]/95 backdrop-blur-2xl border border-amber-300/20 shadow-[0_24px_64px_rgba(0,0,0,0.88)] text-white">
        
        {/* Top Ambient Rim & Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-28 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-16 right-8 w-36 h-20 bg-cyan-400/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />

        <div className="relative z-10 p-5 sm:p-6 space-y-5">
          {/* Header */}
          <DialogHeader className="space-y-1.5 text-left pr-8">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400/15 via-white/[0.04] to-amber-400/15 border border-white/10 flex items-center justify-center shadow-inner">
                  <DiamondIcon className="h-4.5 w-4.5 text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-black font-headline tracking-wide text-white leading-tight">
                    點數儲值
                  </DialogTitle>
                  <DialogDescription className="text-slate-400 text-xs mt-0.5">
                    即時入帳 • {isBonusActive && bonusMultiplier > 1 ? (
                      <span className="text-amber-300 font-bold">限時狂歡 {bonusMultiplier}X 加贈中</span>
                    ) : (
                      <>高額方案享最高 <span className="text-amber-300 font-bold">10%</span> 加贈</>
                    )}
                  </DialogDescription>
                </div>
              </div>

              {/* Current Points Badge */}
              {user && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.09] text-xs shrink-0">
                  <span className="text-[11px] text-slate-400 font-medium">餘額</span>
                  <RefinedPoints 
                    value={userProfile?.points ?? 0}
                    currency="diamond"
                    size="xs"
                    variant="luxury"
                  />
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Package Selection Grid (3 Columns) */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            {effectivePackages.map((pkg) => {
              const isSelected = selectedPackage.price === pkg.price;
              return (
                <button
                  key={pkg.price}
                  type="button"
                  onClick={() => setSelectedPackage(pkg)}
                  className={cn(
                    'group relative flex flex-col items-center justify-between px-2.5 py-3.5 rounded-xl border transition-all duration-200 text-center outline-none cursor-pointer',
                    isSelected
                      ? 'bg-gradient-to-b from-amber-400/[0.12] via-[#101729] to-[#0a0f1c] border-amber-300/65 shadow-[0_0_24px_rgba(251,191,36,0.14)] ring-1 ring-amber-300/30'
                      : 'bg-white/[0.03] border-white/[0.08] hover:border-amber-300/30 hover:bg-white/[0.05]'
                  )}
                >
                  {/* Bonus Tag */}
                  {pkg.bonus ? (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
                      <div className={cn(
                        'text-[10px] font-black px-2 py-0.5 rounded-full shadow-md border whitespace-nowrap tracking-wide',
                        pkg.isDoubleEvent 
                          ? 'bg-gradient-to-r from-amber-400 to-rose-500 text-white border-amber-200/60 animate-pulse' 
                          : 'bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] border-amber-200/70'
                      )}>
                        {pkg.isDoubleEvent ? `+${pkg.bonus}% (${bonusMultiplier}X)` : `+${pkg.bonus}%`}
                      </div>
                    </div>
                  ) : null}

                  {/* Selected Check Dot */}
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber-300/20 border border-amber-300/50 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-amber-300 stroke-[3]" />
                    </div>
                  )}

                  {/* Main Points Amount */}
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <RefinedPoints 
                      value={pkg.points}
                      currency="diamond"
                      size="base"
                      variant={isSelected ? 'luxury' : 'glow'}
                      className="font-black"
                    />
                    <DiamondIcon className={cn(
                      'w-3.5 h-3.5 shrink-0 transition-transform duration-200',
                      isSelected
                        ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.7)] scale-110'
                        : 'text-cyan-400/80 group-hover:text-cyan-300'
                    )} />
                  </div>

                  {/* Bonus Subtext */}
                  <div className="h-4 flex items-center justify-center mt-0.5">
                    {pkg.bonusPoints > 0 ? (
                      <span className={cn(
                        'text-[10px] font-semibold tabular-nums',
                        isSelected ? 'text-amber-300' : 'text-amber-300/75'
                      )}>
                        含贈 {pkg.bonusPoints.toLocaleString()} 點
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-medium">標準方案</span>
                    )}
                  </div>

                  {/* NT$ Price */}
                  <div
                    className={cn(
                      'w-full text-[11px] font-numbers font-bold mt-2 py-1 rounded-lg transition-colors tabular-nums border',
                      isSelected
                        ? 'bg-amber-400/15 text-amber-200 border-amber-300/35'
                        : 'bg-white/[0.04] text-slate-300 border-white/[0.06] group-hover:border-white/15'
                    )}
                  >
                    NT$ {pkg.price.toLocaleString()}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Summary Bar */}
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>本次實得</span>
              {currentSelectedPkg.bonusPoints > 0 && (
                <span className="text-[11px] text-amber-300/90 font-medium tabular-nums">
                  ({currentSelectedPkg.basePoints.toLocaleString()} + {currentSelectedPkg.bonusPoints.toLocaleString()} 贈點)
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 font-black text-white tabular-nums">
              <span className="text-sm text-amber-200">{currentSelectedPkg.points.toLocaleString()}</span>
              <DiamondIcon className="w-3.5 h-3.5 text-cyan-300" />
            </div>
          </div>

          {/* Action Button & Security Notice */}
          <div className="space-y-2.5">
            <Button
              onClick={handlePurchase}
              disabled={isProcessing}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 hover:from-[#FEF08A] hover:to-amber-300 text-[#120d02] font-black text-sm shadow-[0_8px_28px_rgba(251,191,36,0.28)] transition-all active:scale-[0.98] cursor-pointer"
            >
              {isProcessing ? (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>連接金流中...</span>
                </div>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <span>立即支付 NT$ {currentSelectedPkg.price.toLocaleString()}</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </span>
              )}
            </Button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>支援信用卡 / ATM 轉帳 • PAYUNi 安全加密</span>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

