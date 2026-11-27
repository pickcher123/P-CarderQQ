'use client';
import { useUser, useDoc, useFirestore, useMemoFirebase, useAuth } from "@/firebase";
import { initiateGoogleSignIn } from "@/firebase/non-blocking-login";
import { signOut } from "firebase/auth";
import { doc } from "firebase/firestore";
import type { UserProfile } from "@/types/user-profile";
import { useState, useMemo, useEffect } from "react";
import { LoadingSpinner } from "@/components/loading-spinner";
import Link from 'next/link';
import { cn } from "@/lib/utils";
import {
  updateAdminAuditContext,
  recordAdminBackendLogin,
  clearAdminBackendLoginSessionFlag,
  setAdminAuditFirestore,
  logAdminApiCall,
} from "@/lib/admin-audit";
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
  UploadCloud,
  LogIn,
  Wrench
} from 'lucide-react';
import type { SystemConfig } from '@/types/system';
import { usePathname } from 'next/navigation';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

import { isSuperAdminEmail, useIsAdmin } from "@/hooks/use-is-admin";

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
      { href: '/admin/cards/scanner', label: '上傳卡片', icon: UploadCloud, permission: 'cards', desc: '卡片上傳、邊框偵測與正反面裁切' },
      { href: '/admin/card-pools', label: '抽卡管理', icon: Package, permission: 'card-pools', desc: '抽卡機率與卡池設定' },
      { href: '/admin/betting', label: '拼卡管理', icon: Swords, permission: 'betting', desc: '拼卡項目與選號管理' },
      { href: '/admin/lucky-bags', label: '福袋管理', icon: Ticket, permission: 'lucky-bags', desc: '福袋獎品配置與上架' },
      { href: '/admin/group-breaks', label: '團拆管理', icon: Users2, permission: 'group-breaks', desc: '直播團拆專案建立' },
    ]
  },
  { 
    title: '用戶與物流', 
    badge: '營運',
    items: [
      { href: '/admin/users', label: '會員資訊', icon: UserCircle, permission: 'users', desc: '帳號查詢、權限與點數' },
      { href: '/admin/login-logs', label: '登入紀錄', icon: LogIn, permission: 'login-logs', desc: '玩家登入時間、IP、裝置與歷程' },
      { href: '/admin/shipping', label: '出貨管理', icon: Truck, permission: 'shipping', desc: '實體卡片寄送與單號' },
      { href: '/admin/rewards', label: '會員回饋', icon: Gift, permission: 'rewards', desc: '簽到與紅利兌換商城' },
    ]
  },
  { 
    title: '行銷與推廣', 
    badge: '活動',
    items: [
      { href: '/admin/referrals', label: '推薦碼管理', icon: Share2, permission: 'referrals', desc: '好友邀請與專案推廣碼' },
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
    // 若管理員尚未被特別限制（permissions 為 undefined），預設具備全模組存取權
    if (permissions === undefined) return true;
    // 一旦管理員被設定了特定權限清單（包含空陣列 []），嚴格依據清單過濾！
    return permissions.includes(permission);
  };

  const filterText = (searchFilter || '').trim().toLowerCase();
  const allNavHrefs = useMemo(
    () => sidebarNavItems.flatMap((s) => s.items.map((i) => i.href)),
    []
  );
  
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
              <div className="flex items-center justify-between px-2.5 mb-2">
                <h3 className="text-[11px] font-bold tracking-wider text-slate-500">
                  {section.title}
                </h3>
                <span className="text-[10px] font-mono font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded tabular-nums">
                  {visibleItems.length}
                </span>
              </div>
            )}
            <div className="space-y-1">
              {visibleItems.map((item) => {
                const hasMoreSpecificMatch = allNavHrefs.some(
                  (otherHref) =>
                    otherHref !== item.href &&
                    otherHref.startsWith(item.href + '/') &&
                    (pathname === otherHref || pathname.startsWith(otherHref + '/'))
                );
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/admin' &&
                    pathname.startsWith(item.href + '/') &&
                    !hasMoreSpecificMatch);
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onItemClick}
                    title={isCollapsed ? `${item.label} — ${item.desc}` : item.desc}
                    className={cn(
                      "group relative flex items-center rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-150",
                      isActive 
                        ? "bg-slate-900 text-white shadow-sm" 
                        : "text-slate-600 hover:bg-slate-100/90 hover:text-slate-950",
                      isCollapsed && "justify-center px-2 py-2.5"
                    )}
                  >
                    <IconComponent className={cn(
                      "h-4 w-4 shrink-0 transition-colors", 
                      isActive ? "text-amber-400" : "text-slate-400 group-hover:text-slate-700"
                    )} />
                    
                    {!isCollapsed && (
                      <div className="ml-3 min-w-0 flex-1 flex items-center justify-between">
                        <span className="truncate">{item.label}</span>
                        {isActive && (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
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

function MobileHeader({ permissions, isSuperAdmin, isMaintenanceActive }: { permissions?: string[]; isSuperAdmin: boolean; isMaintenanceActive?: boolean }) {
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
                  <span className="text-xs font-black tracking-wide">P+CARDER</span>
                  <span className="text-[10px] text-slate-400 font-medium tracking-wider">後台管理中心</span>
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
      
      <div className="flex items-center gap-2">
        {isMaintenanceActive && (
          <span className="text-[10px] font-black text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
            維護中
          </span>
        )}
        <Link 
          href="/" 
          className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors border border-slate-200/80 shadow-2xs"
        >
          <Home className="h-3.5 w-3.5 text-slate-600" />
          <span>前台</span>
        </Link>
      </div>
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

  const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
  const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);
  const isMaintenanceActive = Boolean(systemConfig?.maintenance?.enabled);

  const auth = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const isSuperAdmin = useMemo(() => {
    return isSuperAdminEmail(user?.email);
  }, [user]);

  const handleAdminGoogleLogin = async () => {
    if (!auth) return;
    setIsSigningIn(true);
    clearAdminBackendLoginSessionFlag();
    try {
      await initiateGoogleSignIn(auth);
    } catch (error) {
      console.error('Admin Google sign-in failed:', error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleAdminSwitchAccount = async () => {
    if (!auth) return;
    setIsSigningIn(true);
    clearAdminBackendLoginSessionFlag();
    try {
      await signOut(auth);
      await initiateGoogleSignIn(auth);
    } catch (error) {
      console.error('Admin switch account failed:', error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const currentNav = useMemo(() => {
    const matches = sidebarNavItems.flatMap(s => s.items).filter(item =>
      item.href === pathname || (item.href !== '/admin' && pathname.startsWith(item.href + '/'))
    );
    return matches.sort((a, b) => b.href.length - a.href.length)[0];
  }, [pathname]);

  const currentCategory = useMemo(() => {
    if (!currentNav) return undefined;
    return sidebarNavItems.find(s => s.items.some(i => i.href === currentNav.href));
  }, [currentNav]);

  const { isAdmin: isHookAdmin, isLoading: isHookAdminLoading } = useIsAdmin();

  // 額外監聽 admins/{user.uid}
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "admins", user.uid);
  }, [firestore, user]);
  const { data: adminDoc } = useDoc<any>(adminDocRef);

  // 額外監聽以 email 為鍵名之 admins/{email}
  const cleanEmail = user?.email?.toLowerCase().trim();
  const adminEmailDocRef = useMemoFirebase(() => {
    if (!firestore || !cleanEmail) return null;
    return doc(firestore, "admins", cleanEmail);
  }, [firestore, cleanEmail]);
  const { data: adminEmailDoc } = useDoc<any>(adminEmailDocRef);

  // 統合計算 effectivePermissions：三路完整判定
  const effectivePermissions: string[] | undefined = useMemo(() => {
    if (isSuperAdmin) return undefined; // 超級管理員完全無任何模組限制
    if (userProfile?.permissions !== undefined && Array.isArray(userProfile.permissions)) {
      return userProfile.permissions;
    }
    if (adminDoc?.permissions !== undefined && Array.isArray(adminDoc.permissions)) {
      return adminDoc.permissions;
    }
    if (adminEmailDoc?.permissions !== undefined && Array.isArray(adminEmailDoc.permissions)) {
      return adminEmailDoc.permissions;
    }
    return undefined; // 若皆未特別設定限制，則預設全模組通行
  }, [isSuperAdmin, userProfile?.permissions, adminDoc?.permissions, adminEmailDoc?.permissions]);

  const isUserAdmin = Boolean(
    isSuperAdmin || 
    isHookAdmin ||
    userProfile?.role?.toLowerCase() === 'admin' || 
    userProfile?.role?.toLowerCase() === 'superadmin' ||
    userProfile?.isAdmin === true ||
    adminDoc?.isAdmin === true ||
    adminEmailDoc?.isAdmin === true
  );

  // 同步管理員操作稽核上下文 + 自動記錄管理員進入後台與後端 API 操作
  useEffect(() => {
    if (!user || !isUserAdmin || !firestore) {
      setAdminAuditFirestore(null);
      return;
    }

    setAdminAuditFirestore(firestore);

    const displayName =
      userProfile?.username ||
      adminDoc?.username ||
      user.displayName ||
      (user.email ? user.email.split('@')[0] : '管理員');

    updateAdminAuditContext({
      uid: user.uid,
      email: user.email || '',
      name: displayName,
      isSuperAdmin,
      routePath: pathname || '/admin',
    });

    // 自動記錄管理員進入後台（同步寫入操作日誌與登入紀錄，若新管理員權限文件尚在背景同步則自動重試）
    let cancelled = false;
    let retryTimer1: ReturnType<typeof setTimeout> | null = null;
    let retryTimer2: ReturnType<typeof setTimeout> | null = null;

    const triggerBackendLoginRecord = async () => {
      const ok = await recordAdminBackendLogin(firestore, {
        uid: user.uid,
        email: user.email || '',
        name: displayName,
        photoURL: user.photoURL || null,
        isSuperAdmin,
        routePath: pathname || '/admin',
      });
      if (!ok && !cancelled) {
        retryTimer1 = setTimeout(async () => {
          if (cancelled) return;
          const ok2 = await recordAdminBackendLogin(firestore, {
            uid: user.uid,
            email: user.email || '',
            name: displayName,
            photoURL: user.photoURL || null,
            isSuperAdmin,
            routePath: pathname || '/admin',
          });
          if (!ok2 && !cancelled) {
            retryTimer2 = setTimeout(() => {
              if (!cancelled) {
                void recordAdminBackendLogin(firestore, {
                  uid: user.uid,
                  email: user.email || '',
                  name: displayName,
                  photoURL: user.photoURL || null,
                  isSuperAdmin,
                  routePath: pathname || '/admin',
                });
              }
            }, 3000);
          }
        }, 1800);
      }
    };

    void triggerBackendLoginRecord();

    return () => {
      cancelled = true;
      if (retryTimer1) clearTimeout(retryTimer1);
      if (retryTimer2) clearTimeout(retryTimer2);
    };
  }, [user, isUserAdmin, isSuperAdmin, userProfile?.username, adminDoc?.username, pathname, firestore]);

  // 攔截管理員呼叫 /api/admin/* 的變更型操作 (POST / PUT / PATCH / DELETE)
  // 相容預覽環境或擴充套件將 window.fetch 設為唯讀 getter 的情況，避免拋出 TypeError
  useEffect(() => {
    if (!user || !isUserAdmin || !firestore || typeof window === 'undefined') return;

    const rawFetch = window.fetch;
    if (typeof rawFetch !== 'function') return;

    const boundOriginalFetch = rawFetch.bind(window);
    const wrappedFetch: typeof window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      let finalInit = init;
      try {
        const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
        if (urlStr.includes('/api/admin/') || urlStr.includes('/api/cron/')) {
          const headers = new Headers(init?.headers || {});
          if (!headers.has('Authorization')) {
            const token = await user.getIdToken();
            if (token) {
              headers.set('Authorization', `Bearer ${token}`);
              finalInit = { ...init, headers };
            }
          }
        }
      } catch {
        // ignore token attach error
      }
      const response = await boundOriginalFetch(input, finalInit);
      logAdminApiCall(input, finalInit, response, firestore);
      return response;
    };

    try {
      Object.assign(wrappedFetch, rawFetch);
    } catch {
      // ignore non-writable static properties on fetch
    }

    const ownDescriptor = Object.getOwnPropertyDescriptor(window, 'fetch');
    let installedViaDefineProperty = false;
    let installedViaAssignment = false;

    try {
      if (!ownDescriptor) {
        const proto = Object.getPrototypeOf(window);
        const protoDescriptor = proto ? Object.getOwnPropertyDescriptor(proto, 'fetch') : undefined;
        if (!protoDescriptor || protoDescriptor.writable || protoDescriptor.set) {
          window.fetch = wrappedFetch;
          installedViaAssignment = true;
        } else if (protoDescriptor.configurable !== false) {
          Object.defineProperty(window, 'fetch', {
            configurable: true,
            enumerable: true,
            writable: true,
            value: wrappedFetch,
          });
          installedViaDefineProperty = true;
        }
      } else if (ownDescriptor.writable || typeof ownDescriptor.set === 'function') {
        window.fetch = wrappedFetch;
        installedViaAssignment = true;
      } else if (ownDescriptor.configurable) {
        Object.defineProperty(window, 'fetch', {
          configurable: true,
          enumerable: ownDescriptor.enumerable ?? true,
          get: () => wrappedFetch,
        });
        installedViaDefineProperty = true;
      }
    } catch {
      // 若瀏覽器或預覽沙盒鎖定 window.fetch，由各頁面 adminFetch 接手記錄，不影響後台運作
    }

    return () => {
      try {
        if (installedViaDefineProperty) {
          if (ownDescriptor) {
            Object.defineProperty(window, 'fetch', ownDescriptor);
          } else {
            Reflect.deleteProperty(window, 'fetch');
          }
        } else if (installedViaAssignment) {
          window.fetch = rawFetch;
        }
      } catch {
        // ignore cleanup errors on locked window properties
      }
    };
  }, [user, isUserAdmin, firestore]);

  // 超級管理員無需等待載入即可通行；一般使用者等待 profile 與 hook 驗證完畢（若已確認管理員身分則直接放行）
  if (isUserLoading || (!isSuperAdmin && !isUserAdmin && (isProfileLoading || isHookAdminLoading))) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user || !isUserAdmin) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-center bg-slate-900/50 backdrop-blur-sm p-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 text-slate-900 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 mb-4 text-amber-600 shadow-sm">
            <ShieldAlert className="h-10 w-10" />
          </div>
          
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">管理員身分驗證</h1>
          
          <p className="text-slate-500 mt-2 text-xs sm:text-sm leading-relaxed max-w-xs">
            {user 
              ? `目前登入的帳號（${user.email || '未設定信箱'}）尚未具備管理員權限。請切換為指定之管理員信箱。` 
              : '您尚未登入管理員帳號，請點擊下方按鈕以 Google 快速登入管理員後台。'}
          </p>

          <div className="w-full space-y-2.5 mt-6">
            {!user ? (
              <Button 
                onClick={handleAdminGoogleLogin}
                disabled={isSigningIn}
                className="w-full h-11 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
              >
                <LogIn className="h-4 w-4 text-amber-400" />
                <span>{isSigningIn ? '正在驗證 Google 登入...' : '以 Google 登入管理員帳號'}</span>
              </Button>
            ) : (
              <div className="space-y-2 w-full">
                <Button 
                  onClick={handleAdminSwitchAccount}
                  disabled={isSigningIn}
                  className="w-full h-11 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <RefreshCw className={cn("h-4 w-4", isSigningIn && "animate-spin")} />
                  <span>{isSigningIn ? '切換中...' : '切換為其他 Google 管理員帳號'}</span>
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => auth && signOut(auth)}
                  className="w-full h-9 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-xs cursor-pointer"
                >
                  登出目前帳號
                </Button>
              </div>
            )}

            <Button asChild variant="ghost" className="w-full h-9 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100">
              <Link href="/">
                <Home className="mr-1.5 h-3.5 w-3.5" />
                返回前台首頁
              </Link>
            </Button>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 w-full text-center">
            <p className="text-[10px] text-slate-400">
              系統超級管理員：<span className="font-mono text-slate-600 font-semibold">pickcher123@gmail.com</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const pagePermission = sidebarNavItems
    .flatMap(s => s.items)
    .filter(i => i.href !== '/admin')
    .find(i => pathname === i.href || pathname.startsWith(i.href + '/'))
    ?.permission;

  const isDenied = Boolean(
    pagePermission && 
    !isSuperAdmin && 
    effectivePermissions !== undefined && 
    !effectivePermissions.includes(pagePermission)
  );

  if (isDenied) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-center bg-white p-6">
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 mb-4 shadow-sm">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <h1 className="text-xl font-black text-slate-900">模組授權不足</h1>
        <p className="text-slate-500 mt-2 text-xs max-w-sm leading-relaxed">
          您的管理員帳號尚未被授權存取此特定模組。請聯繫最高主管為您開通相應模組權限。
        </p>
        <Button asChild variant="outline" className="mt-6 rounded-xl text-xs font-bold border-slate-200">
          <Link href="/admin">返回管理儀表板</Link>
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
          <div className="px-3 pt-3 pb-1.5 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={navSearch}
                onChange={(e) => setNavSearch(e.target.value)}
                placeholder="快速搜尋功能模組..."
                className="w-full h-9 pl-9 pr-7 text-[13px] bg-slate-50 hover:bg-slate-100/80 focus:bg-white rounded-xl border border-slate-200 focus:border-slate-400 outline-none transition-colors placeholder:text-slate-400 text-slate-900"
              />
              {navSearch && (
                <button 
                  onClick={() => setNavSearch('')} 
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation List */}
        <ScrollArea className="flex-grow">
          <SidebarNav 
            isCollapsed={isCollapsed} 
            permissions={effectivePermissions} 
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
        <MobileHeader 
          permissions={effectivePermissions} 
          isSuperAdmin={isSuperAdmin}
          isMaintenanceActive={isMaintenanceActive}
        />
        
        {/* Desktop Header */}
        <header className="hidden md:flex h-14 items-center justify-between px-6 border-b border-slate-200/90 bg-white shrink-0">
          <div className="flex items-center gap-2.5 text-[13px] text-slate-500 font-medium min-w-0">
            <Link href="/admin" className="hover:text-slate-900 transition-colors shrink-0">控制台</Link>
            {currentCategory && (
              <>
                <span className="text-slate-300">/</span>
                <span className="shrink-0">{currentCategory.title}</span>
              </>
            )}
            {currentNav && currentNav.href !== '/admin' && (
              <>
                <span className="text-slate-300">/</span>
                <span className="font-bold text-slate-900 shrink-0">{currentNav.label}</span>
                {currentNav.desc && (
                  <span className="hidden lg:inline-block text-xs text-slate-400 font-normal truncate pl-2 border-l border-slate-200">
                    {currentNav.desc}
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs">
            {isMaintenanceActive && (
              <Link 
                href="/admin"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-800 text-[11px] font-black animate-pulse hover:bg-amber-500/25 transition-colors"
                title="目前全站處於維護模式，外部訪客已被全面阻斷"
              >
                <Wrench className="h-3.5 w-3.5 text-amber-600 animate-spin" />
                <span>🚧 全站維護模式運行中</span>
              </Link>
            )}

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
