'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAppVersionFromSystem } from '@/lib/version';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { SystemConfig } from '@/types/system';
import { Button } from '@/components/ui/button';
import {
  Mail,
  MessageCircle,
  Copy,
  Check,
  ArrowUpRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function Footer() {
  const [isMounted, setIsMounted] = useState(false);
  const [isCopiedLine, setIsCopiedLine] = useState(false);
  const [isCopiedEmail, setIsCopiedEmail] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
  const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);
  const currentVersion = getAppVersionFromSystem(systemConfig);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  const copyToClipboard = (text: string, type: 'line' | 'email') => {
    navigator.clipboard.writeText(text);
    if (type === 'line') {
      setIsCopiedLine(true);
      setTimeout(() => setIsCopiedLine(false), 2000);
      toast({ title: '已複製 LINE ID', description: text });
    } else {
      setIsCopiedEmail(true);
      setTimeout(() => setIsCopiedEmail(false), 2000);
      toast({ title: '已複製客服信箱', description: text });
    }
  };

  return (
    <footer className="relative border-t border-white/[0.08] bg-[#060912] text-slate-300 overflow-hidden">
      {/* =========================================================================
          📱 手機端極簡版 Footer (Compact Mobile Footer)
          ========================================================================= */}
      <div className="block md:hidden container mx-auto px-4 pt-6 pb-24 text-center space-y-4">
        <div className="flex items-center justify-center">
          <span className="font-brand font-black text-lg tracking-tight text-cyan-400">
            P+CARDER
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
          <span className="text-slate-200 font-medium">云希國際股份有限公司</span>
          <span className="text-slate-600">·</span>
          <span>統編：<strong className="text-slate-300 font-mono">90301251</strong></span>
          <span className="text-slate-600">·</span>
          <span className="inline-flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            合法立案
          </span>
        </div>

        {/* 官方客服快捷管道 */}
        <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
          <a
            href="https://line.me/R/ti/p/@288qqsyq"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] hover:border-emerald-400/40 text-slate-200 transition-colors text-xs active:scale-[0.98]"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="text-left leading-tight">
              <span className="block text-[10px] text-slate-400">LINE 客服</span>
              <span className="font-mono font-semibold text-emerald-300 text-xs">@288qqsyq</span>
            </div>
          </a>

          <button
            type="button"
            onClick={() => copyToClipboard('pickcher1234@gmail.com', 'email')}
            className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] hover:border-white/20 text-slate-200 transition-colors text-xs active:scale-[0.98]"
          >
            <Mail className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <div className="text-left leading-tight truncate">
              <span className="block text-[10px] text-slate-400">客服信箱</span>
              <span className="font-mono text-[11px] text-slate-200">
                {isCopiedEmail ? '已複製信箱' : '點此複製'}
              </span>
            </div>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-400">
          <Link href="/guide" className="hover:text-white transition-colors">
            常見問題
          </Link>
          <span className="text-slate-700">·</span>
          <Link href="/fairness" className="hover:text-white transition-colors">
            公平驗證機制
          </Link>
          <span className="text-slate-700">·</span>
          <Link href="/about" className="hover:text-white transition-colors">
            關於我們與條款
          </Link>
        </div>

        <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-slate-500">
          <span>© {new Date().getFullYear()} P+Carder 版權所有</span>
          <Link href="/changelog" title="查看版本更新紀錄" className="font-mono text-slate-400 hover:text-white transition-colors">
            Ver {currentVersion}
          </Link>
        </div>
      </div>

      {/* =========================================================================
          🖥️ 桌面端完整版 Footer (Full Desktop Footer - md 以上顯示)
          ========================================================================= */}
      <div className="hidden md:block container mx-auto px-6 pt-12 pb-10 max-w-6xl">
        <div className="grid grid-cols-12 gap-8 lg:gap-10">
          {/* 左欄：品牌與公司合規資訊 (4 欄寬) */}
          <div className="col-span-4 space-y-5 text-left">
            <div className="space-y-3">
              <span className="font-brand font-black text-xl tracking-tight text-cyan-400 block">
                P+CARDER
              </span>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xs">
                專業球員卡數位收藏平台，提供線上抽卡、自選拼卡、限量福袋與直播團拆服務，公開透明守護每份收藏。
              </p>
            </div>

            <div className="pt-4 border-t border-white/[0.08] space-y-1 max-w-xs">
              <div className="text-xs font-semibold text-slate-200">
                云希國際股份有限公司
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>統一編號：<strong className="text-slate-300 font-mono">90301251</strong></span>
                <span className="text-slate-700">·</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-400/90 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  合法立案登記
                </span>
              </div>
            </div>
          </div>

          {/* 中左欄：探索玩法 (2 欄寬，純淨排版無彩虹圖示) */}
          <div className="col-span-2 space-y-3.5 text-left">
            <h4 className="text-xs font-semibold text-slate-200 tracking-wider">
              探索玩法
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li>
                <Link href="/draw" className="hover:text-white transition-colors">
                  轉蛋抽卡卡池
                </Link>
              </li>
              <li>
                <Link href="/bet" className="hover:text-white transition-colors">
                  自選拼卡挑戰
                </Link>
              </li>
              <li>
                <Link href="/lucky-bags" className="hover:text-white transition-colors">
                  限量福袋專案
                </Link>
              </li>
              <li>
                <Link href="/exhibitions" className="hover:text-white transition-colors">
                  卡展賽事行事曆
                </Link>
              </li>
              <li>
                <Link href="/collection" className="hover:text-white transition-colors">
                  個人專屬收藏庫
                </Link>
              </li>
            </ul>
          </div>

          {/* 中右欄：支援與規範 (2 欄寬) */}
          <div className="col-span-2 space-y-3.5 text-left">
            <h4 className="text-xs font-semibold text-slate-200 tracking-wider">
              支援與規範
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li>
                <Link href="/guide" className="hover:text-white transition-colors">
                  常見問題與教學
                </Link>
              </li>
              <li>
                <Link href="/fairness" className="hover:text-white transition-colors">
                  公開公平驗證
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  關於我們與條款
                </Link>
              </li>
            </ul>
          </div>

          {/* 右欄：官方客服管道 (4 欄寬，統一深色質感表面) */}
          <div className="col-span-4 space-y-3.5 text-left">
            <h4 className="text-xs font-semibold text-slate-200 tracking-wider">
              官方客服管道
            </h4>

            <div className="space-y-2.5">
              {/* LINE 官方客服 */}
              <div className="px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between gap-3 hover:border-white/[0.16] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400 leading-none mb-1">LINE 官方帳號</p>
                    <p className="text-xs font-mono font-semibold text-slate-100 truncate">@288qqsyq</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => copyToClipboard('@288qqsyq', 'line')}
                    className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="複製 LINE ID"
                  >
                    {isCopiedLine ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <Button
                    asChild
                    size="sm"
                    className="h-7 px-2.5 text-[11px] font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                  >
                    <a href="https://line.me/R/ti/p/@288qqsyq" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
                      <span>加入好友</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </a>
                  </Button>
                </div>
              </div>

              {/* Email 客服 */}
              <div className="px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between gap-3 hover:border-white/[0.16] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <Mail className="w-4 h-4 text-slate-300 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400 leading-none mb-1">客服信箱</p>
                    <a
                      href="mailto:pickcher1234@gmail.com"
                      className="text-xs font-mono text-slate-100 hover:text-cyan-300 transition-colors truncate block"
                    >
                      pickcher1234@gmail.com
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard('pickcher1234@gmail.com', 'email')}
                  className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 hover:text-white transition-colors shrink-0 cursor-pointer"
                  title="複製客服信箱"
                >
                  {isCopiedEmail ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 底部次級版權與版本欄 */}
        <div className="mt-10 pt-6 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} P+Carder</span>
            <span className="text-slate-700">·</span>
            <span>云希國際股份有限公司 版權所有</span>
          </div>

          <Link href="/changelog" title="查看版本更新紀錄" className="font-mono text-slate-400 hover:text-white transition-colors">
            Ver {currentVersion}
          </Link>
        </div>
      </div>
    </footer>
  );
}
