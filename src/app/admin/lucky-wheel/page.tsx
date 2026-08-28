'use client';

import React from 'react';
import LuckyWheelFrontendPage from '@/app/(main)/lucky-wheel/page';
import { Button } from '@/components/ui/button';
import { ExternalLink, Globe } from 'lucide-react';
import Link from 'next/link';

export default function AdminLuckyWheelPage() {
    return (
        <div className="space-y-4">
            {/* 後台專屬頂部橫幅：快速開啟前台觀眾視角 */}
            <div className="bg-gradient-to-r from-purple-950/70 via-slate-900/90 to-indigo-950/70 border border-purple-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3 text-center sm:text-left">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center shrink-0">
                        <Globe className="w-5 h-5 text-purple-300" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-white">活動專區已發布至前台！</p>
                        <p className="text-xs text-slate-400">所有玩家皆可於前台導覽「活動專區」輸入密碼進入，或直接點擊右側開新視窗投屏。</p>
                    </div>
                </div>
                <Button asChild size="sm" className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shrink-0 shadow-md">
                    <Link href="/lucky-wheel" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        開啟前台活動視窗
                    </Link>
                </Button>
            </div>

            {/* 嵌入完整 4 步驟大轉盤功能 */}
            <LuckyWheelFrontendPage />
        </div>
    );
}
