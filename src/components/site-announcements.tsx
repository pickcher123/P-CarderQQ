'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSystemConfig } from '@/components/providers/system-config-provider';
import { Megaphone, Bell, X, ChevronLeft, ChevronRight, ExternalLink, Clock, CheckCircle2, Sparkles, AlertTriangle, Pin, MessageCircle, Users2 } from 'lucide-react';
import { format } from 'date-fns';

export interface SiteAnnouncement {
    id: string;
    title: string;
    content: string;
    tag?: string;
    isGlobal?: boolean;
    showBanner?: boolean;
    isPinned?: boolean;
    isActive?: boolean;
    ctaText?: string;
    ctaUrl?: string;
    createdAt?: { seconds: number; nanoseconds?: number };
    updatedAt?: { seconds: number; nanoseconds?: number };
}

const READ_STORAGE_KEY = 'p_carder_site_announcements_read_v1';
const BANNER_CLOSED_STORAGE_KEY = 'p_carder_site_announcements_banner_closed_v1';

function getVersionStamp(item: SiteAnnouncement): number {
    return item.updatedAt?.seconds || item.createdAt?.seconds || 1;
}

function loadStampMap(key: string): Record<string, number> {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function saveStampMap(key: string, map: Record<string, number>) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(key, JSON.stringify(map));
    } catch {
        // ignore storage quota errors
    }
}

function getTagStyle(tag?: string): { pill: string; isUrgent: boolean } {
    const t = (tag || '').trim();
    if (/緊急|維護|暫停|異常/.test(t)) {
        return {
            pill: 'bg-rose-500/15 text-rose-300 border-rose-400/40',
            isUrgent: true,
        };
    }
    if (/活動|優惠|加碼|福利/.test(t)) {
        return {
            pill: 'bg-amber-400/15 text-[#FDE68A] border-amber-300/45',
            isUrgent: false,
        };
    }
    if (/規則|更新|版本/.test(t)) {
        return {
            pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40',
            isUrgent: false,
        };
    }
    return {
        pill: 'bg-white/[0.06] text-[#FDE68A] border-amber-300/35',
        isUrgent: false,
    };
}

interface SiteAnnouncementContextValue {
    activeAnnouncements: SiteAnnouncement[];
    activeBannerAnnouncement: SiteAnnouncement | null;
    unreadCount: number;
    openCenterModal: (focusId?: string) => void;
    dismissBanner: (item: SiteAnnouncement) => void;
    markAsRead: (item: SiteAnnouncement) => void;
    markAllAsRead: () => void;
}

const SiteAnnouncementContext = createContext<SiteAnnouncementContextValue>({
    activeAnnouncements: [],
    activeBannerAnnouncement: null,
    unreadCount: 0,
    openCenterModal: () => {},
    dismissBanner: () => {},
    markAsRead: () => {},
    markAllAsRead: () => {},
});

export function useSiteAnnouncements() {
    return useContext(SiteAnnouncementContext);
}

