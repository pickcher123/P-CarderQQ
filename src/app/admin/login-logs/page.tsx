'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import {
  LogIn,
  Search,
  RefreshCw,
  Download,
  Laptop,
  Smartphone,
  Tablet,
  Copy,
  Check,
  ShieldCheck,
  ExternalLink,
  Users,
  Activity,
  Globe,
  FileText,
  KeyRound,
  X,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { format, isToday, isYesterday, subDays, isAfter, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { isSuperAdminEmail, SUPER_ADMIN_EMAILS } from '@/hooks/use-is-admin';
import { parseUserAgentDetails } from '@/lib/admin-audit';

interface UserLoginLog {
  id: string;
  userId: string;
  email?: string;
  username?: string;
  photoURL?: string | null;
  loginMethod: 'google' | 'email' | 'register' | 'admin-backend' | string;
  loginMethodName?: string;
  isAdminBackendLogin?: boolean;
  adminRole?: 'superadmin' | 'admin' | string;
  adminRoleLabel?: string;
  routePath?: string;
  ip: string;
  device?: 'desktop' | 'mobile' | 'tablet' | string;
  browser?: string;
  os?: string;
  userAgent?: string;
  status?: string;
  createdAt?: any;
  loginTime?: string;
}

interface UnifiedLoginLog extends UserLoginLog {
  parsedDate: Date | null;
  isAdminAccount: boolean;
  resolvedRoleLabel: string;
  isBackendEntry: boolean;
  sourceCollection: 'userLoginLogs' | 'activityLogs' | 'adminsSync';
}

type RoleScopeFilter = 'all' | 'admin_all' | 'admin_backend' | 'player';

function parseAnyTimestamp(val: any, fallbackIso?: string): Date | null {
  if (!val && !fallbackIso) return null;
  if (typeof val?.toDate === 'function') {
    const d = val.toDate();
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof val?.seconds === 'number') {
    const d = new Date(val.seconds * 1000);
    if (!isNaN(d.getTime())) return d;
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val;
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  if (fallbackIso) {
    const d = parseISO(fallbackIso);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export default function UserLoginLogsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  // 搜尋與篩選狀態
  const [roleScope, setRoleScope] = useState<RoleScopeFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all'); // all, today, yesterday, 7days, 30days
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 支援網址帶入 ?search=<uid|email> 或 ?scope=admin_all
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const qSearch = params.get('search');
      const qScope = params.get('scope') as RoleScopeFilter | null;
      if (qSearch) setSearchTerm(qSearch);
      if (qScope && ['all', 'admin_all', 'admin_backend', 'player'].includes(qScope)) {
        setRoleScope(qScope);
      }
    }
  }, []);

  // 1. 查詢最近 500 筆 userLoginLogs
  const logsQuery = useMemoFirebase(
    () =>
      firestore
        ? query(collection(firestore, 'userLoginLogs'), orderBy('createdAt', 'desc'), limit(500))
        : null,
    [firestore]
  );
  const {
    data: rawLogs,
    isLoading,
    forceRefetch: refetchUserLogs,
  } = useCollection<UserLoginLog>(logsQuery);

  // 2. 查詢管理員白名單集合 admins（辨識所有管理員身分與同步時間）
  const adminsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'admins') : null),
    [firestore]
  );
  const { data: adminDocs, forceRefetch: refetchAdmins } = useCollection<any>(adminsQuery);

  // 3. 查詢操作日誌 activityLogs（合併歷史後台登入事件並追蹤每位管理員最後後台活躍時間）
  const activityQuery = useMemoFirebase(
    () =>
      firestore
        ? query(collection(firestore, 'activityLogs'), orderBy('createdAt', 'desc'), limit(400))
        : null,
    [firestore]
  );
  const { data: activityDocs, forceRefetch: refetchActivity } = useCollection<any>(activityQuery);

  // 建立管理員 UID / Email 對照索引
  const adminIdentitySets = useMemo(() => {
    const uidSet = new Set<string>();
    const emailSet = new Set<string>(SUPER_ADMIN_EMAILS.map((e) => e.toLowerCase().trim()));
    const nameByEmail = new Map<string, string>();
    const emailByUid = new Map<string, string>();

    (adminDocs || []).forEach((docItem: any) => {
      const idStr = String(docItem.id || '').trim();
      const uidStr = String(docItem.uid || '').trim();
      const emailStr = String(docItem.email || (idStr.includes('@') ? idStr : '') || '')
        .toLowerCase()
        .trim();
      const uname = String(docItem.username || docItem.name || '').trim();

      if (uidStr) uidSet.add(uidStr);
      if (idStr && !idStr.includes('@')) uidSet.add(idStr);
      if (emailStr) emailSet.add(emailStr);
      if (emailStr && uname) nameByEmail.set(emailStr, uname);
      if (uidStr && emailStr) emailByUid.set(uidStr, emailStr);
    });

    (activityDocs || []).forEach((act: any) => {
      if (act.adminUid && act.adminUid !== 'unknown') uidSet.add(String(act.adminUid));
      if (act.userEmail && act.userEmail !== '未知信箱') {
        const em = String(act.userEmail).toLowerCase().trim();
        emailSet.add(em);
        if (act.userName && !nameByEmail.has(em)) {
          nameByEmail.set(em, String(act.userName));
        }
      }
    });

    return { uidSet, emailSet, nameByEmail, emailByUid };
  }, [adminDocs, activityDocs]);

  // 合併 userLoginLogs + activityLogs 中的後台登入紀錄 + 已驗證同步過後台但尚無舊紀錄之管理員
  const unifiedLogs = useMemo<UnifiedLoginLog[]>(() => {
    const list: UnifiedLoginLog[] = [];
    const backendDedupFingerprints: Array<{ uid: string; email: string; ts: number }> = [];

    for (const log of rawLogs || []) {
      const cleanEmail = (log.email || '').toLowerCase().trim();
      const isSuper = isSuperAdminEmail(cleanEmail);
      const isAdminAccount = Boolean(
        isSuper ||
          log.isAdminBackendLogin ||
          (log.userId && adminIdentitySets.uidSet.has(log.userId)) ||
          (cleanEmail && adminIdentitySets.emailSet.has(cleanEmail))
      );
      const isBackendEntry = Boolean(
        log.isAdminBackendLogin || log.loginMethod === 'admin-backend'
      );
      const parsedDate = parseAnyTimestamp(log.createdAt, log.loginTime);
      const resolvedRoleLabel = isSuper
        ? '最高主管'
        : isAdminAccount
        ? log.adminRoleLabel || '後台管理員'
        : '一般會員';

      if (isBackendEntry && parsedDate) {
        backendDedupFingerprints.push({
          uid: log.userId || '',
          email: cleanEmail,
          ts: parsedDate.getTime(),
        });
      }

      list.push({
        ...log,
        parsedDate,
        isAdminAccount,
        resolvedRoleLabel,
        isBackendEntry,
        sourceCollection: 'userLoginLogs',
      });
    }

    // 合併來自 activityLogs 的管理員登入後台紀錄（若 3 分鐘內已有 userLoginLogs 同人紀錄則自動去重）
    for (const act of activityDocs || []) {
      const isLoginOp =
        act.operationType === 'login' ||
        act.module === 'auth' ||
        Boolean(
          act.action?.includes('進入管理後台') ||
            act.action?.includes('登入進入後台') ||
            act.action?.includes('登入管理後台')
        );
      if (!isLoginOp) continue;

      const parsedDate = parseAnyTimestamp(act.createdAt);
      const ts = parsedDate?.getTime() || 0;
      const uid = String(act.adminUid || act.targetId || '');
      const cleanEmail = String(act.userEmail || '').toLowerCase().trim();

      const alreadyInUserLogs = backendDedupFingerprints.some((fp) => {
        const samePerson =
          (uid && fp.uid && uid === fp.uid) ||
          (cleanEmail && fp.email && cleanEmail === fp.email);
        return samePerson && Math.abs(fp.ts - ts) <= 3 * 60 * 1000;
      });
      if (alreadyInUserLogs) continue;

      const uaInfo = parseUserAgentDetails(act.userAgent);
      const isSuper = isSuperAdminEmail(cleanEmail) || act.adminRole === 'superadmin';

      list.push({
        id: `act_${act.id}`,
        userId: uid || cleanEmail || 'admin',
        email: act.userEmail || '',
        username:
          act.userName ||
          (cleanEmail ? adminIdentitySets.nameByEmail.get(cleanEmail) || cleanEmail.split('@')[0] : '管理員'),
        photoURL: null,
        loginMethod: 'admin-backend',
        loginMethodName: '管理員進入後台',
        isAdminBackendLogin: true,
        routePath: act.routePath || '/admin',
        ip: act.ipAddress || '未知 IP',
        device: uaInfo.device,
        os: uaInfo.os,
        browser: uaInfo.browser,
        userAgent: act.userAgent || '',
        status: 'success',
        createdAt: act.createdAt,
        parsedDate,
        isAdminAccount: true,
        resolvedRoleLabel: isSuper ? '最高主管' : act.adminRoleLabel || '後台管理員',
        isBackendEntry: true,
        sourceCollection: 'activityLogs',
      });
    }

    // 針對先前已進入後台觸發權限同步 (admins/{uid} 具 uid 與 updatedAt/lastLoginAt) 但早期未寫入登入表的其他管理員，補齊其最近後台登入軌跡
    for (const adm of adminDocs || []) {
      const idStr = String(adm.id || '').trim();
      const uid = String(adm.uid || (!idStr.includes('@') ? idStr : '') || '').trim();
      const cleanEmail = String(adm.email || (idStr.includes('@') ? idStr : '') || '')
        .toLowerCase()
        .trim();
      if (!uid) continue; // 僅針對已實際登入觸發 UID 綁定的管理員帳號

      const hasAnyRecord = list.some(
        (item) =>
          (uid && item.userId === uid) ||
          (cleanEmail && (item.email || '').toLowerCase().trim() === cleanEmail)
      );
      if (hasAnyRecord) continue;

      const syncDate = parseAnyTimestamp(adm.lastLoginAt || adm.updatedAt || adm.createdAt, adm.lastLoginTime);
      if (!syncDate) continue;

      const isSuper = isSuperAdminEmail(cleanEmail);
      list.push({
        id: `adm_sync_${adm.id}`,
        userId: uid,
        email: cleanEmail,
        username:
          adm.username ||
          adm.name ||
          (cleanEmail ? adminIdentitySets.nameByEmail.get(cleanEmail) || cleanEmail.split('@')[0] : '管理員'),
        photoURL: null,
        loginMethod: 'admin-backend',
        loginMethodName: '後台權限驗證登入',
        isAdminBackendLogin: true,
        routePath: '/admin',
        ip: adm.lastLoginIp || '早期登入未記錄 IP',
        device: 'desktop',
        os: adm.lastLoginDevice ? String(adm.lastLoginDevice).split('·')[0]?.trim() : '後台連線裝置',
        browser: adm.lastLoginDevice ? String(adm.lastLoginDevice).split('·')[1]?.trim() || '瀏覽器' : '已驗證管理階段',
        status: 'success',
        createdAt: adm.lastLoginAt || adm.updatedAt,
        parsedDate: syncDate,
        isAdminAccount: true,
        resolvedRoleLabel: isSuper ? '最高主管' : '後台管理員',
        isBackendEntry: true,
        sourceCollection: 'adminsSync',
      });
    }

    return list.sort((a, b) => {
      const ta = a.parsedDate?.getTime() || 0;
      const tb = b.parsedDate?.getTime() || 0;
      return tb - ta;
    });
  }, [rawLogs, activityDocs, adminDocs, adminIdentitySets]);

  // 建立「管理員後台登入狀態總覽」名單：讓老闆一眼看到所有管理員（包含從未登入、曾登入後台、或正在操作的人員）
  const adminRosterSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        uid: string;
        email: string;
        name: string;
        isSuper: boolean;
        lastLoginDate: Date | null;
        lastIp: string;
        loginCount: number;
        hasLoggedIntoBackend: boolean;
      }
    >();

    // 先放入系統管理員名單 admins
    for (const adm of adminDocs || []) {
      const idStr = String(adm.id || '').trim();
      const email = String(adm.email || (idStr.includes('@') ? idStr : '') || '')
        .toLowerCase()
        .trim();
      const uid = String(adm.uid || (!idStr.includes('@') ? idStr : '') || '').trim();
      const key = email || uid;
      if (!key) continue;

      const syncDate = parseAnyTimestamp(adm.lastLoginAt || (uid ? adm.updatedAt : null), adm.lastLoginTime);
      const existing = map.get(key);
      const isSuper = isSuperAdminEmail(email);
      const name =
        adm.username ||
        adm.name ||
        (email ? adminIdentitySets.nameByEmail.get(email) || email.split('@')[0] : '管理員');

      if (!existing) {
        map.set(key, {
          key,
          uid,
          email,
          name,
          isSuper,
          lastLoginDate: syncDate,
          lastIp: adm.lastLoginIp || '',
          loginCount: 0,
          hasLoggedIntoBackend: Boolean(uid || adm.lastLoginAt),
        });
      } else {
        if (!existing.uid && uid) existing.uid = uid;
        if (uid) existing.hasLoggedIntoBackend = true;
        if (syncDate && (!existing.lastLoginDate || syncDate > existing.lastLoginDate)) {
          existing.lastLoginDate = syncDate;
        }
        if (!existing.lastIp && adm.lastLoginIp) existing.lastIp = adm.lastLoginIp;
      }
    }

    // 合併 unifiedLogs 中的管理員登入統計
    for (const log of unifiedLogs) {
      if (!log.isAdminAccount) continue;
      const email = (log.email || '').toLowerCase().trim();
      const key = email || log.userId;
      if (!key) continue;

      const existing = map.get(key);
      if (existing) {
        existing.loginCount += 1;
        if (log.isBackendEntry) existing.hasLoggedIntoBackend = true;
        if (log.parsedDate && (!existing.lastLoginDate || log.parsedDate > existing.lastLoginDate)) {
          existing.lastLoginDate = log.parsedDate;
          if (log.ip && !log.ip.includes('未記錄')) existing.lastIp = log.ip;
        }
      } else {
        map.set(key, {
          key,
          uid: log.userId,
          email,
          name: log.username || (email ? email.split('@')[0] : '管理員'),
          isSuper: isSuperAdminEmail(email),
          lastLoginDate: log.parsedDate,
          lastIp: log.ip || '',
          loginCount: 1,
          hasLoggedIntoBackend: log.isBackendEntry,
        });
      }
    }

    // 再補上 activityLogs 中有操作紀錄的最新時間（若比帳面登入時間更新）
    for (const act of activityDocs || []) {
      const email = String(act.userEmail || '').toLowerCase().trim();
      const uid = String(act.adminUid || '').trim();
      const key = email || uid;
      if (!key || key === '未知信箱' || key === 'unknown') continue;
      const actDate = parseAnyTimestamp(act.createdAt);
      const item = map.get(key);
      if (item) {
        item.hasLoggedIntoBackend = true;
        if (actDate && (!item.lastLoginDate || actDate > item.lastLoginDate)) {
          item.lastLoginDate = actDate;
        }
        if (!item.lastIp && act.ipAddress && act.ipAddress !== '未知 IP') {
          item.lastIp = act.ipAddress;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const ta = a.lastLoginDate?.getTime() || 0;
      const tb = b.lastLoginDate?.getTime() || 0;
      if (tb !== ta) return tb - ta;
      return b.loginCount - a.loginCount;
    });
  }, [adminDocs, unifiedLogs, activityDocs, adminIdentitySets]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchUserLogs ? refetchUserLogs() : Promise.resolve(),
      refetchAdmins ? refetchAdmins() : Promise.resolve(),
      refetchActivity ? refetchActivity() : Promise.resolve(),
    ]);
    setTimeout(() => {
      setIsRefreshing(false);
      toast({ title: '已重新整理', description: '管理員與玩家登入紀錄已同步至最新狀態' });
    }, 350);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast({ title: '已複製', description: `${label} 已複製到剪貼簿` });
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 統計數據計算
  const stats = useMemo(() => {
    const todayUsers = new Set<string>();
    let todayTotal = 0;
    let adminTotal = 0;
    let adminBackendTotal = 0;
    let playerTotal = 0;
    let mobileCount = 0;
    let desktopCount = 0;

    unifiedLogs.forEach((log) => {
      const isLogToday = log.parsedDate ? isToday(log.parsedDate) : false;

      if (isLogToday) {
        todayTotal++;
        if (log.userId) todayUsers.add(log.userId);
      }

      if (log.isAdminAccount) {
        adminTotal++;
        if (log.isBackendEntry) adminBackendTotal++;
      } else {
        playerTotal++;
      }

      if (log.device === 'mobile' || log.device === 'tablet') mobileCount++;
      else desktopCount++;
    });

    return {
      todayTotal,
      todayUnique: todayUsers.size,
      adminTotal,
      adminBackendTotal,
      playerTotal,
      mobileCount,
      desktopCount,
    };
  }, [unifiedLogs]);

  // 篩選後資料
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);
    const thirtyDaysAgo = subDays(now, 30);

    return unifiedLogs.filter((log) => {
      // 0. 身分範疇快篩
      if (roleScope === 'admin_all' && !log.isAdminAccount) return false;
      if (roleScope === 'admin_backend' && !log.isBackendEntry) return false;
      if (roleScope === 'player' && log.isAdminAccount) return false;

      // 1. 關鍵字搜尋 (暱稱, Email, UID, IP, OS, 瀏覽器, 角色)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchName = log.username?.toLowerCase().includes(term);
        const matchEmail = log.email?.toLowerCase().includes(term);
        const matchUid = log.userId?.toLowerCase().includes(term);
        const matchIp = log.ip?.toLowerCase().includes(term);
        const matchBrowser = log.browser?.toLowerCase().includes(term);
        const matchOs = log.os?.toLowerCase().includes(term);
        const matchRole = log.resolvedRoleLabel.toLowerCase().includes(term);
        if (
          !matchName &&
          !matchEmail &&
          !matchUid &&
          !matchIp &&
          !matchBrowser &&
          !matchOs &&
          !matchRole
        ) {
          return false;
        }
      }

      // 2. 登入方式篩選
      if (methodFilter !== 'all') {
        if (methodFilter === 'admin-backend') {
          if (!log.isBackendEntry) return false;
        } else if (log.loginMethod !== methodFilter) {
          return false;
        }
      }

      // 3. 裝置類型篩選
      if (deviceFilter !== 'all') {
        if (log.device !== deviceFilter) return false;
      }

      // 4. 日期區間篩選
      if (dateFilter !== 'all') {
        const logDate = log.parsedDate;
        if (!logDate) return false;
        if (dateFilter === 'today' && !isToday(logDate)) return false;
        if (dateFilter === 'yesterday' && !isYesterday(logDate)) return false;
        if (dateFilter === '7days' && !isAfter(logDate, sevenDaysAgo)) return false;
        if (dateFilter === '30days' && !isAfter(logDate, thirtyDaysAgo)) return false;
      }

      return true;
    });
  }, [unifiedLogs, roleScope, searchTerm, methodFilter, deviceFilter, dateFilter]);

  // 分頁計算
  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // 匯出 CSV 功能
  const handleExportCsv = () => {
    if (filteredLogs.length === 0) {
      toast({ variant: 'destructive', title: '匯出失敗', description: '目前無任何紀錄可供匯出' });
      return;
    }

    const headers = [
      '登入時間',
      '身分角色',
      '帳號暱稱',
      'Email',
      'User UID',
      '登入入口 / 方式',
      'IP 位址',
      '裝置類型',
      '作業系統',
      '瀏覽器',
    ];
    const rows = filteredLogs.map((log) => {
      const d = log.parsedDate;
      const timeStr = d ? format(d, 'yyyy-MM-dd HH:mm:ss') : log.loginTime || '未知';
      return [
        `"${timeStr}"`,
        `"${log.resolvedRoleLabel}"`,
        `"${(log.username || '').replace(/"/g, '""')}"`,
        `"${(log.email || '').replace(/"/g, '""')}"`,
        `"${log.userId || ''}"`,
        `"${log.loginMethodName || log.loginMethod || ''}"`,
        `"${log.ip || ''}"`,
        `"${log.device || 'desktop'}"`,
        `"${(log.os || '').replace(/"/g, '""')}"`,
        `"${(log.browser || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `管理員與玩家登入紀錄_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: '匯出成功', description: `已成功匯出 ${filteredLogs.length} 筆登入歷史紀錄。` });
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12 text-slate-900">
      {/* 頂部標題區 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-amber-400 shrink-0">
              <LogIn className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                管理員與玩家登入紀錄
                <span className="text-xs font-bold text-emerald-700 inline-flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  前台與後台雙向即時記錄
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                完整記錄每位後台管理員進入控制台 (/admin) 與全站會員登入的時間、來源 IP、作業系統與裝置軌跡
              </p>
            </div>
          </div>
        </div>

        {/* 右側操作按鈕 */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link href="/admin/activity-logs?focus=admin_login">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-slate-200 hover:bg-slate-50 font-bold text-slate-700 text-xs gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>操作日誌登入檢視</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-xl border-slate-200 hover:bg-slate-50 font-bold text-slate-700 text-xs gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin text-cyan-600')} />
            <span>重新整理</span>
          </Button>

          <Button
            size="sm"
            onClick={handleExportCsv}
            disabled={filteredLogs.length === 0}
            className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>匯出 CSV 報表 ({filteredLogs.length})</span>
          </Button>
        </div>
      </div>

      {/* 4 核心統計指標卡片（點擊可快速切換篩選） */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => {
            setDateFilter(dateFilter === 'today' ? 'all' : 'today');
            setCurrentPage(1);
          }}
          className={cn(
            'text-left p-4 rounded-2xl bg-white border transition-colors cursor-pointer',
            dateFilter === 'today' ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200 hover:border-slate-300'
          )}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>今日登入總人次</span>
            <Activity className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="mt-1.5 text-2xl font-black text-slate-900 font-mono tabular-nums">
            {isLoading ? <Skeleton className="h-8 w-16" /> : stats.todayTotal.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            獨立帳號 {stats.todayUnique.toLocaleString()} 人
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setRoleScope(roleScope === 'admin_backend' ? 'all' : 'admin_backend');
            setCurrentPage(1);
          }}
          className={cn(
            'text-left p-4 rounded-2xl bg-white border transition-colors cursor-pointer',
            roleScope === 'admin_backend'
              ? 'border-amber-500 bg-amber-50/35 ring-2 ring-amber-500/20'
              : 'border-amber-200 hover:border-amber-400'
          )}
        >
          <div className="flex items-center justify-between text-xs font-bold text-amber-800">
            <span>管理員登入後台</span>
            <KeyRound className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-1.5 text-2xl font-black text-amber-700 font-mono tabular-nums">
            {isLoading ? <Skeleton className="h-8 w-16" /> : stats.adminBackendTotal.toLocaleString()}
          </div>
          <p className="text-[11px] text-amber-700/80 mt-0.5">
            管理員總登入 {stats.adminTotal.toLocaleString()} 次
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setRoleScope(roleScope === 'player' ? 'all' : 'player');
            setCurrentPage(1);
          }}
          className={cn(
            'text-left p-4 rounded-2xl bg-white border transition-colors cursor-pointer',
            roleScope === 'player'
              ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/15'
              : 'border-slate-200 hover:border-emerald-300'
          )}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>一般玩家前台登入</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1.5 text-2xl font-black text-emerald-700 font-mono tabular-nums">
            {isLoading ? <Skeleton className="h-8 w-16" /> : stats.playerTotal.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">前台大廳登入累計</p>
        </button>

        <div className="p-4 rounded-2xl bg-white border border-slate-200">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>行動裝置 / 電腦比例</span>
            <Smartphone className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-1.5 text-2xl font-black text-indigo-600 font-mono tabular-nums">
            {isLoading ? <Skeleton className="h-8 w-16" /> : stats.mobileCount.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            電腦端: {stats.desktopCount.toLocaleString()} 次
          </p>
        </div>
      </div>

      {/* 管理員帳號後台登入狀態總覽列：一目了然看清楚每位管理員有沒有登入過後台、最後登入時間與 IP */}
      {adminRosterSummary.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs sm:text-sm font-black tracking-tight">
                後台管理員登入狀態總覽（共 {adminRosterSummary.length} 位管理員帳號）
              </span>
              <span className="hidden md:inline text-xs text-slate-400">
                · 點擊任一管理員可篩選其所有登入紀錄
              </span>
            </div>
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setRoleScope('all');
                  setCurrentPage(1);
                }}
                className="text-xs font-bold text-amber-300 hover:text-amber-200 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
              >
                顯示全部紀錄
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 custom-scrollbar">
            {adminRosterSummary.map((adm) => {
              const filterToken = adm.email || adm.uid;
              const isSelected =
                Boolean(filterToken) && searchTerm.toLowerCase() === filterToken.toLowerCase();
              return (
                <button
                  key={adm.key}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setSearchTerm('');
                    } else {
                      setSearchTerm(filterToken);
                      setRoleScope('all');
                      setCurrentPage(1);
                    }
                  }}
                  className={cn(
                    'shrink-0 px-3.5 py-2.5 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-3',
                    isSelected
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-slate-800/90 hover:bg-slate-800 text-slate-100 border-slate-700'
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0',
                      isSelected
                        ? 'bg-slate-950 text-amber-400'
                        : adm.isSuper
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-slate-700 text-white'
                    )}
                  >
                    {(adm.name || adm.email || 'A').charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black truncate max-w-[120px]">{adm.name}</span>
                      <span
                        className={cn(
                          'text-[10px] font-bold whitespace-nowrap',
                          isSelected
                            ? 'text-slate-800'
                            : adm.isSuper
                            ? 'text-amber-300'
                            : 'text-cyan-300'
                        )}
                      >
                        · {adm.isSuper ? '最高主管' : '管理員'}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'text-[10px] font-mono truncate max-w-[175px]',
                        isSelected ? 'text-slate-800' : 'text-slate-400'
                      )}
                    >
                      {adm.email || adm.uid}
                    </div>
                    <div
                      className={cn(
                        'text-[10px] font-mono tabular-nums',
                        isSelected
                          ? 'text-slate-900 font-bold'
                          : adm.lastLoginDate
                          ? 'text-emerald-300'
                          : 'text-slate-500'
                      )}
                    >
                      {adm.lastLoginDate
                        ? `最近後台活躍：${format(adm.lastLoginDate, 'MM-dd HH:mm')}`
                        : '尚未登入過後台'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 搜尋與篩選控制面板 */}
      <Card className="rounded-2xl border-slate-200/80 bg-white overflow-hidden">
        <CardContent className="p-4 space-y-3">
          {/* 身分範疇分段切換按鈕 */}
          <div className="flex items-center gap-1.5 flex-wrap pb-2 border-b border-slate-100">
            {(
              [
                { id: 'all' as RoleScopeFilter, label: '全部登入紀錄', count: unifiedLogs.length },
                { id: 'admin_backend' as RoleScopeFilter, label: '管理員進入後台 (/admin)', count: stats.adminBackendTotal },
                { id: 'admin_all' as RoleScopeFilter, label: '所有管理員登入', count: stats.adminTotal },
                { id: 'player' as RoleScopeFilter, label: '一般玩家登入', count: stats.playerTotal },
              ] as const
            ).map((tab) => {
              const active = roleScope === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setRoleScope(tab.id);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-black transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0',
                    active
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded-md font-mono tabular-nums text-[10px]',
                      active ? 'bg-white/20 text-white' : 'bg-white text-slate-700'
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* 搜尋框 */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                placeholder="搜尋管理員或玩家暱稱、Email、UID、登入 IP 或瀏覽器..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 pr-8 h-10 rounded-xl bg-slate-50/80 border-slate-200 text-xs sm:text-sm focus:bg-white transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* 篩選條件下拉 */}
            <div className="flex items-center gap-2 w-full md:w-auto shrink-0 flex-wrap">
              {/* 登入方式 */}
              <Select
                value={methodFilter}
                onValueChange={(val) => {
                  setMethodFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-10 w-[145px] rounded-xl text-xs font-bold border-slate-200 bg-white">
                  <SelectValue placeholder="登入方式" />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-xs bg-white">
                  <SelectItem value="all">全部登入入口</SelectItem>
                  <SelectItem value="admin-backend">進入管理後台 (/admin)</SelectItem>
                  <SelectItem value="google">Google 前台登入</SelectItem>
                  <SelectItem value="email">帳號密碼登入</SelectItem>
                  <SelectItem value="register">新會員註冊</SelectItem>
                </SelectContent>
              </Select>

              {/* 裝置類型 */}
              <Select
                value={deviceFilter}
                onValueChange={(val) => {
                  setDeviceFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-10 w-[115px] rounded-xl text-xs font-bold border-slate-200 bg-white">
                  <SelectValue placeholder="裝置類型" />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-xs bg-white">
                  <SelectItem value="all">全部裝置</SelectItem>
                  <SelectItem value="desktop">電腦版</SelectItem>
                  <SelectItem value="mobile">智慧手機</SelectItem>
                  <SelectItem value="tablet">平板電腦</SelectItem>
                </SelectContent>
              </Select>

              {/* 日期區間 */}
              <Select
                value={dateFilter}
                onValueChange={(val) => {
                  setDateFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-10 w-[115px] rounded-xl text-xs font-bold border-slate-200 bg-white">
                  <SelectValue placeholder="日期區間" />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-xs bg-white">
                  <SelectItem value="all">所有日期</SelectItem>
                  <SelectItem value="today">今日登入</SelectItem>
                  <SelectItem value="yesterday">昨日登入</SelectItem>
                  <SelectItem value="7days">近 7 天</SelectItem>
                  <SelectItem value="30days">近 30 天</SelectItem>
                </SelectContent>
              </Select>

              {/* 重設按鈕 */}
              {(roleScope !== 'all' ||
                searchTerm ||
                methodFilter !== 'all' ||
                deviceFilter !== 'all' ||
                dateFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRoleScope('all');
                    setSearchTerm('');
                    setMethodFilter('all');
                    setDeviceFilter('all');
                    setDateFilter('all');
                    setCurrentPage(1);
                  }}
                  className="h-10 rounded-xl text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-bold px-3 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  重設篩選
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span>
              共篩選出 <strong className="text-slate-900 font-mono tabular-nums">{filteredLogs.length}</strong> 筆登入歷史紀錄
            </span>
            <div className="flex items-center gap-2">
              <span>每頁顯示</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-7 w-[70px] text-xs font-mono rounded-lg border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg text-xs bg-white">
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 資料表格 */}
      <Card className="rounded-3xl border-slate-200/80 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[920px]">
            <TableHeader className="bg-slate-50/80 border-b border-slate-200">
              <TableRow>
                <TableHead className="font-bold text-slate-700 text-xs w-[170px] pl-6">登入時間</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs w-[250px]">帳號與身分角色</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs w-[155px]">登入入口 / 方式</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs w-[150px]">來源 IP</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs w-[200px]">裝置與瀏覽器</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs text-right w-[135px] pr-6">稽核 / 詳情</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6"><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-9 w-44" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="pr-6"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <LogIn className="w-6 h-6" />
                    </div>
                    <p className="text-slate-600 font-bold text-sm">找不到符合條件的登入紀錄</p>
                    <p className="text-slate-400 text-xs">請嘗試調整搜尋關鍵字、身分範疇或日期區間</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLogs.map((log) => {
                  const logDate = log.parsedDate;
                  const isLogToday = logDate ? isToday(logDate) : false;
                  const isLogYesterday = logDate ? isYesterday(logDate) : false;

                  return (
                    <TableRow
                      key={log.id}
                      className={cn(
                        'transition-colors border-b border-slate-100',
                        log.isBackendEntry
                          ? 'bg-amber-50/25 hover:bg-amber-50/55'
                          : 'hover:bg-slate-50/70'
                      )}
                    >
                      {/* 登入時間 */}
                      <TableCell className="align-top py-3.5 pl-6">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            {isLogToday && (
                              <span className="text-[10px] font-black text-emerald-700">今日</span>
                            )}
                            {isLogYesterday && (
                              <span className="text-[10px] font-black text-amber-700">昨日</span>
                            )}
                            <span className="font-mono tabular-nums text-xs font-bold text-slate-900">
                              {logDate ? format(logDate, 'HH:mm:ss') : '-'}
                            </span>
                          </div>
                          <p className="font-mono tabular-nums text-[11px] text-slate-400">
                            {logDate ? format(logDate, 'yyyy-MM-dd') : log.loginTime || '-'}
                          </p>
                        </div>
                      </TableCell>

                      {/* 帳號與角色資訊 */}
                      <TableCell className="align-top py-3.5">
                        <div className="flex items-start gap-2.5">
                          <Avatar className="w-8 h-8 rounded-xl border border-slate-200 mt-0.5 shrink-0">
                            {log.photoURL && <AvatarImage src={log.photoURL} alt={log.username} />}
                            <AvatarFallback
                              className={cn(
                                'font-black text-xs rounded-xl',
                                log.isAdminAccount
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'bg-slate-900 text-white'
                              )}
                            >
                              {(log.username || log.email || 'U')[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-black text-slate-900 text-xs sm:text-sm truncate max-w-[140px]">
                                {log.username || '匿名帳號'}
                              </p>
                              <span
                                className={cn(
                                  'text-[10px] font-black whitespace-nowrap',
                                  log.resolvedRoleLabel === '最高主管'
                                    ? 'text-amber-700'
                                    : log.isAdminAccount
                                    ? 'text-indigo-700'
                                    : 'text-slate-400'
                                )}
                              >
                                · {log.resolvedRoleLabel}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
                              {log.email || '未綁定信箱'}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleCopy(log.userId, 'UID')}
                              className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-cyan-600 transition-colors group cursor-pointer"
                              title="點擊複製完整 UID"
                            >
                              <span>UID: {String(log.userId).slice(0, 8)}...</span>
                              {copiedId === log.userId ? (
                                <Check className="w-2.5 h-2.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                              )}
                            </button>
                          </div>
                        </div>
                      </TableCell>

                      {/* 登入方式 */}
                      <TableCell className="align-top py-3.5">
                        {log.isBackendEntry ? (
                          <div className="space-y-0.5">
                            <Badge className="bg-slate-900 text-amber-300 hover:bg-slate-900 border-slate-800 text-[11px] px-2 py-0.5 font-bold whitespace-nowrap">
                              進入管理後台
                            </Badge>
                            {log.routePath && (
                              <div className="text-[10px] font-mono text-slate-500 truncate max-w-[145px]">
                                入口: {log.routePath}
                              </div>
                            )}
                          </div>
                        ) : log.loginMethod === 'google' ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-xs px-2 py-0.5 font-bold whitespace-nowrap">
                            Google 登入
                          </Badge>
                        ) : log.loginMethod === 'register' ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs px-2 py-0.5 font-bold whitespace-nowrap">
                            新會員註冊
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200 text-xs px-2 py-0.5 font-bold whitespace-nowrap">
                            帳號密碼登入
                          </Badge>
                        )}
                      </TableCell>

                      {/* 登入 IP */}
                      <TableCell className="align-top py-3.5">
                        <div className="space-y-0.5">
                          <button
                            type="button"
                            onClick={() => handleCopy(log.ip, 'IP 位址')}
                            className="font-mono tabular-nums text-xs font-bold text-slate-800 hover:text-cyan-600 flex items-center gap-1 group cursor-pointer"
                            title="點擊複製 IP"
                          >
                            <span>{log.ip || '未知 IP'}</span>
                            {copiedId === log.ip ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </button>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {log.isBackendEntry ? '後台管理連線' : '前台客戶端'}
                          </p>
                        </div>
                      </TableCell>

                      {/* 裝置與系統 */}
                      <TableCell className="align-top py-3.5">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                            {log.device === 'mobile' ? (
                              <Smartphone className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            ) : log.device === 'tablet' ? (
                              <Tablet className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            ) : (
                              <Laptop className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                            )}
                            <span className="truncate">{log.os || '桌面系統'}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate" title={log.userAgent}>
                            {log.browser || '標準瀏覽器'}
                          </p>
                        </div>
                      </TableCell>

                      {/* 操作 */}
                      <TableCell className="align-top py-3.5 pr-6 text-right">
                        <div className="flex flex-col items-end gap-1">
                          {log.isAdminAccount && (log.email || log.userId) && (
                            <Link
                              href={`/admin/activity-logs?admin=${encodeURIComponent(
                                log.email || log.userId
                              )}`}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs font-bold text-amber-800 hover:text-amber-900 hover:bg-amber-100/70 rounded-lg px-2 gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <span>操作日誌</span>
                                <FileText className="w-3 h-3" />
                              </Button>
                            </Link>
                          )}
                          <Link href={`/admin/users?search=${encodeURIComponent(log.userId)}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs font-bold text-slate-700 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg px-2 gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <span>帳號詳情</span>
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* 分頁按鈕 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              第 <strong className="text-slate-900 font-mono tabular-nums">{currentPage}</strong> /{' '}
              <strong className="font-mono tabular-nums">{totalPages}</strong> 頁
            </span>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 rounded-lg text-xs font-bold border-slate-200 hover:bg-white cursor-pointer"
              >
                上一頁
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 rounded-lg text-xs font-bold border-slate-200 hover:bg-white cursor-pointer"
              >
                下一頁
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
