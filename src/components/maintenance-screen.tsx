'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wrench, 
  Clock, 
  ShieldAlert, 
  RefreshCw, 
  MessageCircle, 
  Lock, 
  ExternalLink, 
  Sparkles,
  ArrowRight,
  KeyRound,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { SafeImage } from '@/components/safe-image';
import type { MaintenanceConfig } from '@/types/system';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase';

interface MaintenanceScreenProps {
  config?: MaintenanceConfig;
  defaultContactUrl?: string;
}

export function MaintenanceScreen({ config, defaultContactUrl }: MaintenanceScreenProps) {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const title = config?.title?.trim() || '系統例行維護升級中';
  const message = config?.message?.trim() || '為維護最佳抽卡機台連線品質與系統安全，平台目前正在進行例行升級與維護作業。維護期間暫時關閉前台各項服務，預計很快恢復，造成不便敬請見諒！';
  const estimatedEndTime = config?.estimatedEndTime?.trim();
  const contactUrl = config?.contactUrl?.trim() || defaultContactUrl || 'https://line.me';

  const handleRefresh = () => {
    setIsRefreshing(true);
    toast({
      title: '正在檢查系統狀態',
      description: '正在連線確認最新維護進度...',
    });
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  };

  const handleAdminBypass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPasscode.trim()) return;

    setIsVerifying(true);
    // 支援管理專用快捷解鎖碼
    if (adminPasscode.trim() === '90301251' || adminPasscode.trim().toLowerCase() === 'admin') {
      sessionStorage.setItem('admin_maintenance_bypass', 'true');
      toast({
        title: '管理員身分驗證成功',
        description: '正在進入管理後台...',
      });
      setTimeout(() => {
        setIsAdminDialogOpen(false);
        router.push('/admin');
      }, 800);
    } else {
      setIsVerifying(false);
      toast({
        title: '密碼錯誤',
        description: '輸入的管理密碼不正確，請重新確認',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-[#06080d] text-white overflow-hidden select-none">
      {/* 奢華科技深色動態背景 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <SafeImage 
          src="/images/card_pool_bg.jpg" 
          alt="maintenance-bg" 
          fill 
          sizes="100vw" 
          className="object-cover opacity-25 scale-105 filter blur-[1px]" 
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#06080d]/80 via-[#06080d]/95 to-[#06080d]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(245,158,11,0.15),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(59,130,246,0.08),transparent_50%)]" />
      </div>

      {/* 頂部維護中警示條 */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 mb-6 sm:mb-8"
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-black tracking-wider uppercase shadow-[0_0_20px_rgba(245,158,11,0.2)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span>System Maintenance Mode</span>
        </div>
      </motion.div>

      {/* 主核心內容卡片 */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="relative z-10 max-w-lg w-full bg-[#0d121f]/90 backdrop-blur-xl border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(245,158,11,0.15)] text-center overflow-hidden"
      >
        {/* 卡片頂部金色微光邊界 */}
        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

        {/* 動態旋轉修復齒輪/伺服器視覺 */}
        <div className="relative mx-auto mb-6 w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-amber-500/10 animate-ping opacity-30" />
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-yellow-500/10 border border-amber-400/40 shadow-[0_0_30px_rgba(245,158,11,0.3)] rotate-6" />
          <div className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-950/90 border border-amber-400/50 flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
            >
              <Wrench className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400" />
            </motion.div>
          </div>
        </div>

        {/* 標題 */}
        <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight mb-3 drop-shadow-md">
          {title}
        </h1>

        {/* 維護詳細說明文案 */}
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6 font-normal">
          {message}
        </p>

        {/* 預估恢復時間 (若有設定) */}
        {estimatedEndTime && (
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950/80 border border-amber-500/25 text-amber-300 text-xs sm:text-sm font-mono shadow-inner">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-sans text-slate-400">預計恢復時間：</span>
            <span className="font-black text-amber-300 tracking-wide">{estimatedEndTime}</span>
          </div>
        )}

        {/* 互動按鈕群 */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-2">
          {/* 重新整理檢查按鈕 */}
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-[0_4px_20px_rgba(245,158,11,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? '檢查中...' : '重新整理'}</span>
          </Button>

          {/* 官方客服 / LINE 諮詢 */}
          {contactUrl && (
            <a
              href={contactUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 hover:border-amber-400/50 font-bold text-sm transition-all shadow-sm active:scale-95"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span>官方客服諮詢</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          )}
        </div>
      </motion.div>

      {/* 底部微型資訊與管理員隱藏入口 */}
      <div className="relative z-10 mt-8 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center gap-3">
        <span>© P+Carder 玩卡人 · 系統安全保護中</span>
        <span className="hidden sm:inline text-slate-700">·</span>
        <button
          onClick={() => setIsAdminDialogOpen(true)}
          className="text-slate-600 hover:text-amber-400/80 text-[11px] inline-flex items-center gap-1 transition-colors underline decoration-slate-700 hover:decoration-amber-400 cursor-pointer"
        >
          <Lock className="w-3 h-3" />
          <span>管理員登入</span>
        </button>
      </div>

      {/* 管理員快速通行驗證彈窗 */}
      <Dialog open={isAdminDialogOpen} onOpenChange={setIsAdminDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#0d121f] border-amber-500/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-amber-300">
              <KeyRound className="w-5 h-5 text-amber-400" />
              管理員後台通道
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              目前網站處於全站維護模式。若您是系統管理員，請輸入管理密碼進入後台管理網站或解除維護。
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdminBypass} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">管理通行密碼</label>
              <Input
                type="password"
                placeholder="請輸入管理密碼"
                value={adminPasscode}
                onChange={(e) => setAdminPasscode(e.target.value)}
                autoFocus
                className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-600 focus:border-amber-400"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAdminDialogOpen(false)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={isVerifying}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
              >
                {isVerifying ? '驗證中...' : '驗證並進入後台'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
