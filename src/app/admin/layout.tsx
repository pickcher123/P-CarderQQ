'use client';
import { useUser, useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import type { UserProfile } from "@/types/user-profile";
import { useState, useMemo } from "react";
import { LoadingSpinner } from "@/components/loading-spinner";
import Link from 'next/link';
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CreditCard,
  ChevronLeft,
  ChevronsLeft,
  ShieldAlert,
  Package,
  Swords,
  Ticket,
  Truck,
  FileText,
  BarChartHorizontal,
  Newspaper,
  Menu,
  Users2,
  Gift,
  RefreshCw,
  UserCircle,
  Palette,
  Megaphone,
  Calendar,
  Search,
  ChevronRight,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Disc3,
  Dices
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Activity } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const sidebarNavItems = [
    { 
      title: '數據中心', 
      badge: '財務與統計',
      items: [
        { href: '/admin', label: '營運總覽', icon: LayoutDashboard, permission: null, desc: '即時數據與全站狀態' },
        { href: '/admin/reports', label: '營業報表', icon: BarChartHorizontal, permission: 'reports', desc: '營收與毛利分析' },
        { href: '/admin/orders', label: '交易紀錄', icon: FileText, permission: 'orders', desc: '點數與各項消費流水' },
        { href: '/admin/deposits', label: '儲值管理', icon: CreditCard, permission: 'deposits', desc: '金流儲值審核與紀錄' },
        { href: '/admin/conversions', label: '轉點紀錄', icon: RefreshCw, permission: 'conversions', desc: '玩家點數轉換歷史' },
        { href: '/admin/agents', label: '業務專區', icon: UserCircle, permission: 'agents', desc: '代理業務與分潤報表' },
      ]
    },
    { 
      title: '遊戲管理', 
      badge: '玩法與卡牌',
      items: [
        { href: '/admin/cards', label: '卡片總管', icon: CreditCard, permission: 'cards', desc: '卡牌資產庫與批次上傳' },
        { href: '/admin/card-pools', label: '抽卡管理', icon: Package, permission: 'card-pools', desc: '抽卡機率與卡池設定' },
        { href: '/admin/betting', label: '拼卡管理', icon: Swords, permission: 'betting', desc: '拼卡項目與選號管理' },
        { href: '/admin/lucky-bags', label: '福袋管理', icon: Ticket, permission: 'lucky-bags', desc: '福袋獎品配置與上架' },
        { href: '/admin/group-breaks', label: '團拆管理', icon: Users2, permission: 'group-breaks', desc: '直播團拆專案建立' },
        { href: '/admin/predictions', label: '賽事預測', icon: Activity, permission: 'predictions', desc: '體育與賽事競猜結算' },
      ]
    },
    { 
      title: '會員管理', 
      badge: '用戶與獎勵',
      items: [
        { href: '/admin/users', label: '會員資訊', icon: UserCircle, permission: 'users', desc: '帳號查詢、權限與點數' },
        { href: '/admin/rewards', label: '會員回饋', icon: Gift, permission: 'rewards', desc: '簽到與紅利兌換商城' },
      ]
    },
    { 
      title: '活動專區', 
      badge: '互動與抽獎',
      items: [
        { href: '/admin/lucky-wheel', label: '大轉盤福袋', icon: Disc3, permission: null, desc: '自訂號碼、名單與轉盤抽獎' },
      ]
    },
    { 
      title: '行銷管理', 
      badge: '活動與宣傳',
      items: [
        { href: '/admin/news', label: '消息管理', icon: Newspaper, permission: 'news', desc: '最新消息與專題文章' },
        { href: '/admin/announcements', label: '站內公告', icon: Megaphone, permission: 'announcements', desc: '彈出公告與跑馬燈' },
        { href: '/admin/coupons', label: '優惠券管理', icon: Ticket, permission: 'coupons', desc: '折價券與兌換碼發放' },
        { href: '/admin/card-exhibitions', label: '卡展行事曆', icon: Calendar, permission: 'card-exhibitions', desc: '線下卡展活動日程' },
      ]
    },
    { 
      title: '營運操作', 
      badge: '物流與合作',
      items: [
        { href: '/admin/shipping', label: '出貨管理', icon: Truck, permission: 'shipping', desc: '實體卡片寄送與單號' },
        { href: '/admin/partners', label: '合作夥伴', icon: Users2, permission: 'partners', desc: '實體店面與合作商' },
      ]
    },
    { 
      title: '系統配置', 
      badge: '視覺與設定',
      items: [
        { href: '/admin/materials', label: '品牌與背景', icon: Palette, permission: 'materials', desc: '橫幅輪播與全站主題' },
        { href: '/admin/alerts', label: '異常預警', icon: ShieldAlert, permission: 'alerts', desc: '庫存與金流異常監控' },
        { href: '/admin/activity-logs', label: '操作日誌', icon: FileText, permission: 'activity-logs', desc: '管理員後台操作軌跡' },
      ]
    },
];

