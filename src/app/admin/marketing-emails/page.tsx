'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import type { UserProfile } from '@/types/user-profile';
import { generateMarketingEmailHtml, EmailTemplateOptions } from '@/lib/email-templates';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Mail,
  Send,
  Sparkles,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Settings,
  HelpCircle,
  Eye,
  Smartphone,
  Monitor,
  RefreshCw,
  Search,
  UserCheck,
  Tag,
  Copy,
  Flame,
  Gift,
  Ticket,
  Trophy,
  Loader2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface SmtpSettingsState {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

const PRESET_TEMPLATES = [
  {
    id: 'carnival',
    name: '🎉 限時狂歡慶典',
    desc: '全館儲值加碼、限時抽卡折扣與紅利加倍',
    icon: Flame,
    subject: '🔥【限時狂歡】P+ 卡牌全館狂歡祭開跑！儲值最高送 30% 點數回饋！',
    preheader: '親愛的 {{username}}，限時 72 小時抽卡加碼，立即登入領取專屬禮！',
    heading: 'P+ 盛夏全館狂歡特惠',
    bannerImageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1000&q=80',
    contentHtml: `<p>親愛的 <strong>{{username}}</strong> 您好：</p>
<p>感謝您長期以來對 P+ 卡牌交易所的支持！為回饋廣大藏家，本週特別推出<strong>【全館狂歡限時活動】</strong>：</p>
<ul>
  <li>🔥 <strong>儲值加碼</strong>：全館單筆儲值滿額，立即額外贈送 20% 鑽石與 P+ 點數！</li>
  <li>🃏 <strong>限定卡池機率 UP</strong>：頂級球星簽名卡、限量 PSA10 評級卡出現機率大幅提升！</li>
  <li>🎟️ <strong>天天登入送</strong>：活動期間每日登入即可免費領取【免費抽卡券】乙張！</li>
</ul>
<p>活動時間僅限本週末，名額有限，立即前往平台參與狂歡！</p>`,
    buttonText: '立即前往狂歡抽卡',
    buttonUrl: 'https://card-platform.app/draw',
    promoCode: 'SUMMER2026',
    customFooterNote: '※ 活動優惠受條款約束，P+ 官方保留最終解釋與變更之權利。',
  },
  {
    id: 'new_pool',
    name: '🃏 全新卡池上架',
    desc: '熱門球星特卡、簽名卡與重磅最後賞發布',
    icon: Sparkles,
    subject: '✨【重磅登場】全新限定球星卡池現正熱抽中！夢幻特卡等你帶回家',
    preheader: '眾所期待的稀有特卡系列正式解鎖！最後賞限量珍藏不可錯過',
    heading: '全新頂級球星卡池 震撼上架',
    bannerImageUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1000&q=80',
    contentHtml: `<p>親愛的 <strong>{{username}}</strong>：</p>
<p>您關注的最新<strong>【P+ 傳奇球星珍藏卡池】</strong>已正式開放！</p>
<p>本期卡池亮點：</p>
<ul>
  <li>🌟 <strong>夢幻大獎</strong>：收錄現役頂尖球星限量 1 of 1 手簽卡與 Patch 實著球衣卡！</li>
  <li>🛡️ <strong>保底機制</strong>：連抽享雙倍紅利回饋，小賞卡亦可全額以 P+ 點數 Buy Back 回收！</li>
  <li>🎉 <strong>壓軸最後賞</strong>：抽完卡池最後一張卡片的幸運藏家，即可直接獲贈極稀有珍藏紀念卡！</li>
</ul>
<p>卡包數量有限，售完即止，快來試試您的好手氣！</p>`,
    buttonText: '前往搶抽限定卡池',
    buttonUrl: 'https://card-platform.app/draw',
    promoCode: 'NEWPOOLVIP',
    customFooterNote: '※ 卡池剩餘卡包數量以線上即時庫存為準。',
  },
  {
    id: 'free_ticket',
    name: '🎟️ 免費抽卡券發送',
    desc: '回饋會員發放專屬抽卡券與活動序號',
    icon: Ticket,
    subject: '🎁【專屬好禮】{{username}}，為您準備了免費抽卡券！立即登入領取',
    preheader: '點擊信件內專屬兌換序號，即刻免費開抽，絕不錯過好康！',
    heading: '會員尊榮專屬 免費好禮送達',
    bannerImageUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1000&q=80',
    contentHtml: `<p>親愛的 <strong>{{username}}</strong>（會員等級：{{level}}）：</p>
<p>我們很高興向您送上專屬的<strong>【免費抽卡回饋序號】</strong>！</p>
<p>您只需登入平台，前往「會員中心」輸入下方兌換序號，即可立即獲得免費抽卡券，並在標有「支援免費券」的指定卡池體驗 0 成本開獎！</p>
<p>好運不等人，快使用專屬兌換券開啟您的幸運卡盒吧！</p>`,
    buttonText: '登入會員中心領取',
    buttonUrl: 'https://card-platform.app/profile',
    promoCode: 'FREEPACK888',
    customFooterNote: '※ 免費抽卡券每組帳號限兌換一次，有效期限以兌換說明為準。',
  },
  {
    id: 'break_event',
    name: '🏆 賽事競猜 / 直播團拆',
    desc: '直播團拆開箱預告與重要賽事競猜活動',
    icon: Trophy,
    subject: '📢【直播預告】今晚 20:00 頂級卡盒現場團拆直播！賽事競猜同場加映',
    preheader: '鎖定官方直播間！多項大獎即時揭曉，還有直播限定抽獎好禮！',
    heading: 'P+ 頂級卡盒直播團拆 隆重開箱',
    bannerImageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=1000&q=80',
    contentHtml: `<p>親愛的 <strong>{{username}}</strong> 藏家：</p>
<p>本週<strong>【P+ 官方直播團拆 & 賽事競猜盛典】</strong>即將於今晚 20:00 準時在官方頻道登場！</p>
<ul>
  <li>🎥 <strong>高畫質直播開箱</strong>：即時揭曉各大稀有卡盒編號，誰能帶走全場最大賞？</li>
  <li>📊 <strong>熱門賽事競猜</strong>：參與體育競猜下注，精準命中即可贏得豐厚鑽石與點數！</li>
  <li>🎁 <strong>聊天室互動抽獎</strong>：直播中將隨機抽出幸運觀眾贈送限量卡牌周邊與免費券！</li>
</ul>
<p>準備好您的幸運號碼，我們今晚直播間不見不散！</p>`,
    buttonText: '查看團拆與賽事活動',
    buttonUrl: 'https://card-platform.app/group-break',
    promoCode: 'LIVE2026',
    customFooterNote: '※ 團拆位置數量有限，額滿即截止登記。',
  },
];

const MEMBER_LEVELS = [
  { id: '銅牌會員', label: '銅牌會員' },
  { id: '銀牌會員', label: '銀牌會員' },
  { id: '金牌會員', label: '金牌會員' },
  { id: '白金會員', label: '白金會員' },
  { id: '鑽石會員', label: '鑽石會員' },
  { id: '菁英VIP', label: '菁英VIP' },
];

function MarketingEmailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { user: authUser } = useUser();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'compose' | 'history' | 'settings'>('compose');

  // --- Compose State ---
  const [targetType, setTargetType] = useState<'all' | 'specific_users' | 'user_levels' | 'user_tags' | 'custom_emails'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customEmailsInput, setCustomEmailsInput] = useState('');

  // Email template data
  const [senderName, setSenderName] = useState('P+ 卡牌交易中心');
  const [subject, setSubject] = useState('🔥【限時狂歡】P+ 卡牌全館狂歡祭開跑！儲值最高送 30% 點數回饋！');
  const [preheader, setPreheader] = useState('親愛的 {{username}}，限時 72 小時抽卡加碼，立即登入領取專屬禮！');
  const [heading, setHeading] = useState('P+ 盛夏全館狂歡特惠');
  const [bannerImageUrl, setBannerImageUrl] = useState('https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1000&q=80');
  const [contentHtml, setContentHtml] = useState(PRESET_TEMPLATES[0].contentHtml);
  const [buttonText, setButtonText] = useState('立即前往狂歡抽卡');
  const [buttonUrl, setButtonUrl] = useState('https://card-platform.app/draw');
  const [promoCode, setPromoCode] = useState('SUMMER2026');
  const [customFooterNote, setCustomFooterNote] = useState('※ 活動優惠受條款約束，P+ 官方保留最終解釋與變更之權利。');
  const [currentTemplateId, setCurrentTemplateId] = useState<string>('carnival');

  // Preview & Device State
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // User search in Specific Members mode
  const [userSearchText, setUserSearchText] = useState('');

  // Test Email Modal
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Send Broadcast Modal & State
  const [isConfirmSendOpen, setIsConfirmSendOpen] = useState(false);
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);

  // --- SMTP Settings State ---
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettingsState>({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    fromName: 'P+ 卡牌交易中心',
    fromEmail: '',
  });
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [isVerifyingSmtp, setIsVerifyingSmtp] = useState(false);
  const [smtpVerifyStatus, setSmtpVerifyStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // History Details Modal
  const [viewingLog, setViewingLog] = useState<any>(null);

  // Query all users for audience selection
  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'));
  }, [firestore]);
  const { data: allUsers = [], isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);

  // Query Marketing Email Logs for history
  const logsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'marketingEmailLogs'), orderBy('createdAt', 'desc'));
  }, [firestore]);
  const { data: emailLogs = [], isLoading: isLoadingLogs } = useCollection<any>(logsQuery);

  // Load SMTP config from Firestore on mount
  useEffect(() => {
    if (!firestore) return;
    const fetchSmtpConfig = async () => {
      try {
        const docRef = doc(firestore, 'systemSettings', 'email');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSmtpSettings({
            host: data.host || 'smtp.gmail.com',
            port: data.port || 587,
            secure: data.secure || false,
            user: data.user || '',
            pass: data.pass || '',
            fromName: data.fromName || 'P+ 卡牌交易中心',
            fromEmail: data.fromEmail || '',
          });
        }
      } catch (err) {
        console.warn('Failed to load SMTP settings:', err);
      }
    };
    fetchSmtpConfig();
  }, [firestore]);

  // Handle URL param: ?targetUser=xxx
  useEffect(() => {
    const targetUserId = searchParams.get('targetUser');
    if (targetUserId) {
      setTargetType('specific_users');
      setSelectedUserIds([targetUserId]);
      toast({
        title: '已帶入指定會員',
        description: `已選取會員 ID: ${targetUserId} 作為發信對象。`,
      });
    }
    if (authUser?.email && !testEmail) {
      setTestEmail(authUser.email);
    }
  }, [searchParams, authUser]);

  // Extract all distinct tags from users
  const allUserTags = useMemo(() => {
    const set = new Set<string>();
    allUsers.forEach((u) => {
      if (u.tags && Array.isArray(u.tags)) {
        u.tags.forEach((t) => t && set.add(t));
      }
    });
    return Array.from(set);
  }, [allUsers]);

  // Filtered users in "Specific Users" mode
  const filteredUsers = useMemo(() => {
    if (!userSearchText.trim()) return allUsers.slice(0, 50);
    const lower = userSearchText.toLowerCase();
    return allUsers.filter(
      (u) =>
        u.email?.toLowerCase().includes(lower) ||
        u.username?.toLowerCase().includes(lower) ||
        u.realName?.toLowerCase().includes(lower) ||
        u.phone?.toLowerCase().includes(lower) ||
        u.id?.toLowerCase().includes(lower)
    );
  }, [allUsers, userSearchText]);

  // Calculate estimated audience count
  const estimatedCount = useMemo(() => {
    if (targetType === 'all') {
      return allUsers.filter((u) => u.email && u.email.includes('@')).length;
    }
    if (targetType === 'specific_users') {
      return selectedUserIds.length;
    }
    if (targetType === 'user_levels') {
      return allUsers.filter(
        (u) => u.email && u.email.includes('@') && u.userLevel && selectedLevels.includes(u.userLevel)
      ).length;
    }
    if (targetType === 'user_tags') {
      return allUsers.filter(
        (u) =>
          u.email &&
          u.email.includes('@') &&
          u.tags &&
          Array.isArray(u.tags) &&
          u.tags.some((t) => selectedTags.includes(t))
      ).length;
    }
    if (targetType === 'custom_emails') {
      const list = customEmailsInput
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter((s) => s.includes('@'));
      return new Set(list).size;
    }
    return 0;
  }, [targetType, allUsers, selectedUserIds, selectedLevels, selectedTags, customEmailsInput]);

  // Apply preset template
  const applyPresetTemplate = (t: typeof PRESET_TEMPLATES[0]) => {
    setCurrentTemplateId(t.id);
    setSubject(t.subject);
    setPreheader(t.preheader);
    setHeading(t.heading);
    setBannerImageUrl(t.bannerImageUrl);
    setContentHtml(t.contentHtml);
    setButtonText(t.buttonText);
    setButtonUrl(t.buttonUrl);
    setPromoCode(t.promoCode);
    setCustomFooterNote(t.customFooterNote);
    toast({
      title: `已載入模版：${t.name}`,
      description: '您可根據行銷需求隨時修改內容與主旨。',
    });
  };

  // Helper to insert placeholders into content
  const insertPlaceholder = (tag: string) => {
    setContentHtml((prev) => prev + ` ${tag} `);
    toast({
      title: '已插入動態標籤',
      description: `標籤 ${tag} 將在寄出時自動替換為收件者的真實資訊。`,
    });
  };

  // Live HTML generated preview
  const livePreviewHtml = useMemo(() => {
    const options: EmailTemplateOptions = {
      subject,
      preheader,
      senderName,
      heading,
      contentHtml,
      buttonText,
      buttonUrl,
      promoCode,
      bannerImageUrl,
      customFooterNote,
      userData: {
        username: '王大明 (範例)',
        email: 'wang@example.com',
        points: 8888,
        userLevel: '鑽石 VIP',
      },
      siteUrl: typeof window !== 'undefined' ? window.location.origin : 'https://card-platform.app',
    };
    return generateMarketingEmailHtml(options);
  }, [
    subject,
    preheader,
    senderName,
    heading,
    contentHtml,
    buttonText,
    buttonUrl,
    promoCode,
    bannerImageUrl,
    customFooterNote,
  ]);

  // --- Actions ---

  // 1. Send Test Email
  const handleSendTestEmail = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      toast({ title: '請填寫正確的測試收件信箱', variant: 'destructive' });
      return;
    }
    setIsSendingTest(true);
    try {
      const res = await fetch('/api/admin/send-marketing-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isTestEmail: true,
          testEmailAddress: testEmail.trim(),
          subject,
          preheader,
          senderName,
          heading,
          contentHtml,
          buttonText,
          buttonUrl,
          promoCode,
          bannerImageUrl,
          customFooterNote,
          templateType: currentTemplateId,
          smtpConfig: smtpSettings.host && smtpSettings.user ? smtpSettings : undefined,
          sentBy: authUser?.email || 'admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: '✅ 測試郵件已送出！',
          description: `已發送預覽信件至 ${testEmail}，請檢查收件匣或垃圾郵件匣。`,
        });
        setIsTestModalOpen(false);
      } else {
        toast({
          title: '❌ 測試發送失敗',
          description: data.error || '無法發送，請檢查 SMTP 設定。',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: '發送發生異常',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // 2. Launch Broadcast Email
  const handleLaunchBroadcast = async () => {
    if (!subject.trim()) {
      toast({ title: '請輸入郵件主旨', variant: 'destructive' });
      return;
    }
    if (estimatedCount === 0) {
      toast({ title: '受眾名單中沒有有效的收件會員', variant: 'destructive' });
      return;
    }

    setIsSendingBroadcast(true);
    try {
      let customEmailsList: string[] = [];
      if (targetType === 'custom_emails') {
        customEmailsList = customEmailsInput
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter((s) => s.includes('@'));
      }

      const res = await fetch('/api/admin/send-marketing-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          targetUserIds: targetType === 'specific_users' ? selectedUserIds : undefined,
          targetLevels: targetType === 'user_levels' ? selectedLevels : undefined,
          targetTags: targetType === 'user_tags' ? selectedTags : undefined,
          customEmails: targetType === 'custom_emails' ? customEmailsList : undefined,
          subject,
          preheader,
          senderName,
          heading,
          contentHtml,
          buttonText,
          buttonUrl,
          promoCode,
          bannerImageUrl,
          customFooterNote,
          templateType: currentTemplateId,
          smtpConfig: smtpSettings.host && smtpSettings.user ? smtpSettings : undefined,
          sentBy: authUser?.email || 'admin',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSendResult(data);
        toast({
          title: '🎉 行銷郵件發送完成！',
          description: `共發送給 ${data.sentCount} 位會員${data.failedCount > 0 ? ` (失敗 ${data.failedCount} 筆)` : ''}。`,
        });
        setIsConfirmSendOpen(false);
      } else {
        toast({
          title: '❌ 發送失敗',
          description: data.error || '請檢查寄件伺服器連線或名單設定。',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: '發送過程發生錯誤',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  // 3. Save SMTP Settings
  const handleSaveSmtpSettings = async () => {
    if (!firestore) return;
    setIsSavingSmtp(true);
    try {
      const docRef = doc(firestore, 'systemSettings', 'email');
      await setDoc(docRef, {
        ...smtpSettings,
        updatedAt: serverTimestamp(),
        updatedBy: authUser?.email || 'admin',
      });
      toast({
        title: '✅ 寄件伺服器設定已儲存',
        description: '後續系統發送行銷郵件將優先採用此配置。',
      });
    } catch (err: any) {
      toast({
        title: '儲存失敗',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSavingSmtp(false);
    }
  };

  // 4. Verify SMTP Connection
  const handleVerifySmtp = async () => {
    if (!smtpSettings.host || !smtpSettings.user || !smtpSettings.pass) {
      toast({
        title: '請先填寫完整資訊',
        description: '需填寫 SMTP Host、帳號與密碼才能進行連線測試。',
        variant: 'destructive',
      });
      return;
    }
    setIsVerifyingSmtp(true);
    setSmtpVerifyStatus(null);
    try {
      const res = await fetch('/api/admin/verify-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smtpConfig: smtpSettings }),
      });
      const data = await res.json();
      setSmtpVerifyStatus(data);
      if (data.success) {
        toast({
          title: '連線驗證成功！',
          description: 'SMTP 伺服器通訊正常，可以開始發信。',
        });
      } else {
        toast({
          title: '連線驗證失敗',
          description: data.error || '請檢查帳號密碼或伺服器主機設定。',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      setSmtpVerifyStatus({ success: false, message: err.message });
      toast({
        title: '驗證發生異常',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsVerifyingSmtp(false);
    }
  };

  // 5. Duplicate from Log
  const handleDuplicateFromLog = (log: any) => {
    setSubject(log.subject || '');
    setPreheader(log.preheader || '');
    setSenderName(log.senderName || 'P+ 卡牌交易中心');
    setHeading(log.heading || log.subject || '');
    setContentHtml(log.contentHtml || '');
    setButtonText(log.buttonText || '');
    setButtonUrl(log.buttonUrl || '');
    setPromoCode(log.promoCode || '');
    setBannerImageUrl(log.bannerImageUrl || '');
    setActiveTab('compose');
    toast({
      title: '已載入歷史草稿',
      description: '已切換至「撰寫與發送」頁籤，您可以進一步編輯後再次發送。',
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl border border-indigo-500/20 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                行銷郵件中心
                <Badge className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-bold">
                  Marketing Broadcast
                </Badge>
              </h1>
              <p className="text-sm text-slate-400 font-medium">
                向全體會員或指定受眾精準發送活動推廣、新卡池上架通知、限時優惠與專屬兌換序號
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 z-10">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab('settings')}
            className={cn(
              "border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-bold",
              !smtpSettings.user && "border-amber-500/50 text-amber-300 bg-amber-950/30"
            )}
          >
            <Settings className="w-4 h-4 mr-1.5" />
            {smtpSettings.user ? '伺服器設定 (已配置)' : '⚙️ 設定寄件伺服器 (未設定)'}
          </Button>
          <Button
            size="sm"
            onClick={() => setIsTestModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/25"
          >
            <Send className="w-4 h-4 mr-1.5" />
            發送測試信
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-6">
        <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-xl grid grid-cols-3 max-w-lg">
          <TabsTrigger value="compose" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-bold gap-1.5">
            <Mail className="w-4 h-4" /> 撰寫與發送
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-bold gap-1.5">
            <Clock className="w-4 h-4" /> 發送歷史紀錄 ({emailLogs.length})
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-bold gap-1.5">
            <Settings className="w-4 h-4" /> 寄件伺服器設定
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Compose & Send */}
        <TabsContent value="compose" className="space-y-6">
          {/* Preset Template Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PRESET_TEMPLATES.map((tpl) => {
              const Icon = tpl.icon;
              const isSelected = currentTemplateId === tpl.id;
              return (
                <div
                  key={tpl.id}
                  onClick={() => applyPresetTemplate(tpl)}
                  className={cn(
                    "p-4 rounded-xl border transition-all cursor-pointer select-none relative group",
                    isSelected
                      ? "bg-indigo-950/60 border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg shadow-indigo-500/10"
                      : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn(
                      "p-2 rounded-lg",
                      isSelected ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-400 group-hover:text-slate-200"
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm text-slate-200">{tpl.name}</span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{tpl.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Configuration & Content (7 Cols) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Step 1: Target Audience */}
              <Card className="bg-slate-900/90 border-slate-800 shadow-xl">
                <CardHeader className="pb-3 border-b border-slate-800">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-400" />
                      1. 選擇發送對象 (受眾)
                    </CardTitle>
                    <Badge variant="outline" className="bg-indigo-950/80 text-indigo-300 border-indigo-500/40 font-mono font-bold text-xs">
                      預估收件：{estimatedCount} 位
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <RadioGroup
                    value={targetType}
                    onValueChange={(val: any) => setTargetType(val)}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                  >
                    <Label
                      htmlFor="target-all"
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all",
                        targetType === 'all' ? "bg-indigo-950/50 border-indigo-500 text-white" : "bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/40"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <RadioGroupItem value="all" id="target-all" />
                        <div>
                          <p className="font-bold text-sm">全體會員廣播</p>
                          <p className="text-[11px] text-slate-400">發送給全平台註冊會員</p>
                        </div>
                      </div>
                      <Badge className="bg-slate-800 text-slate-300 text-[10px]">{allUsers.length} 人</Badge>
                    </Label>

                    <Label
                      htmlFor="target-specific"
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all",
                        targetType === 'specific_users' ? "bg-indigo-950/50 border-indigo-500 text-white" : "bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/40"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <RadioGroupItem value="specific_users" id="target-specific" />
                        <div>
                          <p className="font-bold text-sm">指定個別會員</p>
                          <p className="text-[11px] text-slate-400">自會員名單中搜尋勾選</p>
                        </div>
                      </div>
                      <Badge className="bg-indigo-900/60 text-indigo-300 text-[10px]">{selectedUserIds.length} 已選</Badge>
                    </Label>

                    <Label
                      htmlFor="target-levels"
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all",
                        targetType === 'user_levels' ? "bg-indigo-950/50 border-indigo-500 text-white" : "bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/40"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <RadioGroupItem value="user_levels" id="target-levels" />
                        <div>
                          <p className="font-bold text-sm">依會員等級篩選</p>
                          <p className="text-[11px] text-slate-400">如鑽石會員、白金VIP等</p>
                        </div>
                      </div>
                    </Label>

                    <Label
                      htmlFor="target-tags"
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all",
                        targetType === 'user_tags' ? "bg-indigo-950/50 border-indigo-500 text-white" : "bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/40"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <RadioGroupItem value="user_tags" id="target-tags" />
                        <div>
                          <p className="font-bold text-sm">依用戶標籤篩選</p>
                          <p className="text-[11px] text-slate-400">自訂標籤群組 (Tags)</p>
                        </div>
                      </div>
                    </Label>

                    <Label
                      htmlFor="target-custom"
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all sm:col-span-2",
                        targetType === 'custom_emails' ? "bg-indigo-950/50 border-indigo-500 text-white" : "bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/40"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <RadioGroupItem value="custom_emails" id="target-custom" />
                        <div>
                          <p className="font-bold text-sm">手動輸入自訂 Email 清單</p>
                          <p className="text-[11px] text-slate-400">自由貼上多組 Email 信箱</p>
                        </div>
                      </div>
                    </Label>
                  </RadioGroup>

                  {/* Sub-selector for Specific Users */}
                  {targetType === 'specific_users' && (
                    <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <Input
                            placeholder="搜尋會員帳號、姓名、Email 或手機..."
                            value={userSearchText}
                            onChange={(e) => setUserSearchText(e.target.value)}
                            className="pl-9 bg-slate-900 border-slate-800 h-9 text-xs"
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedUserIds([])}
                          disabled={selectedUserIds.length === 0}
                          className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 h-9"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> 清空已選
                        </Button>
                      </div>

                      <ScrollArea className="h-44 border border-slate-800 rounded-lg p-2 bg-slate-900/50">
                        {isLoadingUsers ? (
                          <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                            <Loader2 className="w-4 h-4 animate-spin mr-2" /> 載入會員資料中...
                          </div>
                        ) : filteredUsers.length === 0 ? (
                          <div className="text-center py-6 text-slate-500 text-xs font-medium">查無符合的會員</div>
                        ) : (
                          <div className="space-y-1">
                            {filteredUsers.map((u) => {
                              const isChecked = selectedUserIds.includes(u.id);
                              return (
                                <div
                                  key={u.id}
                                  onClick={() => {
                                    if (isChecked) {
                                      setSelectedUserIds(selectedUserIds.filter((id) => id !== u.id));
                                    } else {
                                      setSelectedUserIds([...selectedUserIds, u.id]);
                                    }
                                  }}
                                  className={cn(
                                    "flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors",
                                    isChecked ? "bg-indigo-950/80 text-white font-bold" : "hover:bg-slate-800/60 text-slate-300"
                                  )}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Checkbox checked={isChecked} />
                                    <span className="truncate font-semibold">{u.username || u.realName || '未命名'}</span>
                                    <span className="text-slate-400 text-[11px] font-mono truncate">{u.email || '無Email'}</span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Badge variant="outline" className="text-[10px] border-slate-700 bg-slate-800 text-slate-300">
                                      {u.userLevel || '會員'}
                                    </Badge>
                                    <span className="text-amber-400 font-mono text-[11px] font-bold">{u.points ?? 0} 鑽</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </ScrollArea>
                    </div>
                  )}

                  {/* Sub-selector for Member Levels */}
                  {targetType === 'user_levels' && (
                    <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                      <p className="text-xs text-slate-400 font-bold mb-2">勾選目標會員等級：</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {MEMBER_LEVELS.map((lvl) => {
                          const isChecked = selectedLevels.includes(lvl.id);
                          return (
                            <label
                              key={lvl.id}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none",
                                isChecked ? "bg-indigo-950/80 border-indigo-500 text-white font-bold" : "bg-slate-900 border-slate-800 text-slate-300"
                              )}
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(c) => {
                                  if (c) setSelectedLevels([...selectedLevels, lvl.id]);
                                  else setSelectedLevels(selectedLevels.filter((l) => l !== lvl.id));
                                }}
                              />
                              <span>{lvl.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sub-selector for Tags */}
                  {targetType === 'user_tags' && (
                    <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                      <p className="text-xs text-slate-400 font-bold mb-2">選擇目標會員標籤：</p>
                      {allUserTags.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">目前尚未在會員名單中建立標籤，請先至會員管理頁為用戶新增標籤。</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {allUserTags.map((tag) => {
                            const isChecked = selectedTags.includes(tag);
                            return (
                              <Badge
                                key={tag}
                                onClick={() => {
                                  if (isChecked) setSelectedTags(selectedTags.filter((t) => t !== tag));
                                  else setSelectedTags([...selectedTags, tag]);
                                }}
                                className={cn(
                                  "cursor-pointer px-3 py-1 text-xs select-none transition-all",
                                  isChecked
                                    ? "bg-indigo-600 text-white border-indigo-400 font-bold shadow-md"
                                    : "bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500"
                                )}
                              >
                                <Tag className="w-3 h-3 mr-1" />
                                {tag}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sub-selector for Custom Emails */}
                  {targetType === 'custom_emails' && (
                    <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                      <Label className="text-xs text-slate-400 font-bold">手動輸入 Email 清單（以逗號或換行分隔）：</Label>
                      <Textarea
                        placeholder="user1@example.com&#10;user2@example.com&#10;vip@card.app"
                        value={customEmailsInput}
                        onChange={(e) => setCustomEmailsInput(e.target.value)}
                        className="bg-slate-900 border-slate-800 text-xs font-mono h-24"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Step 2: Email Content Editor */}
              <Card className="bg-slate-900/90 border-slate-800 shadow-xl">
                <CardHeader className="pb-3 border-b border-slate-800">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      2. 編輯郵件內容與排版
                    </CardTitle>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">變數標籤：</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => insertPlaceholder('{{username}}')}
                        className="h-6 px-1.5 text-[10px] bg-slate-800 border-slate-700 text-indigo-300 hover:text-white"
                      >
                        +會員名
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => insertPlaceholder('{{points}}')}
                        className="h-6 px-1.5 text-[10px] bg-slate-800 border-slate-700 text-amber-300 hover:text-white"
                      >
                        +點數
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => insertPlaceholder('{{level}}')}
                        className="h-6 px-1.5 text-[10px] bg-slate-800 border-slate-700 text-cyan-300 hover:text-white"
                      >
                        +等級
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-300 font-bold">寄件人顯示名稱</Label>
                      <Input
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        placeholder="例：P+ 卡牌交易中心"
                        className="bg-slate-950 border-slate-800 text-xs h-9 text-slate-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-300 font-bold">信箱預覽摘要 (Preheader)</Label>
                      <Input
                        value={preheader}
                        onChange={(e) => setPreheader(e.target.value)}
                        placeholder="收件匣列表中顯示的副標題摘要"
                        className="bg-slate-950 border-slate-800 text-xs h-9 text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300 font-bold">
                      郵件主旨 (Subject) <span className="text-rose-400">*</span>
                    </Label>
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="請輸入引人入勝的信件標題..."
                      className="bg-slate-950 border-slate-800 text-sm h-10 font-bold text-slate-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-300 font-bold">信件內文主標題</Label>
                      <Input
                        value={heading}
                        onChange={(e) => setHeading(e.target.value)}
                        placeholder="信件頂部大標題"
                        className="bg-slate-950 border-slate-800 text-xs h-9 text-slate-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-300 font-bold">宣傳圖片 URL (選填)</Label>
                      <Input
                        value={bannerImageUrl}
                        onChange={(e) => setBannerImageUrl(e.target.value)}
                        placeholder="https://..."
                        className="bg-slate-950 border-slate-800 text-xs h-9 text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300 font-bold">內文內容 (支援 HTML 標籤與段落)</Label>
                    <Textarea
                      rows={6}
                      value={contentHtml}
                      onChange={(e) => setContentHtml(e.target.value)}
                      placeholder="輸入信件詳細說明..."
                      className="bg-slate-950 border-slate-800 text-xs leading-relaxed font-mono text-slate-200"
                    />
                  </div>

                  <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
                    <p className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5" /> 優惠碼與行動按鈕設定 (CTA)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-400">專屬兌換序號</Label>
                        <Input
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value)}
                          placeholder="例：SUMMER2026"
                          className="bg-slate-900 border-slate-800 text-xs h-8 font-mono text-amber-300"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-400">按鈕文字</Label>
                        <Input
                          value={buttonText}
                          onChange={(e) => setButtonText(e.target.value)}
                          placeholder="例：立即前往抽卡"
                          className="bg-slate-900 border-slate-800 text-xs h-8 text-slate-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-400">按鈕跳轉網址</Label>
                        <Input
                          value={buttonUrl}
                          onChange={(e) => setButtonUrl(e.target.value)}
                          placeholder="https://..."
                          className="bg-slate-900 border-slate-800 text-xs h-8 text-slate-200"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300 font-bold">底部免責聲明 / 備註說明 (選填)</Label>
                    <Input
                      value={customFooterNote}
                      onChange={(e) => setCustomFooterNote(e.target.value)}
                      placeholder="例：※ 活動優惠受條款約束，P+ 官方保留最終解釋之權利。"
                      className="bg-slate-950 border-slate-800 text-xs h-8 text-slate-400"
                    />
                  </div>
                </CardContent>
                <CardFooter className="pt-3 pb-4 border-t border-slate-800 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsTestModalOpen(true)}
                    className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                    發送單筆測試信
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setIsConfirmSendOpen(true)}
                    disabled={estimatedCount === 0 || !subject.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-6 shadow-lg shadow-emerald-600/20"
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    確認並廣播發信 ({estimatedCount} 人)
                  </Button>
                </CardFooter>
              </Card>

            </div>

            {/* Right Column: Live Email Preview (5 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="bg-slate-900/90 border-slate-800 shadow-xl sticky top-20">
                <CardHeader className="pb-3 border-b border-slate-800">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <Eye className="w-4 h-4 text-cyan-400" />
                      實時信件排版預覽
                    </CardTitle>
                    <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPreviewDevice('desktop')}
                        className={cn(
                          "h-6 px-2 text-[10px] font-bold rounded",
                          previewDevice === 'desktop' ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                        )}
                      >
                        <Monitor className="w-3 h-3 mr-1" /> 電腦
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPreviewDevice('mobile')}
                        className={cn(
                          "h-6 px-2 text-[10px] font-bold rounded",
                          previewDevice === 'mobile' ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                        )}
                      >
                        <Smartphone className="w-3 h-3 mr-1" /> 手機
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-3 bg-slate-950 flex justify-center">
                  <div
                    className={cn(
                      "transition-all duration-300 rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-[#0b0f19]",
                      previewDevice === 'desktop' ? "w-full" : "w-[340px]"
                    )}
                  >
                    {/* Simulated Browser / Email Client Header */}
                    <div className="bg-slate-900 px-3 py-2 border-b border-slate-800 flex items-center gap-2 text-[10px] text-slate-400">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      </div>
                      <span className="truncate font-mono font-medium text-slate-300 ml-1">
                        主旨: {subject || '(無主旨)'}
                      </span>
                    </div>

                    <iframe
                      srcDoc={livePreviewHtml}
                      title="Live Email Preview"
                      className={cn(
                        "w-full border-0 bg-[#0b0f19]",
                        previewDevice === 'desktop' ? "h-[580px]" : "h-[520px]"
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: History & Logs */}
        <TabsContent value="history" className="space-y-4">
          <Card className="bg-slate-900/90 border-slate-800 shadow-xl">
            <CardHeader className="pb-3 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    行銷郵件發送紀錄
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    檢視過往所有群發與定向行銷信件之發送結果、成功人數與錯誤明細
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {isLoadingLogs ? (
                <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin mr-2 text-indigo-400" /> 載入歷史日誌中...
                </div>
              ) : emailLogs.length === 0 ? (
                <div className="text-center py-16 text-slate-500 space-y-2">
                  <Mail className="w-12 h-12 mx-auto text-slate-700" />
                  <p className="text-sm font-bold text-slate-400">尚未有任何行銷郵件發送紀錄</p>
                  <p className="text-xs text-slate-600">前往「撰寫與發送」頁籤送出您的第一封會員行銷信吧！</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-950/60">
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400 font-bold text-xs">發送時間</TableHead>
                      <TableHead className="text-slate-400 font-bold text-xs">郵件主旨</TableHead>
                      <TableHead className="text-slate-400 font-bold text-xs">目標受眾</TableHead>
                      <TableHead className="text-slate-400 font-bold text-xs text-center">成功 / 總數</TableHead>
                      <TableHead className="text-slate-400 font-bold text-xs">發送人員</TableHead>
                      <TableHead className="text-slate-400 font-bold text-xs">狀態</TableHead>
                      <TableHead className="text-slate-400 font-bold text-xs text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailLogs.map((log) => {
                      const dateText = log.createdAt?.toDate
                        ? format(log.createdAt.toDate(), 'yyyy/MM/dd HH:mm')
                        : log.createdAt
                        ? format(new Date(log.createdAt), 'yyyy/MM/dd HH:mm')
                        : '-';

                      return (
                        <TableRow key={log.id} className="border-slate-800/60 hover:bg-slate-800/40 text-xs">
                          <TableCell className="font-mono text-slate-400">{dateText}</TableCell>
                          <TableCell className="font-bold text-slate-200 max-w-[220px] truncate">
                            {log.subject}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] border-slate-700 bg-slate-800 text-slate-300">
                              {log.targetSummary || log.targetType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-mono">
                            <span className="text-emerald-400 font-bold">{log.sentCount ?? 0}</span>
                            <span className="text-slate-500"> / {log.totalRecipients ?? 0}</span>
                            {log.failedCount > 0 && (
                              <span className="text-rose-400 text-[10px] ml-1.5 font-bold">
                                (敗 {log.failedCount})
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-400 font-mono text-[11px] truncate max-w-[120px]">
                            {log.sentBy || 'admin'}
                          </TableCell>
                          <TableCell>
                            {log.status === 'success' ? (
                              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                                全部成功
                              </Badge>
                            ) : log.status === 'partial' ? (
                              <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                                部分成功
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                                發送失敗
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setViewingLog(log)}
                              className="h-7 px-2 text-[11px] text-indigo-300 hover:text-white hover:bg-indigo-950/40"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> 查看
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDuplicateFromLog(log)}
                              className="h-7 px-2 text-[11px] text-amber-300 hover:text-white hover:bg-amber-950/40"
                            >
                              <Copy className="w-3.5 h-3.5 mr-1" /> 再次編輯
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: SMTP Settings */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Settings Form (7 Cols) */}
            <div className="lg:col-span-7">
              <Card className="bg-slate-900/90 border-slate-800 shadow-xl">
                <CardHeader className="pb-3 border-b border-slate-800">
                  <CardTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-indigo-400" />
                    寄件伺服器 (SMTP) 設定
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    配置用於向會員發送信件的 SMTP 郵件伺服器帳號與連線資訊
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label className="text-xs text-slate-300 font-bold">SMTP 主機 (Host)</Label>
                      <Input
                        value={smtpSettings.host}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                        placeholder="例：smtp.gmail.com 或 smtp.sendgrid.net"
                        className="bg-slate-950 border-slate-800 text-xs h-9 text-slate-100 font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-300 font-bold">連接埠 (Port)</Label>
                      <Input
                        type="number"
                        value={smtpSettings.port}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, port: Number(e.target.value) })}
                        placeholder="587 或 465"
                        className="bg-slate-950 border-slate-800 text-xs h-9 text-slate-100 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-200">SSL / TLS 安全加密連線</p>
                      <p className="text-[10px] text-slate-400">若使用 Port 465 請開啟，Port 587 (STARTTLS) 請關閉</p>
                    </div>
                    <Switch
                      checked={smtpSettings.secure}
                      onCheckedChange={(checked) => setSmtpSettings({ ...smtpSettings, secure: checked })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-300 font-bold">帳號 (SMTP User / Email)</Label>
                      <Input
                        value={smtpSettings.user}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, user: e.target.value })}
                        placeholder="例：your-email@gmail.com"
                        className="bg-slate-950 border-slate-800 text-xs h-9 text-slate-100 font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-300 font-bold">密碼 (SMTP Password / 應用程式密碼)</Label>
                      <Input
                        type="password"
                        value={smtpSettings.pass}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, pass: e.target.value })}
                        placeholder="••••••••••••••••"
                        className="bg-slate-950 border-slate-800 text-xs h-9 text-slate-100 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-300 font-bold">預設寄件人名稱 (From Name)</Label>
                      <Input
                        value={smtpSettings.fromName}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, fromName: e.target.value })}
                        placeholder="例：P+ 卡牌交易中心"
                        className="bg-slate-950 border-slate-800 text-xs h-9 text-slate-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-300 font-bold">預設寄件信箱 (From Email)</Label>
                      <Input
                        value={smtpSettings.fromEmail}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, fromEmail: e.target.value })}
                        placeholder="留空則預設使用 SMTP 帳號"
                        className="bg-slate-950 border-slate-800 text-xs h-9 text-slate-100 font-mono"
                      />
                    </div>
                  </div>

                  {/* Verification result alert */}
                  {smtpVerifyStatus && (
                    <div
                      className={cn(
                        "p-3 rounded-xl border text-xs flex items-start gap-2",
                        smtpVerifyStatus.success
                          ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
                          : "bg-rose-950/60 border-rose-500/50 text-rose-300"
                      )}
                    >
                      {smtpVerifyStatus.success ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                      )}
                      <div>
                        <p className="font-bold">{smtpVerifyStatus.success ? '連線測試成功' : '連線測試失敗'}</p>
                        <p className="text-[11px] opacity-90 mt-0.5">{smtpVerifyStatus.message}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="pt-3 pb-4 border-t border-slate-800 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleVerifySmtp}
                    disabled={isVerifyingSmtp}
                    className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                  >
                    {isVerifyingSmtp ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> 測試連線中...</>
                    ) : (
                      <><ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-cyan-400" /> 測試 SMTP 連線</>
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveSmtpSettings}
                    disabled={isSavingSmtp}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 px-5"
                  >
                    {isSavingSmtp ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> 儲存中...</>
                    ) : (
                      '💾 儲存伺服器設定'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </div>

            {/* Help Guide (5 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="bg-slate-900/90 border-slate-800 shadow-xl">
                <CardHeader className="pb-3 border-b border-slate-800">
                  <CardTitle className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-amber-400" />
                    常用發信伺服器設定教學
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4 text-xs text-slate-300 leading-relaxed">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <p className="font-bold text-amber-300 flex items-center gap-1.5">
                      📮 使用 Gmail 免費發信（推薦）
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400">
                      <li>登入 Google 帳戶 ➜ 前往「安全性」➜ 開啟「兩步驟驗證」。</li>
                      <li>搜尋並進入「應用程式密碼 (App Passwords)」。</li>
                      <li>新增一組應用程式密碼（例如命名為 P+ Card）。</li>
                      <li>將產生的 16 位英文字母密碼複製並填入上方「密碼」欄位。</li>
                      <li>SMTP 主機填寫：<code className="text-indigo-300 font-mono">smtp.gmail.com</code>，Port：<code className="text-indigo-300 font-mono">587</code>。</li>
                    </ol>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <p className="font-bold text-cyan-300 flex items-center gap-1.5">
                      ⚡ 使用專業企業發信服務 (SendGrid / AWS SES)
                    </p>
                    <p className="text-[11px] text-slate-400">
                      若發信量較大，可使用 SendGrid、Mailgun 或 AWS SES，Host 填入其 SMTP 伺服器，帳號填入 API Key 名稱，密碼填入 API Key 即可。
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal: Send Test Email */}
      <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Send className="w-4 h-4 text-indigo-400" />
              發送單筆測試郵件
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              在正式向大量會員發送前，先寄送一封預覽信到您的指定信箱，確認排版與文字效果。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">收件測試信箱 (Test Email)</Label>
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-slate-950 border-slate-800 text-xs font-mono text-slate-100"
              />
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-400">
              <span className="font-bold text-slate-300">主旨：</span> {subject}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsTestModalOpen(false)}
              className="border-slate-700 bg-slate-800 text-xs font-bold"
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={handleSendTestEmail}
              disabled={isSendingTest || !testEmail}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
            >
              {isSendingTest ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> 寄送中...</>
              ) : (
                <><Send className="w-3.5 h-3.5 mr-1.5" /> 發送測試信</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirm Broadcast Email */}
      <AlertDialog open={isConfirmSendOpen} onOpenChange={setIsConfirmSendOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-emerald-400" />
              確認啟動行銷郵件廣播發送？
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-300 space-y-3 pt-2">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-left">
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">發送受眾：</span>
                  <span className="font-bold text-white">
                    {targetType === 'all'
                      ? '全體註冊會員'
                      : targetType === 'specific_users'
                      ? `指定會員 (${selectedUserIds.length} 人)`
                      : targetType === 'user_levels'
                      ? `等級 (${selectedLevels.join(', ')})`
                      : targetType === 'user_tags'
                      ? `標籤 (${selectedTags.join(', ')})`
                      : '自訂 Email 清單'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">預估收件人數：</span>
                  <span className="font-bold font-mono text-emerald-400 text-sm">{estimatedCount} 位會員</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">郵件主旨：</span>
                  <span className="font-bold text-slate-200 truncate max-w-[260px]">{subject}</span>
                </div>
                {promoCode && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">附帶兌換序號：</span>
                    <span className="font-mono font-black text-amber-300">{promoCode}</span>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-400 text-left">
                ※ 系統將依序分批派發信件，並自動記錄至發信日誌。點擊「確定發送」後將立即排程發送。
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="border-slate-700 bg-slate-800 text-xs font-bold">
              返回檢查
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLaunchBroadcast}
              disabled={isSendingBroadcast}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black"
            >
              {isSendingBroadcast ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> 廣播發送中...</>
              ) : (
                '🚀 確定立即發送'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal: View Log Details */}
      <Dialog open={!!viewingLog} onOpenChange={(open) => !open && setViewingLog(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-2xl max-h-[85vh] overflow-y-auto">
          {viewingLog && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-black flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  發信紀錄詳情
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  {viewingLog.subject}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-400">發送時間：</span>
                    <span className="text-slate-200 ml-1 font-mono">
                      {viewingLog.createdAt?.toDate
                        ? format(viewingLog.createdAt.toDate(), 'yyyy/MM/dd HH:mm:ss')
                        : viewingLog.createdAt
                        ? format(new Date(viewingLog.createdAt), 'yyyy/MM/dd HH:mm:ss')
                        : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">受眾類型：</span>
                    <span className="text-indigo-300 ml-1 font-bold">{viewingLog.targetSummary}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">成功寄出：</span>
                    <span className="text-emerald-400 ml-1 font-bold font-mono">{viewingLog.sentCount} 封</span>
                  </div>
                  <div>
                    <span className="text-slate-400">失敗筆數：</span>
                    <span className="text-rose-400 ml-1 font-bold font-mono">{viewingLog.failedCount} 封</span>
                  </div>
                </div>

                {viewingLog.errors && viewingLog.errors.length > 0 && (
                  <div className="p-3 bg-rose-950/40 rounded-xl border border-rose-900/60 space-y-1.5">
                    <p className="font-bold text-rose-300">⚠️ 失敗收件者明細：</p>
                    <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[11px] text-rose-200">
                      {viewingLog.errors.map((e: any, idx: number) => (
                        <div key={idx} className="flex justify-between">
                          <span>{e.email}</span>
                          <span className="text-rose-400 opacity-80">{e.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <p className="font-bold text-slate-300">信件 HTML 預覽：</p>
                  <div className="border border-slate-800 rounded-xl overflow-hidden h-72 bg-[#0b0f19]">
                    <iframe
                      srcDoc={generateMarketingEmailHtml({
                        subject: viewingLog.subject,
                        preheader: viewingLog.preheader,
                        senderName: viewingLog.senderName,
                        heading: viewingLog.heading,
                        contentHtml: viewingLog.contentHtml,
                        buttonText: viewingLog.buttonText,
                        buttonUrl: viewingLog.buttonUrl,
                        promoCode: viewingLog.promoCode,
                        bannerImageUrl: viewingLog.bannerImageUrl,
                      })}
                      title="History Preview"
                      className="w-full h-full border-0"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setViewingLog(null)}
                  className="border-slate-700 bg-slate-800 text-xs font-bold"
                >
                  關閉
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    handleDuplicateFromLog(viewingLog);
                    setViewingLog(null);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  <Copy className="w-3.5 h-3.5 mr-1" /> 複製此信件內容為草稿
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function MarketingEmailsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />載入行銷郵件中心...</div>}>
      <MarketingEmailsContent />
    </Suspense>
  );
}
