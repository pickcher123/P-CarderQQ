'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth, useFirestore, initiateEmailSignIn, initiateEmailSignUp, initiateGoogleSignIn, initiatePasswordReset } from '@/firebase';
import { doc, getDoc, setDoc, serverTimestamp, query, collection, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { FirebaseError } from 'firebase/app';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Sparkles, ShieldCheck, LogIn, CheckCircle2, Terminal, Mail, Lock, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// Simple Google Icon SVG
const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px" {...props}>
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.519-3.354-11.088-7.974l-6.573,4.817C9.352,39.579,16.02,44,24,44z" />
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C44.577,34.238,48,27.42,48,20C48,17.222,47.34,14.561,46.126,12.126L39.95,17.7C42.45,19.645,43.611,20.083,43.611,20.083z" />
    </svg>
);

export default function LoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password states
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!resetDialogOpen) {
      setTimeout(() => {
        setResetEmail('');
        setResetSent(false);
        setIsResetting(false);
      }, 300);
    }
  }, [resetDialogOpen]);


  const getFirebaseErrorMessage = (error: FirebaseError) => {
    switch (error.code) {
        case 'auth/invalid-email':
            return '電子郵件格式不正確。';
        case 'auth/user-not-found':
             return '找不到此電子郵件對應的帳戶。';
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
             return '電子郵件或密碼不正確。';
        case 'auth/email-already-in-use':
            return '此電子郵件已被註冊。';
        case 'auth/weak-password':
            return '密碼強度不足，請至少設定 6 個字元。';
        case 'auth/popup-closed-by-user':
            return 'Google 登入視窗已關閉。';
        case 'auth/account-exists-with-different-credential':
            return '此電子郵件已透過其他方式註冊。請先用該方式登入後，至會員中心連結您的 Google 帳號。';
        case 'auth/unauthorized-domain':
            return '目前網域尚未授權。請管理員前往 Firebase Console 將當前網址加入「授權網域」清單中。';
        default:
            return `發生未知錯誤 (${error.code})，請聯絡管理員或稍後再試。`;
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    initiateEmailSignIn(auth, loginEmail, loginPassword)
      .then(() => {
        router.push('/profile');
      })
      .catch((error) => {
        if (error instanceof FirebaseError) {
          toast({
              variant: "destructive",
              title: "登入失敗",
              description: getFirebaseErrorMessage(error),
          })
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handlePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);
    initiatePasswordReset(auth, resetEmail)
      .then(() => {
        setResetSent(true);
        toast({
          title: "郵件已寄出",
          description: "重設密碼的連結已寄到您的信箱，請前往查看。",
        });
      })
      .catch((error) => {
        if (error instanceof FirebaseError) {
          toast({
            variant: "destructive",
            title: "重設失敗",
            description: getFirebaseErrorMessage(error),
          });
        }
      })
      .finally(() => {
        setIsResetting(false);
      });
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
        const result = await initiateGoogleSignIn(auth);
        const user = result.user;
        
        // 檢查 Firestore 是否已有會員資料
        const userRef = doc(firestore, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            // 第一次登入，建立初始資料
            await setDoc(userRef, {
                id: user.uid,
                username: user.displayName || user.email?.split('@')[0] || '新收藏家',
                email: user.email,
                photoURL: user.photoURL,
                role: 'user',
                points: 0,
                bonusPoints: 0,
                totalSpent: 0,
                userLevel: '新手收藏家',
                createdAt: serverTimestamp(),
            });
        }
        
        router.push('/profile');
    } catch (error) {
        if (error instanceof FirebaseError) {
            toast({
                variant: 'destructive',
                title: 'Google 登入失敗',
                description: getFirebaseErrorMessage(error),
            })
        }
    } finally {
        setIsLoading(false);
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerUsername.length > 20) {
        toast({
            variant: "destructive",
            title: "註冊失敗",
            description: "會員名稱長度不得超過 20 個字。",
        });
        return;
    }
    
    // 檢查名稱是否重複
    const q = query(collection(firestore, 'users'), where('username', '==', registerUsername));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        toast({
            variant: "destructive",
            title: "註冊失敗",
            description: "此會員名稱已被使用。",
        });
        return;
    }

    if (registerPassword !== registerConfirmPassword) {
        toast({
            variant: "destructive",
            title: "註冊失敗",
            description: "兩次輸入的密碼不一致，請重新確認。",
        });
        return;
    }

    setIsLoading(true);
    try {
        const result = await initiateEmailSignUp(auth, registerEmail, registerPassword);
        const user = result.user;
        
        // 建立會員 Firestore 文件
        const userRef = doc(firestore, 'users', user.uid);
        await setDoc(userRef, {
            id: user.uid,
            username: registerUsername || registerEmail.split('@')[0],
            email: registerEmail,
            role: 'user',
            points: 0,
            bonusPoints: 0,
            totalSpent: 0,
            userLevel: '新手收藏家',
            createdAt: serverTimestamp(),
        });
        
        toast({
            title: "註冊成功",
            description: "歡迎加入 P+Carder！",
        });
        router.push('/profile');
    } catch (error) {
        if (error instanceof FirebaseError) {
          toast({
              variant: "destructive",
              title: "註冊失敗",
              description: getFirebaseErrorMessage(error),
          })
        }
    } finally {
        setIsLoading(false);
    }
  };

  const [isRegistering, setIsRegistering] = useState(false);

  return (
    <div className="min-h-[100dvh] w-full flex flex-col justify-start items-center pt-10 sm:pt-16 p-4 sm:p-6 relative overflow-hidden bg-[#060913] text-white">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#06b6d408_1px,transparent_1px),linear-gradient(to_bottom,#06b6d408_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-60" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-cyan-500/15 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container - Lifted Upwards */}
      <div className="w-full max-w-[380px] relative z-10 flex flex-col items-center">
        
        {/* Title Only */}
        <div className="text-center mb-4 sm:mb-5">
          <h1 className="text-xl sm:text-2xl font-black font-headline tracking-tight text-white">
            {isRegistering ? '會員註冊' : '會員登入'}
          </h1>
        </div>

        {/* Auth Card */}
        <Card className="w-full border-cyan-500/25 bg-slate-900/90 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] rounded-2xl overflow-hidden border">
          <CardContent className="p-4 sm:p-5 space-y-3 sm:space-y-3.5">
            
            {/* Google Sign-in Button */}
            <Button 
              variant="outline" 
              className="w-full h-10.5 sm:h-11 rounded-xl bg-white text-slate-950 hover:bg-slate-100 border-none font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer"
              onClick={handleGoogleLogin} 
              disabled={isLoading}
            >
              <GoogleIcon className="h-4 w-4 shrink-0" />
              <span>使用 Google 快速登入</span>
            </Button>

            {/* Divider */}
            <div className="relative flex items-center justify-center py-0.5">
              <div className="w-full border-t border-white/10" />
              <span className="bg-slate-900 px-3 text-[10px] uppercase font-mono tracking-widest text-slate-500 shrink-0">
                或使用帳號密碼
              </span>
            </div>

            {isRegistering ? (
              <form onSubmit={handleRegister} className="space-y-2.5">
                <div className="space-y-1">
                  <Input 
                    placeholder="使用者暱稱" 
                    value={registerUsername} 
                    onChange={(e) => setRegisterUsername(e.target.value)} 
                    disabled={isLoading} 
                    className="h-9.5 bg-slate-950/60 border-white/10 text-white placeholder:text-slate-500 rounded-xl text-xs sm:text-sm focus:border-cyan-400" 
                  />
                </div>
                <div className="space-y-1">
                  <Input 
                    type="email" 
                    placeholder="電子郵件信箱" 
                    value={registerEmail} 
                    onChange={(e) => setRegisterEmail(e.target.value)} 
                    disabled={isLoading} 
                    className="h-9.5 bg-slate-950/60 border-white/10 text-white placeholder:text-slate-500 rounded-xl text-xs sm:text-sm focus:border-cyan-400" 
                  />
                </div>
                <div className="space-y-1">
                  <Input 
                    type="password" 
                    placeholder="設定密碼 (至少6位)" 
                    value={registerPassword} 
                    onChange={(e) => setRegisterPassword(e.target.value)} 
                    disabled={isLoading} 
                    className="h-9.5 bg-slate-950/60 border-white/10 text-white placeholder:text-slate-500 rounded-xl text-xs sm:text-sm focus:border-cyan-400" 
                  />
                </div>
                <div className="space-y-1">
                  <Input 
                    type="password" 
                    placeholder="再次確認密碼" 
                    value={registerConfirmPassword} 
                    onChange={(e) => setRegisterConfirmPassword(e.target.value)} 
                    disabled={isLoading} 
                    className="h-9.5 bg-slate-950/60 border-white/10 text-white placeholder:text-slate-500 rounded-xl text-xs sm:text-sm focus:border-cyan-400" 
                  />
                </div>
                <Button 
                  className="w-full h-10 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all active:scale-[0.98] cursor-pointer mt-1" 
                  type="submit" 
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>註冊新帳號</span>}
                </Button>
                <div className="text-center pt-1">
                  <button 
                    type="button" 
                    onClick={() => setIsRegistering(false)} 
                    className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    已有帳號？ <strong className="text-cyan-400 hover:underline">立即登入</strong>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-2.5">
                <div className="space-y-1">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <Input 
                      type="email" 
                      placeholder="電子郵件信箱" 
                      value={loginEmail} 
                      onChange={(e) => setLoginEmail(e.target.value)} 
                      disabled={isLoading} 
                      className="h-10 pl-9 bg-slate-950/60 border-white/10 text-white placeholder:text-slate-500 rounded-xl text-xs sm:text-sm focus:border-cyan-400" 
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <Input 
                      type="password" 
                      placeholder="登入密碼" 
                      value={loginPassword} 
                      onChange={(e) => setLoginPassword(e.target.value)} 
                      disabled={isLoading} 
                      className="h-10 pl-9 bg-slate-950/60 border-white/10 text-white placeholder:text-slate-500 rounded-xl text-xs sm:text-sm focus:border-cyan-400" 
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-[11px] px-0.5 pt-0.5">
                  <button 
                    type="button" 
                    onClick={() => setResetDialogOpen(true)} 
                    className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                  >
                    忘記密碼？
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsRegistering(true)} 
                    className="text-cyan-400 hover:underline font-bold transition-colors cursor-pointer"
                  >
                    註冊新帳號
                  </button>
                </div>

                <Button 
                  className="w-full h-10 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all active:scale-[0.98] cursor-pointer mt-1" 
                  type="submit" 
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>登入帳號</span>}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Back to Home Link */}
        <div className="mt-3.5 text-center">
          <Link 
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回首頁</span>
          </Link>
        </div>

      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="max-w-[min(90vw,360px)] rounded-2xl bg-[#080d1a] border border-cyan-500/30 p-5 text-white">
          <DialogHeader className="space-y-1 text-left pr-6">
            <DialogTitle className="text-lg font-black font-headline text-white">重設密碼</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              輸入註冊時使用的電子郵件信箱，我們將寄送密碼重設連結給您。
            </DialogDescription>
          </DialogHeader>

          {resetSent ? (
            <div className="py-4 text-center space-y-3">
              <div className="p-3 rounded-full bg-cyan-500/10 border border-cyan-500/30 inline-block text-cyan-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <p className="text-slate-300 text-xs">
                重設信件已發送至 <span className="font-bold text-cyan-300">{resetEmail}</span>，請前往您的信箱查看。
              </p>
              <Button 
                variant="outline" 
                onClick={() => setResetDialogOpen(false)} 
                className="w-full h-10 rounded-xl border-white/10 bg-slate-900 text-white hover:bg-slate-800 text-xs"
              >
                我知道了
              </Button>
            </div>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="reset-email" className="text-xs font-semibold text-slate-300">
                  電子信箱
                </Label>
                <Input
                  id="reset-email"
                  placeholder="name@example.com"
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  disabled={isResetting}
                  className="h-10 bg-slate-950/60 border-white/10 text-white rounded-xl focus:border-cyan-400 text-sm"
                />
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={isResetting || !resetEmail} 
                  className="w-full h-10.5 rounded-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 text-xs shadow-md"
                >
                  {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  發送重設密碼信件
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
