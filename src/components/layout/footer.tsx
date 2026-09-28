'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { APP_VERSION } from '@/lib/version';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Mail,
  MessageCircle,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Package,
  Ticket,
  Calendar,
  Layers,
  Sparkles,
  HeartHandshake
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function Footer() {
  const [isMounted, setIsMounted] = useState(false);
  const [isCopiedLine, setIsCopiedLine] = useState(false);
  const [isCopiedEmail, setIsCopiedEmail] = useState(false);
  const { toast } = useToast();

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
    <footer className="relative border-t border-slate-800/80 bg-slate-950/90 text-slate-300 backdrop-blur-xl overflow-hidden">
      {/* 頂部霓虹細線裝飾 */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
      
      {/* 背景柔和微光 */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-32 bg-cyan-500/5 blur-3xl pointer-events-none" />

      {/* 主內容區：手機端增加 pb-28 避開底部 Navigation Bar */}
      <div className="container mx-auto px-4 sm:px-6 pt-12 pb-28 md:pb-10 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10">
          
          {/* 左欄：品牌、主體與營運誠信 (5 欄寬) */}
          <div className="md:col-span-5 space-y-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2.5">
              <span className="font-black text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-300 bg-clip-text text-transparent">
                P+Carder
              </span>
              <Badge className="bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold px-2 py-0">
                球卡數位生態
              </Badge>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed font-normal max-w-sm mx-auto md:mx-0">
              全台頂尖數位球員卡收藏、轉蛋卡池與福袋娛樂平台。致力於打造透明、公平且富有收藏樂趣的即時抽卡與社群互動體驗。
            </p>

            {/* 公司合規登記區塊 */}
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-xs space-y-1.5 max-w-sm mx-auto md:mx-0">
              <div className="flex items-center justify-center md:justify-start gap-1.5 text-slate-200 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>云希國際股份有限公司</span>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-2 text-[11px] text-slate-400">
                <span>統一編號：<strong className="text-slate-300 font-mono">90301251</strong></span>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400 font-medium">合法立案登記</span>
              </div>
            </div>
          </div>

          {/* 中欄：快速導航與平台探索 (3 欄寬) */}
          <div className="md:col-span-3 space-y-3.5 text-center md:text-left">
            <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest flex items-center justify-center md:justify-start gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>探索玩法</span>
            </h4>
            <ul className="space-y-2 text-xs font-medium text-slate-400">
              <li>
                <Link href="/draw" className="hover:text-cyan-300 transition-colors flex items-center justify-center md:justify-start gap-1.5">
                  <Package className="w-3.5 h-3.5 text-cyan-400" />
                  <span>轉蛋抽卡卡池</span>
                </Link>
              </li>
              <li>
                <Link href="/lucky-bags" className="hover:text-amber-300 transition-colors flex items-center justify-center md:justify-start gap-1.5">
                  <Ticket className="w-3.5 h-3.5 text-amber-400" />
                  <span>限量福袋專案</span>
                </Link>
              </li>
              <li>
                <Link href="/exhibitions" className="hover:text-cyan-300 transition-colors flex items-center justify-center md:justify-start gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  <span>卡展賽事行事曆</span>
                </Link>
              </li>
              <li>
                <Link href="/collection" className="hover:text-cyan-300 transition-colors flex items-center justify-center md:justify-start gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>個人專屬收藏庫</span>
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-slate-200 transition-colors flex items-center justify-center md:justify-start gap-1.5">
                  <HeartHandshake className="w-3.5 h-3.5 text-slate-400" />
                  <span>服務條款與關於我們</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* 右欄：客服與官方聯絡管道 (4 欄寬) */}
          <div className="md:col-span-4 space-y-3.5 text-center md:text-left">
            <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest flex items-center justify-center md:justify-start gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>官方客服管道</span>
            </h4>

            <div className="space-y-2.5 max-w-sm mx-auto md:mx-0">
              {/* LINE 官方客服小卡 */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/80 to-slate-900/90 border border-emerald-500/30 flex items-center justify-between gap-3 group hover:border-emerald-400/60 transition-all">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-[10px] text-slate-400 font-bold">LINE 官方帳號</p>
                    <p className="text-xs font-mono font-black text-emerald-300 truncate">@288qqsyq</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => copyToClipboard('@288qqsyq', 'line')}
                    className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="複製 LINE ID"
                  >
                    {isCopiedLine ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <Button
                    asChild
                    size="sm"
                    className="h-7 px-2.5 text-[10px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    <a href="https://line.me/R/ti/p/@288qqsyq" target="_blank" rel="noopener noreferrer">
                      加入好友
                    </a>
                  </Button>
                </div>
              </div>

              {/* Email 客服小卡 */}
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-3 group hover:border-slate-700 transition-all">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-[10px] text-slate-400 font-bold">客服信箱</p>
                    <a
                      href="mailto:pickcher1234@gmail.com"
                      className="text-xs font-mono font-medium text-slate-200 hover:text-cyan-300 transition-colors truncate block"
                    >
                      pickcher1234@gmail.com
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard('pickcher1234@gmail.com', 'email')}
                  className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors shrink-0"
                  title="複製客服信箱"
                >
                  {isCopiedEmail ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 底部次級版權與系統狀態欄 */}
        <div className="mt-10 pt-6 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-xs text-slate-500">
          <div className="space-y-0.5">
            <p>© {new Date().getFullYear()} P+Carder. All rights reserved.</p>
            <p className="text-[11px] text-slate-600">云希國際股份有限公司 版權所有</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-medium">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
              </span>
              <span>System Operational</span>
            </div>

            <Badge variant="outline" className="bg-slate-900 border-slate-800 text-slate-400 font-mono text-[10px] py-0.5 px-2">
              Ver {APP_VERSION}
            </Badge>
          </div>
        </div>

      </div>
    </footer>
  );
}
