'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { User, LogIn, LogOut, ShieldCheck, Loader2, Package, Library, Plus, Users2, ChevronDown, Crown, Info, Sparkles, Wallet, Award, Trophy, Calendar, Gift, Ticket } from 'lucide-react';
import { Logo, CrossedCardsIcon, LuckyBagIcon, PPlusIcon, NavDrawIcon, NavCollectionIcon, DiamondIcon } from '@/components/icons';
import { useUser, useAuth, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/types/user-profile';
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { SystemConfig } from '@/types/system';
import { userLevels } from '@/components/member-level-crown';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { PurchasePointsDialog } from '@/components/purchase-points-dialog';
import { PromoRedeemModal } from '@/components/events/PromoRedeemModal';
import { syncLocalPromoClaimsToFirestore } from '@/lib/promo-draw-service';
import { useToast } from '@/hooks/use-toast';
import { useFeatureFlags } from '@/hooks/use-feature-flags';

const navLinks = [
  { href: '/draw', label: '抽卡', icon: Package, color: "text-cyan-400", flag: 'isDrawEnabled' },
  { href: '/bet', label: '拼卡', icon: CrossedCardsIcon, color: "text-rose-400", flag: 'isBettingEnabled' },
  { href: '/lucky-bags', label: '福袋', icon: LuckyBagIcon, color: "text-amber-400", flag: 'isLuckyBagEnabled' },
  { href: '/group-break', label: '團拆', icon: Users2, color: "text-emerald-400", flag: 'isGroupBreakEnabled' },
  { href: '/predictions', label: '賽事預測', icon: Trophy, color: "text-yellow-400", flag: 'isPredictionsEnabled' },
  { href: '/exhibitions', label: '卡展行事曆', icon: Calendar, color: "text-cyan-400", flag: 'isExhibitionsEnabled' },
  { href: '/collection', label: '收藏庫', icon: Library, color: "text-cyan-300/80" },
];

export function Header({ systemConfig }: { systemConfig: SystemConfig | null }) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const { isFeatureEnabled } = useFeatureFlags(systemConfig);

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/');
    }
  };

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  // 用戶登入時自動同步本地儲存之領券福利至 Firestore
  useEffect(() => {
    if (user && firestore) {
      syncLocalPromoClaimsToFirestore(firestore, user.uid).catch((e) => {
        console.warn('Auto sync promo claims in header warning:', e);
      });
    }
  }, [user, firestore]);
  
  const currentLevel = userProfile?.userLevel || '新手收藏家';
  const levelInfo = userLevels.find(l => l.level === currentLevel) || userLevels[0];
  const LevelIcon = levelInfo.icon || Award;
  const isHighTier = currentLevel === '傳奇收藏家' || currentLevel === 'P+卡神' || currentLevel === '殿堂級玩家' || currentLevel === '卡牌大師';

  return (
    <div className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#070b14]/85 backdrop-blur-2xl relative">
      {/* 頂部極光微光氛圍 */}
      <div className="absolute top-0 left-10 sm:left-1/4 w-48 sm:w-80 h-10 bg-cyan-500/10 blur-2xl pointer-events-none -z-10" />
      <div className="absolute top-0 right-10 sm:right-1/4 w-36 sm:w-64 h-10 bg-amber-500/10 blur-2xl pointer-events-none -z-10" />
      {/* 底部高科技細微霓虹線 */}
      <div className="absolute bottom-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent pointer-events-none" />

      <div className="container flex h-14 sm:h-16 items-center justify-between px-2 sm:px-4 md:px-8 gap-1 sm:gap-4">
        <div className="flex items-center shrink-0">
          <Logo className="text-primary shrink-0" />
          <nav className="ml-4 lg:ml-6 hidden items-center space-x-3 lg:space-x-4 xl:space-x-5 text-sm font-medium md:flex">
            {navLinks
                .filter(link => {
                    if (link.flag && !isFeatureEnabled(link.flag)) return false;
                    return true;
                })
                .map((link) => {
              const Icon = link.icon;
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-1.5 transition-all duration-300 hover:opacity-100 whitespace-nowrap",
                    isActive ? "text-foreground font-bold scale-105" : "text-muted-foreground opacity-70"
                  )}
                >
                  <Icon className={cn(
                    "h-4 w-4 transition-all duration-300", 
                    isActive ? link.color : "text-muted-foreground"
                  )} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-3 shrink-0">
            {user && userProfile?.role === 'admin' && (
              <Button variant="outline" size="sm" asChild className="hidden lg:flex h-8 px-3 rounded-xl border-destructive/40 text-destructive bg-destructive/5 hover:bg-destructive/15">
                <Link href="/admin">
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  管理後台
                </Link>
              </Button>
            )}

            {/* 🎁 免費領券按鈕 (移動至鑽石旁邊) */}
            <button
              type="button"
              id="header-free-ticket-btn"
              onClick={() => setIsPromoModalOpen(true)}
              className="relative flex items-center justify-center gap-1 sm:gap-1.5 h-8 sm:h-9 px-2 sm:px-3 rounded-full bg-gradient-to-r from-pink-500/20 via-rose-500/20 to-pink-500/15 border border-pink-500/40 hover:border-pink-400/80 shadow-[0_0_12px_rgba(244,63,94,0.2)] text-pink-300 hover:text-white transition-all duration-200 group cursor-pointer shrink-0"
              title="免費領券"
            >
              <div className="relative flex items-center justify-center">
                <Gift className="h-4 w-4 text-pink-400 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300" />
                {/* 手機版微型發光紅點 */}
                <span className="sm:hidden absolute -top-1 -right-1 w-2 h-2 rounded-full bg-pink-500 border border-pink-200 animate-pulse shadow-[0_0_6px_rgba(244,63,94,0.8)]" />
              </div>
              <span className="text-xs font-bold tracking-tight hidden sm:inline">免費領券</span>
              <span className="hidden sm:inline-block text-[9px] font-black px-1.5 py-0.5 rounded-full bg-pink-500/25 text-pink-200 border border-pink-400/40 leading-none shadow-sm">
                送券
              </span>
            </button>

            {/* 點數區塊 (電競晶鑽膠囊) */}
            {user && (
              <div className="flex items-center">
                <div className="flex items-center h-8 sm:h-9 bg-gradient-to-b from-slate-900/95 via-[#0b1324]/95 to-slate-950/95 rounded-full border border-cyan-500/40 shadow-[0_0_18px_rgba(6,182,212,0.22)] ring-1 ring-cyan-500/20 backdrop-blur-xl overflow-hidden group/capsule hover:border-cyan-400 hover:shadow-[0_0_22px_rgba(6,182,212,0.4)] transition-all duration-300">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button 
                        id="header-points-trigger"
                        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 h-full hover:bg-cyan-500/10 active:bg-cyan-500/20 transition-all duration-200 group outline-none"
                      >
                        <div className="relative flex items-center justify-center">
                          <DiamondIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 drop-shadow-[0_0_10px_rgba(34,211,238,0.9)] group-hover:scale-110 transition-transform duration-300" />
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-300 animate-ping opacity-75 pointer-events-none" />
                        </div>
                        <span className="font-mono font-black text-xs sm:text-sm text-cyan-200 tracking-tight drop-shadow truncate max-w-[55px] xs:max-w-[75px] sm:max-w-none">
                          {isProfileLoading ? '...' : (userProfile?.points ?? 0).toLocaleString()}
                        </span>
                        <ChevronDown className="h-3 w-3 text-cyan-400/70 group-hover:text-cyan-300 group-hover:translate-y-0.5 transition-all duration-200" />
                      </button>
                    </PopoverTrigger>
                    
                    <PopoverContent className="w-72 p-4 bg-[#090d19]/95 backdrop-blur-2xl border border-cyan-500/25 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] animate-in zoom-in-95 duration-200" align="end" sideOffset={10} collisionPadding={16}>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                          <div className="flex items-center gap-1.5">
                            <Wallet className="w-3.5 h-3.5 text-cyan-400" />
                            <p className="text-[11px] text-slate-300 font-bold tracking-wider">資產概覽</p>
                          </div>
                          <Badge variant="outline" className="text-[9px] font-black border-cyan-500/40 text-cyan-300 px-1.5 h-4.5 bg-cyan-500/10">
                            {userProfile?.userLevel || '新手收藏家'}
                          </Badge>
                        </div>

                        {/* 鑽石餘額 */}
                        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-cyan-500/20 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                              <DiamondIcon className="w-4 h-4 drop-shadow-[0_0_8px_rgba(34,211,238,0.7)]" />
                            </div>
                            <span className="text-xs font-semibold text-slate-300">鑽石餘額</span>
                          </div>
                          <span className="font-mono font-black text-base text-cyan-300">
                            {(userProfile?.points ?? 0).toLocaleString()}
                          </span>
                        </div>

                        {/* 紅利 P+ 點 */}
                        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-amber-500/20 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                              <PPlusIcon className="w-4 h-4 animate-pulse" />
                            </div>
                            <span className="text-xs font-semibold text-amber-300">紅利 P+ 點</span>
                          </div>
                          <span className="font-mono font-black text-base text-amber-300">
                            {(userProfile?.bonusPoints ?? 0).toLocaleString()}
                          </span>
                        </div>

                        {/* 加值按鈕 */}
                        <PurchasePointsDialog>
                          <Button 
                            id="popover-recharge-btn"
                            className="w-full h-9 rounded-xl font-black text-xs bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1 text-slate-950 stroke-[3]" /> 前往儲值 / 加值
                          </Button>
                        </PurchasePointsDialog>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* 快捷加值按鈕 (+) */}
                  <div className="border-l border-cyan-500/30 h-full flex items-center">
                    <PurchasePointsDialog>
                      <button 
                        id="header-add-points-btn"
                        title="立即加值"
                        className="h-full px-2.5 sm:px-3 flex items-center justify-center bg-gradient-to-r from-cyan-500/20 to-blue-600/25 hover:from-cyan-500/40 hover:to-blue-600/45 active:bg-cyan-500/50 text-cyan-300 hover:text-white transition-all group outline-none"
                      >
                        <Plus className="h-3.5 w-3.5 group-hover:scale-125 transition-transform stroke-[2.5]" />
                      </button>
                    </PurchasePointsDialog>
                  </div>
                </div>
              </div>
            )}

          {/* 頭像區塊 (立體尊爵版) */}
          <div className="flex items-center">
              {isUserLoading ? (
                <div className="h-8 w-8 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : user ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <button 
                      id="header-avatar-trigger"
                      className="relative flex items-center justify-center p-0.5 rounded-full hover:scale-105 active:scale-95 transition-all duration-200 outline-none group ml-0.5 sm:ml-1"
                    >
                      {/* 頭像外圈霓虹光環 */}
                      <div className={cn(
                        "relative flex items-center justify-center rounded-full p-[2px] transition-all duration-300 shadow-[0_0_14px_rgba(6,182,212,0.25)] group-hover:shadow-[0_0_20px_rgba(6,182,212,0.5)]",
                        levelInfo.border,
                        levelInfo.glow,
                        "bg-gradient-to-br from-cyan-400/40 via-white/10 to-blue-900/60"
                      )}>
                        {/* 頭像主體 */}
                        <div className={cn(
                          "w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center overflow-hidden border border-black/60 shadow-inner bg-slate-900",
                          levelInfo.bg
                        )}>
                          {userProfile?.photoURL ? (
                            <img 
                              src={userProfile.photoURL} 
                              alt={userProfile.username || 'User'} 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <LevelIcon className={cn(
                              "w-4 h-4 sm:w-4.5 sm:h-4.5 drop-shadow-[0_0_8px_currentColor]",
                              levelInfo.color,
                              levelInfo.animate
                            )} />
                          )}
                        </div>

                        {/* 右下角等級微型皇冠角標 */}
                        <div className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-[#080d19] border border-cyan-500/40 shadow-[0_0_8px_rgba(0,0,0,0.8)]">
                          <Crown className={cn(
                            "w-2.5 h-2.5",
                            isHighTier ? "text-amber-400 fill-amber-400/40 animate-pulse" : "text-cyan-400"
                          )} />
                        </div>
                      </div>
                    </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent className="min-w-[240px] p-2 bg-[#090d19]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] animate-in zoom-in-95 duration-200" align="end" sideOffset={8}>
                      {/* 用戶資訊 Header */}
                      <DropdownMenuLabel className="font-normal p-2.5 pb-2">
                          <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center border p-0.5 shrink-0",
                                levelInfo.border,
                                levelInfo.bg
                              )}>
                                {userProfile?.photoURL ? (
                                  <img 
                                    src={userProfile.photoURL} 
                                    alt={userProfile.username || 'User'} 
                                    className="w-full h-full rounded-full object-cover" 
                                  />
                                ) : (
                                  <LevelIcon className={cn("w-5 h-5", levelInfo.color)} />
                                )}
                              </div>
                              <div className="flex flex-col min-w-0">
                                  <p className="text-xs font-black text-white truncate">{userProfile?.username || user.displayName || '球卡玩家'}</p>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-tighter px-1.5 h-4 border", levelInfo.border, levelInfo.color)}>
                                        {userProfile?.userLevel || '新手收藏家'}
                                    </Badge>
                                  </div>
                              </div>
                          </div>
                      </DropdownMenuLabel>

                      <DropdownMenuSeparator className="bg-white/10" />

                      {/* 🎪 活動與福利專區 */}
                      <div className="p-1 space-y-1">
                          <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>活動與福利專區</span>
                          </div>

                          {/* 賽事預測 */}
                          <DropdownMenuItem asChild className="rounded-xl cursor-pointer text-slate-200 hover:text-white focus:bg-amber-500/15 focus:text-amber-300 transition-colors">
                              <Link href="/predictions" className="flex items-center justify-between w-full py-1.5">
                                <div className="flex items-center">
                                  <Trophy className="mr-2.5 h-4 w-4 text-amber-400" />
                                  <span className="font-semibold text-xs">賽事預測</span>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  贏 P+ 點
                                </span>
                              </Link>
                          </DropdownMenuItem>

                          {/* 卡展行事曆 */}
                          <DropdownMenuItem asChild className="rounded-xl cursor-pointer text-slate-200 hover:text-white focus:bg-cyan-500/15 focus:text-cyan-300 transition-colors">
                              <Link href="/exhibitions" className="flex items-center justify-between w-full py-1.5">
                                <div className="flex items-center">
                                  <Calendar className="mr-2.5 h-4 w-4 text-cyan-400" />
                                  <span className="font-semibold text-xs">卡展行事曆</span>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                  全台展訊
                                </span>
                              </Link>
                          </DropdownMenuItem>

                          {/* 免費領券 / 兌換碼 */}
                          <DropdownMenuItem 
                              onClick={() => setIsPromoModalOpen(true)}
                              className="rounded-xl cursor-pointer text-slate-200 hover:text-white focus:bg-white/10 font-medium transition-colors py-1.5 flex items-center justify-between"
                          >
                              <div className="flex items-center">
                                <Gift className="mr-2.5 h-4 w-4 text-slate-400" />
                                <span className="text-xs">免費領券 / 兌換碼</span>
                              </div>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                兌換
                              </span>
                          </DropdownMenuItem>
                      </div>

                      <DropdownMenuSeparator className="bg-white/10" />

                      {/* 個人與系統選單 */}
                      <div className="p-1 space-y-0.5">
                          {userProfile?.role === 'admin' && (
                            <>
                              <DropdownMenuItem asChild className="rounded-xl focus:bg-destructive/15 focus:text-destructive text-destructive font-bold cursor-pointer">
                                  <Link href="/admin">
                                      <ShieldCheck className="mr-2.5 h-4 w-4" />
                                      <span>後台管理中心</span>
                                  </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild className="rounded-xl focus:bg-purple-500/15 focus:text-purple-300 text-purple-400 font-bold cursor-pointer">
                                  <Link href="/lucky-wheel">
                                      <Sparkles className="mr-2.5 h-4 w-4 text-purple-400" />
                                      <span>🎪 活動轉盤專區</span>
                                  </Link>
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem asChild className="rounded-xl cursor-pointer text-slate-200 focus:bg-white/10">
                              <Link href="/profile" className="font-medium text-xs"><User className="mr-2.5 h-4 w-4 text-cyan-400" />會員中心</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild className="rounded-xl cursor-pointer text-slate-200 focus:bg-white/10">
                              <Link href="/about" className="font-medium text-xs"><Info className="mr-2.5 h-4 w-4 text-slate-400" />關於我們</Link>
                          </DropdownMenuItem>
                      </div>

                      <DropdownMenuSeparator className="bg-white/10" />

                      <div className="p-1">
                          <DropdownMenuItem onClick={handleLogout} className="rounded-xl text-rose-400 focus:bg-rose-500/10 focus:text-rose-300 font-bold cursor-pointer text-xs">
                              <LogOut className="mr-2.5 h-4 w-4" />
                              登出帳戶
                          </DropdownMenuItem>
                      </div>
                    </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 sm:h-9 px-2.5 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/5">
                        <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-400" />
                        <span className="text-xs font-bold">活動福利</span>
                        <ChevronDown className="w-3 h-3 ml-1 text-slate-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="min-w-[220px] p-2 bg-[#090d19]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] animate-in zoom-in-95 duration-200" align="end" sideOffset={8}>
                      <DropdownMenuLabel className="text-xs font-bold text-slate-400 px-2.5 py-1.5">
                        🎪 活動與福利特區
                      </DropdownMenuLabel>
                      <DropdownMenuItem asChild className="rounded-xl cursor-pointer text-slate-200 focus:bg-amber-500/15 focus:text-amber-300">
                        <Link href="/predictions" className="flex items-center justify-between w-full py-1 font-medium">
                          <div className="flex items-center">
                            <Trophy className="mr-2.5 h-4 w-4 text-amber-400" />
                            <span className="text-xs">賽事預測</span>
                          </div>
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-md font-bold">贏P+點</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="rounded-xl cursor-pointer text-slate-200 focus:bg-cyan-500/15 focus:text-cyan-300">
                        <Link href="/exhibitions" className="flex items-center justify-between w-full py-1 font-medium">
                          <div className="flex items-center">
                            <Calendar className="mr-2.5 h-4 w-4 text-cyan-400" />
                            <span className="text-xs">卡展行事曆</span>
                          </div>
                          <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded-md font-bold">全台展訊</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setIsPromoModalOpen(true)} 
                        className="rounded-xl cursor-pointer text-slate-200 focus:bg-white/10 font-medium flex items-center justify-between py-1"
                      >
                        <div className="flex items-center">
                          <Gift className="mr-2.5 h-4 w-4 text-slate-400" />
                          <span className="text-xs">免費領券 / 兌換碼</span>
                        </div>
                        <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-1.5 py-0.5 rounded-md font-medium">兌換</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button asChild size="sm" className="h-8 sm:h-9 px-3 sm:px-4 rounded-xl font-bold bg-gradient-to-r from-primary to-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:brightness-110">
                    <Link href="/login">
                      <LogIn className="mr-1.5 h-4 w-4" />
                      登入
                    </Link>
                  </Button>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* 🎁 全站開幕領券中心 / 兌換碼彈窗 */}
      <PromoRedeemModal
        open={isPromoModalOpen}
        onOpenChange={setIsPromoModalOpen}
        onApplyReward={(targetEvent, freePlays) => {
          toast({
            title: '🎉 兌換成功！',
            description: `已成功兌換 ${freePlays} 次免費試玩機會！`,
          });
        }}
      />
    </div>
  );
}
