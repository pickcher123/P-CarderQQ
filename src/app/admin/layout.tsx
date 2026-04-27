'use client';
import { useUser, useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import type { UserProfile } from "@/types/user-profile";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { LoadingSpinner } from "@/components/loading-spinner";
import Link from 'next/link';
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CreditCard,
  Settings,
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
  LayoutGrid,
  Megaphone
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const sidebarNavItems = [
    { title: '數據中心', items: [
      { href: '/admin', label: '營運總覽', icon: LayoutDashboard, permission: null },
      { href: '/admin/reports', label: '營業報表', icon: BarChartHorizontal, permission: 'reports' },
      { href: '/admin/orders', label: '交易紀錄', icon: FileText, permission: 'orders' },
      { href: '/admin/deposits', label: '儲值管理', icon: CreditCard, permission: 'deposits' },
      { href: '/admin/conversions', label: '轉點紀錄', icon: RefreshCw, permission: 'conversions' },
    ]},
    { title: '遊戲管理', items: [
      { href: '/admin/cards', label: '卡片總管', icon: CreditCard, permission: 'cards' },
      { href: '/admin/card-pools', label: '抽卡管理', icon: Package, permission: 'card-pools' },
      { href: '/admin/betting', label: '拼卡管理', icon: Swords, permission: 'betting' },
      { href: '/admin/lucky-bags', label: '福袋管理', icon: Ticket, permission: 'lucky-bags' },
      { href: '/admin/group-breaks', label: '團拆管理', icon: Users2, permission: 'group-breaks' },
    ]},
    { title: '會員管理', items: [
      { href: '/admin/users', label: '會員資訊', icon: UserCircle, permission: 'users' },
      { href: '/admin/rewards', label: '會員回饋', icon: Gift, permission: 'rewards' },
    ]},
    { title: '行銷管理', items: [
      { href: '/admin/news', label: '消息管理', icon: Newspaper, permission: 'news' },
      { href: '/admin/announcements', label: '站內公告', icon: Megaphone, permission: 'announcements' },
      { href: '/admin/coupons', label: '優惠券管理', icon: Ticket, permission: 'coupons' },
    ]},
    { title: '營運操作', items: [
      { href: '/admin/partners', label: '合作夥伴', icon: Users2, permission: 'partners' },
      { href: '/admin/shipping', label: '出貨管理', icon: Truck, permission: 'shipping' },
    ]},
    { title: '素材管理', items: [
      { href: '/admin/materials', label: '品牌與背景', icon: Palette, permission: 'materials' },
    ]},
]

function SidebarNav({ isCollapsed, permissions, isSuperAdmin, onItemClick }: { isCollapsed: boolean, permissions?: string[], isSuperAdmin: boolean, onItemClick?: () => void }) {
    const pathname = usePathname();

    const canView = (permission: string | null) => {
        if (isSuperAdmin || !permission) return true;
        return permissions?.includes(permission);
    }
    
    return (
        <nav className="space-y-6 py-4">
            {sidebarNavItems.map((section) => {
                const visibleItems = section.items.filter(item => canView(item.permission));
                if (visibleItems.length === 0) return null;

                return (
                    <div key={section.title} className="px-4">
                        <h2 className={cn("mb-2 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500", isCollapsed && "hidden")}>{section.title}</h2>
                        <div className="space-y-1">
                            {visibleItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={onItemClick}
                                    className={cn(
                                        "group flex items-center rounded-xl px-3 py-2.5 text-sm font-bold transition-all",
                                        pathname === item.href 
                                            ? "bg-slate-900 text-white shadow-lg" 
                                            : "text-slate-700 hover:bg-slate-100 hover:text-slate-950",
                                        isCollapsed && "justify-center"
                                    )}
                                >
                                    <item.icon className={cn("h-4 w-4 shrink-0", pathname === item.href ? "text-white" : "text-slate-500 group-hover:text-slate-900")} />
                                    <span className={cn("ml-3 truncate", isCollapsed && "hidden")}>{item.label}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                );
            })}
        </nav>
    );
}

function MobileHeader({ permissions, isSuperAdmin }: { permissions?: string[], isSuperAdmin: boolean }) {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const currentPage = sidebarNavItems.flatMap(s => s.items).find(item => item.href === pathname);

    return (
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 md:hidden shadow-sm">
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-xl hover:bg-slate-100">
                        <Menu className="h-6 w-6 text-slate-900" />
                        <span className="sr-only">切換選單</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex flex-col p-0 w-[280px] bg-white border-r-slate-200">
                    <div className="h-16 border-b border-slate-200 px-6 flex items-center justify-between">
                        <Link href="/admin" className="flex items-center gap-2 font-black text-xl tracking-tighter text-slate-900">
                           <ShieldAlert className="h-6 w-6 text-red-600"/>
                           <span>管理後台</span>
                        </Link>
                    </div>
                    <ScrollArea className="flex-grow">
                       <SidebarNav isCollapsed={false} permissions={permissions} isSuperAdmin={isSuperAdmin} onItemClick={() => setOpen(false)} />
                    </ScrollArea>
                    <div className="border-t border-slate-200 p-4 space-y-2">
                        <Link href="/" className="group flex items-center rounded-xl px-4 py-3 text-sm font-bold bg-slate-50 hover:bg-slate-100 transition-all text-slate-700">
                           <ChevronLeft className="h-4 w-4" />
                           <span className="ml-3">返回前台頁面</span>
                        </Link>
                    </div>
                </SheetContent>
            </Sheet>
             <h1 className="text-sm font-black tracking-widest uppercase text-slate-900">{currentPage?.label || '控制台'}</h1>
             <div className="w-10" />
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

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const isSuperAdmin = useMemo(() => user?.email === 'pickcher123@gmail.com', [user]);

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
    <div className="light flex min-h-screen bg-slate-50 text-slate-950">
        <aside className={cn(
            "relative hidden h-screen border-r border-slate-200 bg-white transition-all duration-300 md:flex flex-col shadow-sm",
            isCollapsed ? "w-20" : "w-64"
        )}>
           <div className="flex h-16 items-center border-b border-slate-200 px-6 shrink-0 overflow-hidden">
                <Link href="/admin" className={cn("flex items-center gap-3 font-black text-xl tracking-tighter transition-all", isCollapsed && "translate-x-1")}>
                   <ShieldAlert className="h-6 w-6 text-red-600 shrink-0"/>
                   {!isCollapsed && <span className="text-slate-900 uppercase">管理控制台</span>}
                </Link>
            </div>
            <ScrollArea className="flex-grow">
                <SidebarNav isCollapsed={isCollapsed} permissions={userProfile?.permissions} isSuperAdmin={isSuperAdmin} />
            </ScrollArea>
            <div className="mt-auto border-t border-slate-200 p-3 space-y-1 shrink-0">
                <Link href="/" className={cn("group flex items-center rounded-xl px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all", isCollapsed && "justify-center")}>
                   <ChevronLeft className="h-4 w-4" />
                   {!isCollapsed && <span className="ml-3">回到前台</span>}
                </Link>
            </div>
             <button 
                onClick={() => setIsCollapsed(!isCollapsed)} 
                className="absolute -right-3 top-20 h-6 w-6 rounded-full bg-white text-slate-400 flex items-center justify-center shadow-md border border-slate-200 hover:text-slate-900 transition-all z-50"
            >
                <ChevronsLeft className={cn("h-3.5 w-3.5 transition-transform", isCollapsed && "rotate-180")}/>
            </button>
        </aside>

        <div className="flex flex-col flex-1 h-screen overflow-hidden">
             <MobileHeader permissions={userProfile?.permissions} isSuperAdmin={isSuperAdmin}/>
             <main className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
                <div className="p-4 md:p-8">
                    {children}
                </div>
            </main>
        </div>
    </div>
  );
}