function SidebarNav({ 
    isCollapsed, 
    permissions, 
    isSuperAdmin, 
    searchFilter,
    onItemClick 
}: { 
    isCollapsed: boolean; 
    permissions?: string[]; 
    isSuperAdmin: boolean; 
    searchFilter?: string;
    onItemClick?: () => void; 
}) {
    const pathname = usePathname();

    const canView = (permission: string | null) => {
        if (isSuperAdmin || !permission) return true;
        return permissions?.includes(permission);
    };

    const filterText = (searchFilter || '').trim().toLowerCase();
    
    return (
        <nav className="space-y-6 py-3">
            {sidebarNavItems.map((section) => {
                const visibleItems = section.items.filter(item => {
                    if (!canView(item.permission)) return false;
                    if (!filterText) return true;
                    return item.label.toLowerCase().includes(filterText) || item.desc.toLowerCase().includes(filterText);
                });
                
                if (visibleItems.length === 0) return null;

                return (
                    <div key={section.title} className="px-3">
                        {!isCollapsed && (
                            <div className="flex items-center justify-between px-3 mb-2">
                                <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                                    {section.title}
                                </h2>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {section.badge}
                                </span>
                            </div>
                        )}
                        <div className="space-y-1">
                            {visibleItems.map((item) => {
                                const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={onItemClick}
                                        title={isCollapsed ? item.label : undefined}
                                        className={cn(
                                            "group relative flex items-center rounded-xl px-3 py-2.5 text-sm font-bold transition-all",
                                            isActive 
                                                ? "bg-slate-900 text-white shadow-md shadow-slate-900/10" 
                                                : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900",
                                            isCollapsed && "justify-center px-2"
                                        )}
                                    >
                                        <item.icon className={cn(
                                            "h-4 w-4 shrink-0 transition-colors", 
                                            isActive ? "text-primary" : "text-slate-400 group-hover:text-slate-800"
                                        )} />
                                        
                                        {!isCollapsed && (
                                            <div className="ml-3 min-w-0 flex-1 flex items-center justify-between">
                                                <span className="truncate text-sm">{item.label}</span>
                                                {isActive && (
                                                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                                                )}
                                            </div>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </nav>
    );
}

function MobileHeader({ permissions, isSuperAdmin }: { permissions?: string[]; isSuperAdmin: boolean }) {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const currentPage = sidebarNavItems.flatMap(s => s.items).find(item => 
        item.href === pathname || (item.href !== '/admin' && pathname.startsWith(item.href))
    );

    return (
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 backdrop-blur px-4 md:hidden shadow-xs">
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-xl hover:bg-slate-100">
                        <Menu className="h-6 w-6 text-slate-900" />
                        <span className="sr-only">切換選單</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex flex-col p-0 w-[290px] bg-white border-r-slate-200">
                    <div className="h-16 border-b border-slate-200 px-6 flex items-center justify-between">
                        <Link href="/admin" className="flex items-center gap-2.5 font-black text-lg tracking-tight text-slate-900">
                           <div className="h-8 w-8 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-sm">
                             <ShieldAlert className="h-4 w-4"/>
                           </div>
                           <div className="flex flex-col">
                             <span className="leading-none">CARD MASTER</span>
                             <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">後台管理中心</span>
                           </div>
                        </Link>
                    </div>
                    <ScrollArea className="flex-grow">
                       <SidebarNav isCollapsed={false} permissions={permissions} isSuperAdmin={isSuperAdmin} onItemClick={() => setOpen(false)} />
                    </ScrollArea>
                    <div className="border-t border-slate-200 p-4 space-y-2 bg-slate-50/50">
                        <Link href="/" className="group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-bold bg-white border border-slate-200 hover:bg-slate-100 transition-all text-slate-700">
                           <div className="flex items-center gap-2">
                             <ChevronLeft className="h-4 w-4" />
                             <span>返回前台網站</span>
                           </div>
                           <ExternalLink className="h-3.5 w-3.5 text-slate-400"/>
                        </Link>
                    </div>
                </SheetContent>
            </Sheet>
            
            <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">後台 /</span>
                <h1 className="text-sm font-black text-slate-900">{currentPage?.label || '控制台'}</h1>
            </div>
            
            <Link href="/" className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-slate-100 px-2.5 py-1.5 rounded-lg">
                前台
                <ChevronRight className="h-3 w-3" />
            </Link>
        </header>
    );
}

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [navSearch, setNavSearch] = useState('');

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const superAdmins = useMemo(() => ['pickcher123@gmail.com'], []);
  const isSuperAdmin = useMemo(() => user?.email && superAdmins.includes(user.email), [user, superAdmins]);

  const currentNav = useMemo(() => {
    return sidebarNavItems.flatMap(s => s.items).find(item => 
      item.href === pathname || (item.href !== '/admin' && pathname.startsWith(item.href))
    );
  }, [pathname]);

  const currentCategory = useMemo(() => {
    return sidebarNavItems.find(s => s.items.some(i => i.href === pathname || (i.href !== '/admin' && pathname.startsWith(i.href))));
  }, [pathname]);

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user || !userProfile || userProfile.role !== 'admin') {
    return (
        <div className="flex h-screen flex-col items-center justify-center text-center bg-white p-6">
            <div className="p-6 rounded-full bg-red-50 border border-red-100 mb-6">
                <ShieldAlert className="h-12 w-12 text-red-600" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-widest">存取權限受限</h1>
            <p className="text-slate-600 mt-2 max-w-xs font-medium">您沒有管理員權限存取此區域。</p>
            <Button asChild className="mt-8 rounded-xl px-10 h-12 font-bold bg-slate-900 text-white hover:bg-slate-800"><Link href="/">返回首頁</Link></Button>
        </div>
    );
  }

  const pagePermission = sidebarNavItems.flatMap(s => s.items).find(i => i.href === pathname)?.permission;

  if (pagePermission && !isSuperAdmin && !userProfile.permissions?.includes(pagePermission)) {
    return (
        <div className="flex h-screen flex-col items-center justify-center text-center bg-white p-6">
            <h1 className="text-2xl font-black text-slate-900">權限不足</h1>
            <p className="text-slate-600 mt-2 font-medium">您的帳號未被授權管理此模組。</p>
            <Button asChild variant="outline" className="mt-6 rounded-xl border-slate-200"><Link href="/admin">返回儀表板</Link></Button>
        </div>
    );
  }

  return (
    <div className="light flex min-h-screen bg-slate-50/70 text-slate-950">
        {/* Desktop Sidebar */}
        <aside className={cn(
            "relative hidden h-screen border-r border-slate-200/90 bg-white transition-all duration-300 md:flex flex-col shadow-xs select-none",
            isCollapsed ? "w-20" : "w-64"
        )}>
           {/* Brand Header */}
           <div className="flex h-16 items-center justify-between border-b border-slate-200/80 px-4 shrink-0 overflow-hidden bg-slate-900 text-white">
                <Link href="/admin" className={cn("flex items-center gap-3 font-black text-lg tracking-tight transition-all", isCollapsed && "justify-center w-full")}>
                   <div className="h-8 w-8 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                     <ShieldAlert className="h-4 w-4"/>
                   </div>
                   {!isCollapsed && (
                     <div className="flex flex-col">
                       <span className="leading-tight text-sm font-black tracking-tight">CARD MASTER</span>
                       <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">後台管理系統</span>
                     </div>
                   )}
                </Link>
            </div>

            {/* Quick Menu Search */}
            {!isCollapsed && (
              <div className="px-3 pt-3 shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={navSearch}
                    onChange={(e) => setNavSearch(e.target.value)}
                    placeholder="搜尋功能模組..."
                    className="w-full h-8 pl-8 pr-3 text-xs bg-slate-100/80 hover:bg-slate-100 focus:bg-white rounded-lg border border-transparent focus:border-slate-300 outline-none transition-all placeholder:text-slate-400 font-medium"
                  />
                  {navSearch && (
                    <button onClick={() => setNavSearch('')} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
                  )}
                </div>
              </div>
            )}

            {/* Navigation List */}
            <ScrollArea className="flex-grow">
                <SidebarNav 
                  isCollapsed={isCollapsed} 
                  permissions={userProfile?.permissions} 
                  isSuperAdmin={isSuperAdmin}
                  searchFilter={navSearch}
                />
            </ScrollArea>

            {/* User Profile & Back to Store Footer */}
            <div className="mt-auto border-t border-slate-200/80 p-3 space-y-2 shrink-0 bg-slate-50/50">
                {!isCollapsed && (
                  <div className="px-2 py-1.5 flex items-center gap-2.5 rounded-lg bg-white border border-slate-200/60 shadow-2xs">
                    <div className="h-7 w-7 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center shrink-0">
                      {user.email?.charAt(0).toUpperCase() || 'A'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black text-slate-900 truncate">{userProfile.username || '管理員'}</p>
                        {isSuperAdmin ? (
                          <Badge className="h-4 px-1 text-[9px] bg-rose-100 text-rose-700 hover:bg-rose-100 border-none font-bold">最高</Badge>
                        ) : (
                          <Badge className="h-4 px-1 text-[9px] bg-blue-100 text-blue-700 hover:bg-blue-100 border-none font-bold">管理員</Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                    </div>
                  </div>
                )}

                <Link 
                  href="/" 
                  className={cn(
                    "group flex items-center rounded-xl px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-2xs transition-all border border-transparent hover:border-slate-200", 
                    isCollapsed && "justify-center px-2"
                  )}
                >
                   <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-slate-700" />
                   {!isCollapsed && <span className="ml-2">回到前台頁面</span>}
                </Link>
            </div>

            {/* Collapse Toggle Handle */}
             <button 
                onClick={() => setIsCollapsed(!isCollapsed)} 
                title={isCollapsed ? "展開側邊欄" : "收合側邊欄"}
                className="absolute -right-3 top-20 h-6 w-6 rounded-full bg-white text-slate-400 flex items-center justify-center shadow-md border border-slate-200 hover:text-slate-900 hover:scale-105 transition-all z-50 cursor-pointer"
            >
                <ChevronsLeft className={cn("h-3.5 w-3.5 transition-transform", isCollapsed && "rotate-180")}/>
            </button>
        </aside>

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 h-screen overflow-hidden">
             <MobileHeader permissions={userProfile?.permissions} isSuperAdmin={isSuperAdmin}/>
             
             {/* Desktop Subheader / Breadcrumb bar */}
             <header className="hidden md:flex h-14 items-center justify-between px-8 border-b border-slate-200/80 bg-white/80 backdrop-blur shrink-0">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <Link href="/admin" className="hover:text-slate-900 transition-colors">管理控制台</Link>
                    {currentCategory && (
                        <>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span>{currentCategory.title}</span>
                        </>
                    )}
                    {currentNav && currentNav.href !== '/admin' && (
                        <>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span className="font-black text-slate-900">{currentNav.label}</span>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[11px] font-bold">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                        </span>
                        系統正常連線中
                    </div>

                    <Link 
                      href="/" 
                      target="_blank"
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-colors"
                    >
                        <span>開啟前台網站</span>
                        <ExternalLink className="h-3 w-3" />
                    </Link>
                </div>
             </header>

             <main className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50">
                <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
                    {children}
                </div>
            </main>
        </div>
    </div>
  );
}

