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
import { Loader2, Sparkles, ShieldCheck, LogIn, CheckCircle2, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <div className="relative min-h-screen flex flex-col items-center pt-8 px-4 bg-background text-foreground font-mono overflow-hidden">
      {/* 掃描線效果 */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,255,255,0.06),rgba(0,255,255,0.02),rgba(255,0,255,0.06))] z-50 bg-[length:100%_4px,3px_100%] opacity-20" />
      
      {/* 背景光暈 */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[150px] pointer-events-none animate-pulse" />

      <div className="w-full max-w-[400px] relative z-10 space-y-8 animate-in fade-in zoom-in duration-500 pt-16">
        <div className="text-center space-y-1">
            <h1 className="text-6xl font-black tracking-tighter text-primary drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]">P+Carder</h1>
            <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">初始化收藏協議</p>
        </div>

        <Card className="bg-card/80 border-border rounded-none shadow-md p-6">
            <CardContent className="p-0 space-y-6">
                <Button 
                    variant="outline" 
                    className="w-full h-14 rounded-none border-primary/50 text-primary hover:bg-primary/20 transition-all font-mono font-bold text-sm" 
                    onClick={handleGoogleLogin} 
                    disabled={isLoading}
                >
                    <GoogleIcon className="mr-3 h-6 w-6"/>
                    使用 Google 登入
                </Button>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-white/20" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-3 text-muted-foreground font-mono tracking-widest">
                            或
                        </span>
                    </div>
                </div>

                {isRegistering ? (
                    <form onSubmit={handleRegister} className="space-y-4">
                        <Input placeholder="使用者名稱" value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)} disabled={isLoading} className="h-12 bg-background border-input rounded-none text-sm" />
                        <Input type="email" placeholder="電子郵件" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} disabled={isLoading} className="h-12 bg-background border-input rounded-none text-sm" />
                        <Input type="password" placeholder="密碼" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} disabled={isLoading} className="h-12 bg-background border-input rounded-none text-sm" />
                        <Input type="password" placeholder="確認密碼" value={registerConfirmPassword} onChange={(e) => setRegisterConfirmPassword(e.target.value)} disabled={isLoading} className="h-12 bg-background border-input rounded-none text-sm" />
                        <Button className="w-full h-12 rounded-none font-black text-sm bg-primary text-primary-foreground hover:bg-primary/90" type="submit" disabled={isLoading}>註冊</Button>
                        <p className="text-xs text-center text-muted-foreground">已有帳戶？ <button type="button" onClick={() => setIsRegistering(false)} className="text-primary hover:underline">立即登入</button></p>
                    </form>
                ) : (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <Input type="email" placeholder="電子郵件" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} disabled={isLoading} className="h-12 bg-background border-input rounded-none text-sm" />
                        <Input type="password" placeholder="密碼" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} disabled={isLoading} className="h-12 bg-background border-input rounded-none text-sm" />
                        <Button className="w-full h-12 rounded-none font-black text-sm bg-primary text-primary-foreground hover:bg-primary/90" type="submit" disabled={isLoading}>登入</Button>
                        <div className="flex justify-between items-center text-xs">
                            <button type="button" onClick={() => setResetDialogOpen(true)} className="text-muted-foreground hover:text-primary">忘記密碼？</button>
                            <button type="button" onClick={() => setIsRegistering(true)} className="text-primary hover:underline">註冊新帳戶</button>
                        </div>
                    </form>
                )}
            </CardContent>
        </Card>
      </div>

       <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        {/* Dialog content ... same as before ... */}
        <DialogContent className="rounded-none bg-background border border-border p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-black font-mono italic text-primary">重設安全金鑰</DialogTitle>
          </DialogHeader>
          {resetSent ? (
            <div className="py-6 text-center space-y-4">
              <div className="p-4 rounded-full bg-primary/20 border border-primary inline-block">
                <CheckCircle2 className="h-12 w-12 text-primary" />
              </div>
              <p className="text-muted-foreground font-mono text-sm">重設密碼的郵件已寄至 <span className="font-bold text-foreground">{resetEmail}</span>，請檢查您的信箱。</p>
              <Button variant="outline" onClick={() => setResetDialogOpen(false)} className="w-full h-12 rounded-none border-border bg-background text-muted-foreground hover:bg-muted">我知道了</Button>
            </div>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-6">
              <DialogDescription className="text-muted-foreground font-mono text-xs">
                請輸入您註冊時使用的電子郵件地址，我們會寄送一封包含重設連結的郵件給您。
              </DialogDescription>
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                  電子郵件
                </Label>
                <Input
                  id="reset-email"
                  placeholder="USER@DOMAIN.COM"
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  disabled={isResetting}
                  className="h-12 bg-background border-input rounded-none focus:border-primary"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isResetting || !resetEmail} className="w-full h-14 rounded-none font-black bg-primary text-primary-foreground hover:bg-primary/90 border border-primary">
                   {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  傳送重設金鑰
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
