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
  ExternalLink,
  ShieldCheck,
  Disc3,
  Mail,
  Share2,
  ShieldAlert,
  Activity,
  X,
  Compass,
  Home,
  ScanLine
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface NavItem {
  href: string;
  label: string;
  icon: any;
  permission: string | null;
  desc: string;
}

interface NavSection {
  title: string;
  badge: string;
  items: NavItem[];
}

const sidebarNavItems: NavSection[] = [
  { 
    title: '數據與財務', 
    badge: '數據',
    items: [
      { href: '/admin', label: '營運總覽', icon: LayoutDashboard, permission: null, desc: '即時數據與核心狀態' },
      { href: '/admin/reports', label: '營業報表', icon: BarChartHorizontal, permission: 'reports', desc: '營收與毛利分析' },
      { href: '/admin/orders', label: '交易紀錄', icon: FileText, permission: 'orders', desc: '點數與各項消費流水' },
      { href: '/admin/deposits', label: '儲值管理', icon: CreditCard, permission: 'deposits', desc: '金流儲值審核與紀錄' },
      { href: '/admin/conversions', label: '轉點紀錄', icon: RefreshCw, permission: 'conversions', desc: '玩家點數轉換歷史' },
      { href: '/admin/agents', label: '業務專區', icon: UserCircle, permission: 'agents', desc: '代理業務與分潤報表' },
    ]
  },
  { 
    title: '遊戲與卡池', 
    badge: '玩法',
    items: [
      { href: '/admin/cards', label: '卡片總管', icon: CreditCard, permission: 'cards', desc: '卡牌資產庫與批次上傳' },
      { href: '/admin/cards/scanner', label: '掃描分割 (PRO)', icon: ScanLine, permission: 'cards', desc: 'AI 辨識、邊框偵測與正反面裁切' },
      { href: '/admin/card-pools', label: '抽卡管理', icon: Package, permission: 'card-pools', desc: '抽卡機率與卡池設定' },
      { href: '/admin/betting', label: '拼卡管理', icon: Swords, permission: 'betting', desc: '拼卡項目與選號管理' },
      { href: '/admin/lucky-bags', label: '福袋管理', icon: Ticket, permission: 'lucky-bags', desc: '福袋獎品配置與上架' },
      { href: '/admin/group-breaks', label: '團拆管理', icon: Users2, permission: 'group-breaks', desc: '直播團拆專案建立' },
      { href: '/admin/lucky-wheel', label: '大轉盤福袋', icon: Disc3, permission: null, desc: '自訂號碼與轉盤抽獎' },
    ]
  },
  { 
    title: '用戶與物流', 
    badge: '營運',
    items: [
      { href: '/admin/users', label: '會員資訊', icon: UserCircle, permission: 'users', desc: '帳號查詢、權限與點數' },
      { href: '/admin/shipping', label: '出貨管理', icon: Truck, permission: 'shipping', desc: '實體卡片寄送與單號' },
      { href: '/admin/rewards', label: '會員回饋', icon: Gift, permission: 'rewards', desc: '簽到與紅利兌換商城' },
    ]
  },
  { 
    title: '行銷與推廣', 
    badge: '活動',
    items: [
      { href: '/admin/predictions', label: '賽事預測', icon: Activity, permission: 'predictions', desc: '體育與賽事競猜結算' },
      { href: '/admin/referrals', label: '推薦碼管理', icon: Share2, permission: 'coupons', desc: '好友邀請與專案推廣碼' },
      { href: '/admin/coupons', label: '優惠券管理', icon: Ticket, permission: 'coupons', desc: '折價券與兌換碼發放' },
      { href: '/admin/news', label: '消息管理', icon: Newspaper, permission: 'news', desc: '最新消息與專題文章' },
      { href: '/admin/announcements', label: '站內公告', icon: Megaphone, permission: 'announcements', desc: '彈出公告與跑馬燈' },
      { href: '/admin/card-exhibitions', label: '卡展行事曆', icon: Calendar, permission: 'card-exhibitions', desc: '線下卡展活動日程' },
      { href: '/admin/marketing-emails', label: '行銷郵件', icon: Mail, permission: 'marketing-emails', desc: '全體與指定會員郵件群發' },
    ]
  },
  { 
    title: '系統與安全', 
    badge: '設定',
    items: [
      { href: '/admin/materials', label: '品牌與背景', icon: Palette, permission: 'materials', desc: '橫幅輪播與全站主題' },
      { href: '/admin/partners', label: '合作夥伴', icon: Users2, permission: 'partners', desc: '實體店面與合作商' },
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
    <nav className="space-y-4 py-3">
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
              <div className="flex items-center justify-between px-2 mb-1.5">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {section.title}
                </h3>
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100/90 px-1.5 py-0.5 rounded-sm">
                  {visibleItems.length}
                </span>
              </div>
            )}
            <div className="space-y-0.5">
              {visibleItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onItemClick}
                    title={isCollapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex items-center rounded-lg px-2.5 py-2 text-xs font-semibold transition-all duration-150",
                      isActive 
                        ? "bg-slate-900 text-white shadow-xs" 
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                      isCollapsed && "justify-center px-2 py-2.5"
                    )}
                  >
                    <IconComponent className={cn(
                      "h-4 w-4 shrink-0 transition-colors", 
                      isActive ? "text-amber-400" : "text-slate-400 group-hover:text-slate-700"
                    )} />
                    
                    {!isCollapsed && (
                      <div className="ml-2.5 min-w-0 flex-1 flex items-center justify-between">
                        <span className="truncate">{item.label}</span>
                        {isActive && (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
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
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 backdrop-blur px-4 md:hidden">
      <div className="flex items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-slate-100">
              <Menu className="h-5 w-5 text-slate-800" />
              <span className="sr-only">切換選單</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col p-0 w-[280px] bg-white border-r-slate-200">
            <div className="h-14 border-b border-slate-200 px-5 flex items-center justify-between bg-slate-900 text-white">
              <Link href="/admin" className="flex items-center gap-2.5 font-bold tracking-tight text-white" onClick={() => setOpen(false)}>
                <div className="h-7 w-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-4 w-4"/>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black tracking-wide">CARD MASTER</span>
                  <span className="text-[9px] text-slate-400 font-medium tracking-wider">管理控制台</span>
                </div>
              </Link>
            </div>
            <ScrollArea className="flex-grow">
              <SidebarNav isCollapsed={false} permissions={permissions} isSuperAdmin={isSuperAdmin} onItemClick={() => setOpen(false)} />
            </ScrollArea>
            <div className="border-t border-slate-200 p-3 bg-slate-50">
              <Link 
                href="/" 
                className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-slate-700"
              >
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-slate-500" />
                  <span>返回前台首頁</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400"/>
              </Link>
            </div>
          </SheetContent>
        </Sheet>
        
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 font-medium">後台</span>
          <span className="text-slate-300">/</span>
          <h1 className="font-bold text-slate-900 truncate max-w-[150px]">{currentPage?.label || '控制台'}</h1>
        </div>
      </div>
      
      <Link 
        href="/" 
        className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors border border-slate-200/80 shadow-2xs"
      >
        <Home className="h-3.5 w-3.5 text-slate-600" />
        <span>返回前台</span>
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

  if (!user || (!isSuperAdmin && (!userProfile || userProfile.role !== 'admin'))) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-center bg-white p-6">
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 mb-4 text-amber-700">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">存取權限受限</h1>
        <p className="text-slate-500 mt-2 max-w-xs text-xs">您目前的帳號沒有管理員權限存取後台系統。</p>
        <Button asChild className="mt-6 rounded-lg px-8 h-10 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800">
          <Link href="/">返回前台首頁</Link>
        </Button>
      </div>
    );
  }

  const pagePermission = sidebarNavItems
    .flatMap(s => s.items)
    .filter(i => i.href !== '/admin')
    .find(i => pathname === i.href || pathname.startsWith(i.href + '/'))
    ?.permission;

  if (pagePermission && !isSuperAdmin && !userProfile?.permissions?.includes(pagePermission)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-center bg-white p-6">
        <h1 className="text-xl font-bold text-slate-900">模組授權不足</h1>
        <p className="text-slate-500 mt-2 text-xs">您的管理員帳號尚未被授權存取此特定模組。</p>
        <Button asChild variant="outline" className="mt-6 rounded-lg text-xs border-slate-200">
          <Link href="/admin">返回儀表板</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="light flex min-h-screen bg-slate-50/60 text-slate-900 antialiased font-sans">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "relative hidden h-screen border-r border-slate-200 bg-white transition-all duration-200 md:flex flex-col select-none shrink-0",
        isCollapsed ? "w-18" : "w-60"
      )}>
        {/* Brand Header */}
        <div className="flex h-14 items-center justify-between border-b border-slate-100 px-4 shrink-0 bg-slate-950 text-white">
          <Link href="/admin" className={cn("flex items-center gap-2.5 font-bold tracking-tight transition-all", isCollapsed && "justify-center w-full")}>
            <div className="h-7 w-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-4 w-4"/>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-wider text-slate-100">CARD MASTER</span>
                <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">控制後台</span>
              </div>
            )}
          </Link>
        </div>

        {/* Search Bar */}
        {!isCollapsed && (
          <div className="px-3 pt-2.5 pb-1 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={navSearch}
                onChange={(e) => setNavSearch(e.target.value)}
                placeholder="搜尋功能選單..."
                className="w-full h-7.5 pl-8 pr-6 text-xs bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-md border border-slate-200 focus:border-slate-400 outline-none transition-colors placeholder:text-slate-400"
              />
              {navSearch && (
                <button 
                  onClick={() => setNavSearch('')} 
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
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

        {/* User Info & Footer Link */}
        <div className="mt-auto border-t border-slate-100 p-2.5 space-y-1.5 shrink-0 bg-slate-50/60">
          {!isCollapsed && (
            <div className="p-2 flex items-center gap-2.5 rounded-lg bg-white border border-slate-200/80">
              <div className="h-7 w-7 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center shrink-0">
                {user.email?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-slate-900 truncate">{userProfile?.username || user?.displayName || '管理員'}</p>
                  <span className={cn(
                    "text-[9px] font-semibold px-1 py-0.2 rounded",
                    isSuperAdmin ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                  )}>
                    {isSuperAdmin ? '最高主管' : '管理員'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
          )}

          <Link 
            href="/" 
            className={cn(
              "group flex items-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-white hover:text-slate-950 hover:shadow-2xs transition-colors border border-transparent hover:border-slate-200", 
              isCollapsed && "justify-center px-2 py-2"
            )}
            title="返回前台首頁 (同視窗)"
          >
            <Home className="h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-slate-900" />
            {!isCollapsed && (
              <div className="ml-2 flex items-center justify-between flex-1">
                <span className="font-semibold">返回前台網站</span>
                <ChevronRight className="h-3 w-3 text-slate-400 opacity-60" />
              </div>
            )}
          </Link>
        </div>

        {/* Collapse Handle */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          title={isCollapsed ? "展開側邊欄" : "收合側邊欄"}
          className="absolute -right-3 top-16 h-6 w-6 rounded-full bg-white text-slate-500 flex items-center justify-center shadow-xs border border-slate-200 hover:text-slate-900 hover:bg-slate-50 transition-colors z-30 cursor-pointer"
        >
          <ChevronsLeft className={cn("h-3 w-3 transition-transform", isCollapsed && "rotate-180")}/>
        </button>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 h-screen overflow-hidden">
        <MobileHeader permissions={userProfile?.permissions} isSuperAdmin={isSuperAdmin}/>
        
        {/* Desktop Header */}
        <header className="hidden md:flex h-12 items-center justify-between px-6 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Link href="/admin" className="hover:text-slate-900 transition-colors">控制台</Link>
            {currentCategory && (
              <>
                <span className="text-slate-300">/</span>
                <span>{currentCategory.title}</span>
              </>
            )}
            {currentNav && currentNav.href !== '/admin' && (
              <>
                <span className="text-slate-300">/</span>
                <span className="font-semibold text-slate-900">{currentNav.label}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600 mr-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-medium text-slate-600">系統連線正常</span>
            </div>

            <span className="text-slate-200">|</span>

            {/* 同視窗直接返回前台 (主要按鈕，不開新分頁) */}
            <Link 
              href="/" 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors border border-slate-200/80 shadow-2xs group"
              title="在當前視窗直接返回前台首頁"
            >
              <Home className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-900" />
              <span>返回前台首頁</span>
            </Link>

            {/* 開新分頁小圖示 (可選) */}
            <Link 
              href="/" 
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="在新分頁另開前台"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        {/* Scrollable Content Body */}
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/60">
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
