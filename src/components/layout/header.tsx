'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { User, LogIn, LogOut, ShieldCheck, Loader2, Package, Library, Plus, Users2, ChevronDown, Crown, Info, Sparkles, Wallet, Award } from 'lucide-react';
import { Logo, CrossedCardsIcon, LuckyBagIcon, PPlusIcon, NavDrawIcon, NavCollectionIcon, DiamondIcon } from '@/components/icons';
import { useUser, useAuth, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/types/user-profile';
import React from 'react';
import { cn } from '@/lib/utils';
import type { SystemConfig } from '@/types/system';
import { userLevels } from '@/components/member-level-crown';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { PurchasePointsDialog } from '@/components/purchase-points-dialog';

const navLinks = [
  { href: '/draw', label: '抽卡', icon: Package, color: "text-primary" },
  { href: '/bet', label: '拼卡', icon: CrossedCardsIcon, color: "text-destructive" },
  { href: '/lucky-bags', label: '福袋', icon: LuckyBagIcon, color: "text-accent" },
  { href: '/group-break', label: '團拆', icon: Users2, color: "text-green-400" },
  { href: '/collection', label: '收藏庫', icon: Library, color: "text-primary/70" },
  { href: '/profile', label: '會員中心', icon: Crown, color: "text-accent" },
  { href: '/about', label: '關於我們', icon: Info, color: "text-slate-400" },
];

export function Header({ systemConfig }: { systemConfig: SystemConfig | null }) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();

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
  
  const currentLevel = userProfile?.userLevel || '新手收藏家';
  const levelInfo = userLevels.find(l => l.level === currentLevel) || userLevels[0];
  const LevelIcon = levelInfo.icon || Award;
  const isHighTier = currentLevel === '傳奇收藏家' || currentLevel === 'P+卡神' || currentLevel === '殿堂級玩家' || currentLevel === '卡牌大師';

  return (
    <div className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#070b14]/90 backdrop-blur-2xl">
      <div className="container flex h-16 items-center px-3 sm:px-4 md:px-8">
        <div className="mr-auto flex items-center ml-1">
          <Logo className="text-primary" />
          <nav className="ml-6 hidden items-center space-x-6 text-sm font-medium md:flex">
            {navLinks
                .filter(link => {
                    if (link.href === '/draw' && systemConfig?.featureFlags?.isDrawEnabled === false) return false;
                    if (link.href === '/bet' && systemConfig?.featureFlags?.isBettingEnabled === false) return false;
                    if (link.href === '/lucky-bags' && systemConfig?.featureFlags?.isLuckyBagEnabled === false) return false;
                    if (link.href === '/group-break' && systemConfig?.featureFlags?.isGroupBreakEnabled === false) return false;
                    return true;
                })
                .map((link) => {
              const isActive = pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 transition-all duration-300 hover:opacity-100",
                    isActive ? "text-foreground font-bold scale-105" : "text-muted-foreground opacity-70"
                  )}
                >
                  <Icon className={cn(
                    "h-4 w-4 transition-all duration-300", 
                    isActive ? link.color : "text-muted-foreground",
                    link.href === '/profile' && isActive && "fill-accent/20"
                  )} />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="flex flex-1 items-center justify-end gap-2.5 sm:gap-4">
            {user && userProfile?.role === 'admin' && (
              <Button variant="outline" size="sm" asChild className="hidden lg:flex h-8 px-3 rounded-xl border-destructive/40 text-destructive bg-destructive/5 hover:bg-destructive/15">
                <Link href="/admin">
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  管理後台
                </Link>
              </Button>
            )}

            {/* 點數區塊 (優化版) */}
            {user && (
              <div className="flex items-center">
                <div className="flex items-center h-8 sm:h-9 bg-slate-900/90 rounded-full border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/10 backdrop-blur-xl overflow-hidden">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button 
                        id="header-points-trigger"
                        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 h-full hover:bg-cyan-500/10 active:bg-cyan-500/20 transition-all duration-200 group outline-none"
                      >
                        <div className="relative flex items-center justify-center">
                          <DiamondIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] group-hover:scale-110 transition-transform" />
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping opacity-60 pointer-events-none" />
                        </div>
                        <span className="font-mono font-extrabold text-[11px] sm:text-xs text-white tracking-tight drop-shadow truncate max-w-[75px] sm:max-w-none">
                          {isProfileLoading ? '...' : (userProfile?.points ?? 0).toLocaleString()}
                        </span>
                        <ChevronDown className="h-2.5 w-2.5 text-cyan-400/60 group-hover:text-cyan-400 group-hover:translate-y-0.5 transition-all" />
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
                  <div className="border-l border-cyan-500/20 h-full flex items-center">
                    <PurchasePointsDialog>
                      <button 
                        id="header-add-points-btn"
                        title="立即加值"
                        className="h-full px-2 sm:px-2.5 flex items-center justify-center bg-cyan-500/10 hover:bg-cyan-500/25 active:bg-cyan-500/35 text-cyan-400 hover:text-cyan-200 transition-all group outline-none"
                      >
                        <Plus className="h-3.5 w-3.5 group-hover:scale-125 transition-transform" />
                      </button>
                    </PurchasePointsDialog>
                  </div>
                </div>
              </div>
            )}

          {/* 頭像區塊 (優化版) */}
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
                      className="relative flex items-center justify-center p-0.5 rounded-full hover:scale-105 active:scale-95 transition-all duration-200 outline-none group ml-1"
                    >
                      {/* 頭像光暈外圈 */}
                      <div className={cn(
                        "relative flex items-center justify-center rounded-full p-[1.5px] transition-all duration-300",
                        levelInfo.border,
                        levelInfo.glow,
                        "bg-gradient-to-br from-white/20 via-transparent to-black/60"
                      )}>
                        {/* 頭像主體 */}
                        <div className={cn(
                          "w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center overflow-hidden border border-black/50 shadow-inner",
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

                        {/* 右下角等級微型角標 */}
                        <div className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-[#080d19] border border-white/20 shadow-md">
                          <Crown className={cn(
                            "w-2.5 h-2.5",
                            isHighTier ? "text-amber-400 fill-amber-400/40 animate-pulse" : "text-slate-400"
                          )} />
                        </div>
                      </div>
                    </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent className="min-w-[220px] p-2 bg-[#090d19]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)]" align="end" sideOffset={8}>
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

                      <div className="p-1 space-y-0.5">
                          {userProfile?.role === 'admin' && (
                              <DropdownMenuItem asChild className="rounded-xl focus:bg-destructive/15 focus:text-destructive text-destructive font-bold cursor-pointer">
                                  <Link href="/admin">
                                      <ShieldCheck className="mr-2.5 h-4 w-4" />
                                      <span>後台管理中心</span>
                                  </Link>
                              </DropdownMenuItem>
                          )}
                          <DropdownMenuItem asChild className="rounded-xl cursor-pointer text-slate-200 focus:bg-white/10">
                              <Link href="/profile" className="font-medium"><User className="mr-2.5 h-4 w-4 text-cyan-400" />會員中心</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild className="rounded-xl cursor-pointer text-slate-200 focus:bg-white/10 md:hidden">
                              <Link href="/about" className="font-medium"><Info className="mr-2.5 h-4 w-4 text-slate-400" />關於 P+Carder</Link>
                          </DropdownMenuItem>
                      </div>

                      <DropdownMenuSeparator className="bg-white/10" />

                      <div className="p-1">
                          <DropdownMenuItem onClick={handleLogout} className="rounded-xl text-rose-400 focus:bg-rose-500/10 focus:text-rose-300 font-bold cursor-pointer">
                              <LogOut className="mr-2.5 h-4 w-4" />
                              登出帳戶
                          </DropdownMenuItem>
                      </div>
                    </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button asChild size="sm" className="h-8 sm:h-9 px-3 sm:px-4 rounded-xl font-bold bg-gradient-to-r from-primary to-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:brightness-110">
                  <Link href="/login">
                    <LogIn className="mr-1.5 h-4 w-4" />
                    登入
                  </Link>
                </Button>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