export function SiteAnnouncementProvider({ children }: { children: React.ReactNode }) {
    const firestore = useFirestore();
    const pathname = usePathname();
    const { systemConfig } = useSystemConfig();
    const supportLineUrl = systemConfig?.supportLineUrl?.trim() || 'https://line.me/R/ti/p/@288qqsyq';
    const communityLineUrl = systemConfig?.communityUrl?.trim() || 'https://line.me/ti/g2/';
    const isOpenPackPage = pathname?.startsWith('/draw/open');

    // 僅查詢含有 createdAt 欄位的站內公告（與含有 timestamp 的中獎榮譽榜自然隔離，不互相干擾）
    const announcementsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'announcements'), orderBy('createdAt', 'desc'), limit(20));
    }, [firestore]);

    const { data: rawAnnouncements } = useCollection<SiteAnnouncement>(announcementsQuery);

    const activeAnnouncements = useMemo(() => {
        if (!rawAnnouncements) return [];
        return rawAnnouncements
            .filter((item) => item.isActive !== false && Boolean(item.title?.trim()))
            .sort((a, b) => {
                const pinDiff = (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
                if (pinDiff !== 0) return pinDiff;
                return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
            });
    }, [rawAnnouncements]);

    const [readMap, setReadMap] = useState<Record<string, number>>({});
    const [bannerClosedMap, setBannerClosedMap] = useState<Record<string, number>>({});
    const [isHydrated, setIsHydrated] = useState(false);

    // 彈窗狀態：分為「自動全域推播彈窗」與「手動開啟公告中心」
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'broadcast' | 'center'>('broadcast');
    const [broadcastSnapshotIds, setBroadcastSnapshotIds] = useState<string[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [lastBroadcastSig, setLastBroadcastSig] = useState<string>('');

    useEffect(() => {
        setReadMap(loadStampMap(READ_STORAGE_KEY));
        setBannerClosedMap(loadStampMap(BANNER_CLOSED_STORAGE_KEY));
        setIsHydrated(true);
    }, []);

    const isItemRead = useCallback(
        (item: SiteAnnouncement) => (readMap[item.id] || 0) >= getVersionStamp(item),
        [readMap]
    );

    const markAsRead = useCallback((item: SiteAnnouncement) => {
        setReadMap((prev) => {
            const stamp = getVersionStamp(item);
            if ((prev[item.id] || 0) >= stamp) return prev;
            const next = { ...prev, [item.id]: stamp };
            saveStampMap(READ_STORAGE_KEY, next);
            return next;
        });
    }, []);

    const markAllAsRead = useCallback(() => {
        setReadMap((prev) => {
            const next = { ...prev };
            activeAnnouncements.forEach((item) => {
                next[item.id] = getVersionStamp(item);
            });
            saveStampMap(READ_STORAGE_KEY, next);
            return next;
        });
    }, [activeAnnouncements]);

    const dismissBanner = useCallback((item: SiteAnnouncement) => {
        setBannerClosedMap((prev) => {
            const next = { ...prev, [item.id]: getVersionStamp(item) };
            saveStampMap(BANNER_CLOSED_STORAGE_KEY, next);
            return next;
        });
    }, []);

    const unreadCount = useMemo(
        () => activeAnnouncements.filter((item) => !isItemRead(item)).length,
        [activeAnnouncements, isItemRead]
    );

    // 未讀的全域彈窗廣播公告
    const unreadGlobalAnnouncements = useMemo(
        () => activeAnnouncements.filter((item) => item.isGlobal !== false && !isItemRead(item)),
        [activeAnnouncements, isItemRead]
    );

    // 頂部常駐橫幅（僅顯示有勾選 showBanner 且尚未關閉的公告）
    const activeBannerAnnouncement = useMemo(() => {
        if (!isHydrated || isOpenPackPage) return null;
        return (
            activeAnnouncements.find(
                (item) =>
                    item.showBanner === true &&
                    (bannerClosedMap[item.id] || 0) < getVersionStamp(item)
            ) || null
        );
    }, [activeAnnouncements, bannerClosedMap, isHydrated, isOpenPackPage]);

    // 自動觸發全域站內公告彈窗（獨立於首頁最新消息跳窗；若當下已有其他跳窗如最新消息開啟，會禮讓待其關閉後再顯示，絕不重疊）
    const unreadGlobalSig = useMemo(
        () => unreadGlobalAnnouncements.map((a) => `${a.id}:${getVersionStamp(a)}`).join(','),
        [unreadGlobalAnnouncements]
    );

    useEffect(() => {
        if (!isHydrated || isOpenPackPage || modalOpen) return;
        if (!unreadGlobalSig || unreadGlobalSig === lastBroadcastSig) return;

        let cancelled = false;
        let timerId: ReturnType<typeof setTimeout> | null = null;

        const tryOpen = () => {
            if (cancelled) return;
            // 若畫面上已有其他彈窗（例如首頁最新消息跳窗），先暫緩 600ms 再檢查，避免雙跳窗疊加
            if (typeof document !== 'undefined' && document.querySelector('[role="dialog"]')) {
                timerId = setTimeout(tryOpen, 600);
                return;
            }
            setBroadcastSnapshotIds(unreadGlobalAnnouncements.map((a) => a.id));
            setModalMode('broadcast');
            setActiveIndex(0);
            setModalOpen(true);
            setLastBroadcastSig(unreadGlobalSig);
        };

        timerId = setTimeout(tryOpen, 500);
        return () => {
            cancelled = true;
            if (timerId) clearTimeout(timerId);
        };
    }, [isHydrated, isOpenPackPage, modalOpen, unreadGlobalSig, lastBroadcastSig, unreadGlobalAnnouncements]);

    const openCenterModal = useCallback(
        (focusId?: string) => {
            setModalMode('center');
            if (focusId) {
                const idx = activeAnnouncements.findIndex((a) => a.id === focusId);
                setActiveIndex(idx >= 0 ? idx : 0);
            } else {
                setActiveIndex(0);
            }
            setModalOpen(true);
        },
        [activeAnnouncements]
    );

    // 廣播模式使用快照 ID 清單，確保切換下一則時不會因標記已讀而陣列縮短跳頁
    const modalItems = useMemo(() => {
        if (modalMode === 'broadcast') {
            const byId = new Map(activeAnnouncements.map((a) => [a.id, a]));
            return broadcastSnapshotIds
                .map((id) => byId.get(id))
                .filter((item): item is SiteAnnouncement => Boolean(item));
        }
        return activeAnnouncements;
    }, [modalMode, broadcastSnapshotIds, activeAnnouncements]);

    const safeIndex = Math.min(activeIndex, Math.max(0, modalItems.length - 1));
    const currentItem = modalItems[safeIndex] || null;

    const handleCloseModal = useCallback(() => {
        if (modalMode === 'broadcast') {
            // 關閉全域廣播彈窗時，將本次推播的所有未讀全域公告標記為已讀
            modalItems.forEach(markAsRead);
        } else if (currentItem) {
            markAsRead(currentItem);
        }
        setModalOpen(false);
    }, [modalMode, modalItems, markAsRead, currentItem]);

    const handleNext = () => {
        if (currentItem) markAsRead(currentItem);
        setActiveIndex((prev) => (prev + 1) % modalItems.length);
    };

    const handlePrev = () => {
        setActiveIndex((prev) => (prev - 1 + modalItems.length) % modalItems.length);
    };

    const contextValue = useMemo(
        () => ({
            activeAnnouncements,
            activeBannerAnnouncement,
            unreadCount,
            openCenterModal,
            dismissBanner,
            markAsRead,
            markAllAsRead,
        }),
        [activeAnnouncements, activeBannerAnnouncement, unreadCount, openCenterModal, dismissBanner, markAsRead, markAllAsRead]
    );

    return (
        <SiteAnnouncementContext.Provider value={contextValue}>
            {children}

            {/* 站內公告專用彈窗（與首頁最新消息跳窗完全獨立） */}
            <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) handleCloseModal(); }}>
                <DialogContent className="w-[94vw] max-w-lg p-0 bg-[#0a0f1c] border border-amber-300/35 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.88)] overflow-hidden text-slate-100">
                    {/* 頂部香檳金光線邊條 */}
                    <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />

                    {/* Header */}
                    <DialogHeader className="px-5 pt-4 pb-3 border-b border-white/[0.08] text-left">
                        <div className="flex items-center justify-between gap-3 pr-6">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-[3px] h-7 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 shrink-0" />
                                <div className="min-w-0">
                                    <DialogTitle className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                                        <Megaphone className="w-4 h-4 text-[#FDE68A] shrink-0" />
                                        <span>{modalMode === 'broadcast' ? '站內重要公告' : '站內公告中心'}</span>
                                    </DialogTitle>
                                    <DialogDescription className="text-[11px] text-slate-400 mt-0.5">
                                        {modalMode === 'broadcast'
                                            ? '官方系統通知與重要廣播（與最新消息獨立顯示）'
                                            : `共 ${activeAnnouncements.length} 則有效公告`}
                                    </DialogDescription>
                                </div>
                            </div>

                            {modalMode === 'center' && unreadCount > 0 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={markAllAsRead}
                                    className="h-7 px-2.5 text-[11px] font-bold text-[#FDE68A] hover:bg-amber-400/10 rounded-full shrink-0"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                    全部已讀
                                </Button>
                            )}
                        </div>
                    </DialogHeader>

                    {/* Body */}
                    {currentItem ? (
                        <div className="p-5 space-y-4 max-h-[68dvh] overflow-y-auto">
                            {/* 多則公告切換列（公告中心模式時提供清單切換） */}
                            {modalMode === 'center' && modalItems.length > 1 && (
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                                    {modalItems.map((item, idx) => {
                                        const isSelected = idx === safeIndex;
                                        const unread = !isItemRead(item);
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => {
                                                    setActiveIndex(idx);
                                                    markAsRead(item);
                                                }}
                                                className={cn(
                                                    'relative px-2.5 py-1.5 rounded-xl border text-[11px] font-bold whitespace-nowrap transition-colors shrink-0 flex items-center gap-1.5',
                                                    isSelected
                                                        ? 'bg-amber-400/[0.12] border-amber-300/50 text-[#FDE68A]'
                                                        : 'bg-white/[0.03] border-white/[0.08] text-slate-300 hover:bg-white/[0.06]'
                                                )}
                                            >
                                                {unread && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />}
                                                {item.isPinned && <Pin className="w-3 h-3 text-amber-300 shrink-0" />}
                                                <span className="max-w-[130px] truncate">{item.title}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* 公告主體卡片 */}
                            <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 space-y-3">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                'text-[10px] font-black px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1',
                                                getTagStyle(currentItem.tag).pill
                                            )}
                                        >
                                            {getTagStyle(currentItem.tag).isUrgent ? (
                                                <AlertTriangle className="w-3 h-3" />
                                            ) : (
                                                <Sparkles className="w-3 h-3" />
                                            )}
                                            <span>{currentItem.tag || '系統通知'}</span>
                                        </Badge>
                                        {currentItem.isPinned && (
                                            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-200 border-amber-300/35">
                                                置頂
                                            </Badge>
                                        )}
                                    </div>
                                    {currentItem.createdAt?.seconds && (
                                        <span className="text-[11px] text-slate-400 font-mono tabular-nums inline-flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {format(new Date(currentItem.createdAt.seconds * 1000), 'yyyy/MM/dd HH:mm')}
                                        </span>
                                    )}
                                </div>

                                <h3 className="text-base sm:text-lg font-black text-white leading-snug break-words">
                                    {currentItem.title}
                                </h3>

                                <div className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words pt-1 border-t border-white/[0.06]">
                                    {currentItem.content}
                                </div>

                                {currentItem.ctaUrl && (() => {
                                    const rawUrl = currentItem.ctaUrl.trim();
                                    const isExternal = /^https?:\/\//i.test(rawUrl);
                                    const safeHref = isExternal ? rawUrl : (rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`);
                                    return (
                                        <div className="pt-2">
                                            <Button
                                                asChild
                                                onClick={handleCloseModal}
                                                className="w-full h-9 rounded-xl font-black text-xs bg-white/[0.06] hover:bg-white/[0.1] text-[#FDE68A] border border-amber-300/35"
                                            >
                                                {isExternal ? (
                                                    <a
                                                        href={safeHref}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center justify-center gap-1.5"
                                                    >
                                                        <span>{currentItem.ctaText?.trim() || '前往查看'}</span>
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </a>
                                                ) : (
                                                    <Link href={safeHref} className="inline-flex items-center justify-center gap-1.5">
                                                        <span>{currentItem.ctaText?.trim() || '前往查看'}</span>
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </Link>
                                                )}
                                            </Button>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* 底部操作列 */}
                            <div className="flex items-center justify-between gap-2 pt-1">
                                {modalItems.length > 1 ? (
                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={handlePrev}
                                            className="h-8 w-8 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:text-white"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <span className="text-xs font-mono font-bold text-slate-400 px-1.5 tabular-nums">
                                            {safeIndex + 1} / {modalItems.length}
                                        </span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={handleNext}
                                            className="h-8 w-8 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:text-white"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div />
                                )}

                                <Button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="h-9 px-5 rounded-xl font-black text-xs bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] hover:brightness-105 shadow-md"
                                >
                                    我知道了
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 text-center space-y-2">
                            <Bell className="w-8 h-8 text-slate-600 mx-auto" />
                            <p className="text-sm font-bold text-slate-300">目前沒有進行中的站內公告</p>
                            <p className="text-xs text-slate-500">有重大維護或活動推播時會第一時間顯示在這裡</p>
                        </div>
                    )}

                    {/* 官方客服 & LINE 社群快捷入口 */}
                    <div className="px-5 py-3.5 bg-black/40 border-t border-white/[0.08] space-y-2">
                        <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                            官方聯繫與社群
                        </p>
                        <div className="grid grid-cols-2 gap-2.5">
                            <a
                                href={supportLineUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-amber-300/40 transition-all group"
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
                                        <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                                    </div>
                                    <div className="min-w-0 text-left leading-tight">
                                        <span className="block text-xs font-bold text-white group-hover:text-[#FDE68A] transition-colors truncate">
                                            官方客服
                                        </span>
                                        <span className="block text-[10px] text-slate-400 truncate">
                                            LINE 一對一服務
                                        </span>
                                    </div>
                                </div>
                                <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-[#FDE68A] shrink-0 transition-colors" />
                            </a>

                            <a
                                href={communityLineUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-amber-300/40 transition-all group"
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
                                        <Users2 className="w-3.5 h-3.5 text-[#FDE68A]" />
                                    </div>
                                    <div className="min-w-0 text-left leading-tight">
                                        <span className="block text-xs font-bold text-white group-hover:text-[#FDE68A] transition-colors truncate">
                                            LINE 社群
                                        </span>
                                        <span className="block text-[10px] text-slate-400 truncate">
                                            卡友交流・最新通知
                                        </span>
                                    </div>
                                </div>
                                <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-[#FDE68A] shrink-0 transition-colors" />
                            </a>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </SiteAnnouncementContext.Provider>
    );
}

export function SiteAnnouncementBanner() {
    const { activeBannerAnnouncement, openCenterModal, dismissBanner } = useSiteAnnouncements();
    if (!activeBannerAnnouncement) return null;

    return (
        <div className="relative z-30 w-full bg-[#0a0f1c]/95 border-b border-amber-300/35 backdrop-blur-xl">
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-300/70 to-transparent pointer-events-none" />
            <div className="container max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-2.5">
                <button
                    type="button"
                    onClick={() => openCenterModal(activeBannerAnnouncement.id)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left group cursor-pointer"
                >
                    <span
                        className={cn(
                            'shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border',
                            getTagStyle(activeBannerAnnouncement.tag).pill
                        )}
                    >
                        <Megaphone className="w-3 h-3" />
                        <span>{activeBannerAnnouncement.tag || '站內公告'}</span>
                    </span>
                    <span className="text-xs sm:text-[13px] font-bold text-slate-100 group-hover:text-[#FDE68A] truncate transition-colors">
                        {activeBannerAnnouncement.title}
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-0.5 shrink-0 text-[11px] font-bold text-[#FDE68A] group-hover:underline">
                        查看詳情
                        <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => dismissBanner(activeBannerAnnouncement)}
                    className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                    aria-label="關閉公告橫幅"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}

export function SiteAnnouncementBellButton({
    className,
    variant = 'header',
}: {
    className?: string;
    variant?: 'header' | 'floating';
} = {}) {
    const { activeAnnouncements, unreadCount, openCenterModal } = useSiteAnnouncements();

    if (variant === 'floating') {
        return (
            <button
                type="button"
                onClick={() => openCenterModal()}
                title={unreadCount > 0 ? `站內公告（${unreadCount} 則未讀）` : '站內公告'}
                aria-label="開啟站內公告中心"
                className={cn(
                    'relative flex items-center justify-center w-11 h-11 rounded-full bg-[#0a0f1c]/95 backdrop-blur-xl border shadow-[0_6px_20px_rgba(0,0,0,0.65)] active:scale-95 transition-all outline-none',
                    unreadCount > 0
                        ? 'border-amber-300/65 text-[#FDE68A] ring-2 ring-amber-400/20'
                        : 'border-white/[0.16] text-amber-200/90 hover:border-amber-300/45',
                    className
                )}
            >
                <Bell className="w-[18px] h-[18px]" />
                {unreadCount > 0 ? (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 text-[#120d02] text-[10px] font-black flex items-center justify-center tabular-nums shadow-md ring-2 ring-[#0a0f1c]">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                ) : activeAnnouncements.length > 0 ? (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-300 ring-2 ring-[#0a0f1c]" />
                ) : null}
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={() => openCenterModal()}
            title={unreadCount > 0 ? `站內公告（${unreadCount} 則未讀）` : '站內公告'}
            aria-label="開啟站內公告中心"
            className={cn(
                'relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl border transition-colors outline-none shrink-0',
                unreadCount > 0
                    ? 'bg-amber-400/[0.12] border-amber-300/45 text-[#FDE68A] hover:bg-amber-400/20'
                    : 'bg-white/[0.04] border-white/[0.1] text-slate-300 hover:bg-white/[0.08] hover:text-white',
                className
            )}
        >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 text-[#120d02] text-[9px] font-black flex items-center justify-center tabular-nums shadow-sm">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            ) : activeAnnouncements.length > 0 ? (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-300/60" />
            ) : null}
        </button>
    );
}
