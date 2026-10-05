'use client';

import React, { useState, useMemo } from 'react';
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
  Calendar, 
  Filter, 
  ExternalLink,
  Users,
  Activity,
  Globe,
  Clock,
  ArrowUpDown
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { format, isToday, isYesterday, subDays, isAfter, parseISO } from 'date-fns';
import { zhTW } from 'date-fns/locale';

interface UserLoginLog {
  id: string;
  userId: string;
  email?: string;
  username?: string;
  photoURL?: string | null;
  loginMethod: 'google' | 'email' | 'register' | string;
  loginMethodName?: string;
  ip: string;
  device?: 'desktop' | 'mobile' | 'tablet' | string;
  browser?: string;
  os?: string;
  userAgent?: string;
  status?: string;
  createdAt?: any;
  loginTime?: string;
}

export default function UserLoginLogsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  // 搜尋與篩選狀態
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all'); // all, today, yesterday, 7days, 30days
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 查詢最近 500 筆登入歷史
  const logsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'userLoginLogs'), orderBy('createdAt', 'desc'), limit(500)) : null),
    [firestore]
  );
  const { data: rawLogs, isLoading, forceRefetch } = useCollection<UserLoginLog>(logsQuery);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (forceRefetch) await forceRefetch();
    setTimeout(() => {
      setIsRefreshing(false);
      toast({ title: '已重新整理', description: '玩家登入紀錄已更新至最新數據' });
    }, 400);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast({ title: '已複製', description: `${label} 已複製到剪貼簿` });
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 解析日期輔助函式
  const getLogDate = (log: UserLoginLog): Date | null => {
    if (log.createdAt?.toDate) return log.createdAt.toDate();
    if (log.createdAt?.seconds) return new Date(log.createdAt.seconds * 1000);
    if (log.loginTime) {
      const d = parseISO(log.loginTime);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  // 統計數據計算
  const stats = useMemo(() => {
    if (!rawLogs) return { todayTotal: 0, todayUnique: 0, googleCount: 0, emailCount: 0, mobileCount: 0, desktopCount: 0 };

    const now = new Date();
    const todayUsers = new Set<string>();
    let todayTotal = 0;
    let googleCount = 0;
    let emailCount = 0;
    let mobileCount = 0;
    let desktopCount = 0;

    rawLogs.forEach((log) => {
      const logDate = getLogDate(log);
      const isLogToday = logDate ? isToday(logDate) : false;

      if (isLogToday) {
        todayTotal++;
        if (log.userId) todayUsers.add(log.userId);
      }

      if (log.loginMethod === 'google') googleCount++;
      else if (log.loginMethod === 'email' || log.loginMethod === 'register') emailCount++;

      if (log.device === 'mobile' || log.device === 'tablet') mobileCount++;
      else desktopCount++;
    });

    return {
      todayTotal,
      todayUnique: todayUsers.size,
      googleCount,
      emailCount,
      mobileCount,
      desktopCount,
    };
  }, [rawLogs]);

  // 篩選後資料
  const filteredLogs = useMemo(() => {
    if (!rawLogs) return [];

    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);
    const thirtyDaysAgo = subDays(now, 30);

    return rawLogs.filter((log) => {
      // 1. 關鍵字搜尋 (暱稱, Email, UID, IP, OS, 瀏覽器)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = log.username?.toLowerCase().includes(term);
        const matchEmail = log.email?.toLowerCase().includes(term);
        const matchUid = log.userId?.toLowerCase().includes(term);
        const matchIp = log.ip?.toLowerCase().includes(term);
        const matchBrowser = log.browser?.toLowerCase().includes(term);
        const matchOs = log.os?.toLowerCase().includes(term);
        if (!matchName && !matchEmail && !matchUid && !matchIp && !matchBrowser && !matchOs) {
          return false;
        }
      }

      // 2. 登入方式篩選
      if (methodFilter !== 'all') {
        if (log.loginMethod !== methodFilter) return false;
      }

      // 3. 裝置類型篩選
      if (deviceFilter !== 'all') {
        if (log.device !== deviceFilter) return false;
      }

      // 4. 日期區間篩選
      if (dateFilter !== 'all') {
        const logDate = getLogDate(log);
        if (!logDate) return false;
        if (dateFilter === 'today' && !isToday(logDate)) return false;
        if (dateFilter === 'yesterday' && !isYesterday(logDate)) return false;
        if (dateFilter === '7days' && !isAfter(logDate, sevenDaysAgo)) return false;
        if (dateFilter === '30days' && !isAfter(logDate, thirtyDaysAgo)) return false;
      }

      return true;
    });
  }, [rawLogs, searchTerm, methodFilter, deviceFilter, dateFilter]);

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

    const headers = ['登入時間', '玩家暱稱', 'Email', 'User UID', '登入方式', 'IP 位址', '裝置類型', '作業系統', '瀏覽器'];
    const rows = filteredLogs.map((log) => {
      const d = getLogDate(log);
      const timeStr = d ? format(d, 'yyyy-MM-dd HH:mm:ss') : (log.loginTime || '未知');
      return [
        `"${timeStr}"`,
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
    link.setAttribute('download', `P-Carder_玩家登入紀錄_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: '匯出成功', description: `已成功匯出 ${filteredLogs.length} 筆登入歷史紀錄。` });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 頂部標題區 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 shadow-sm">
              <LogIn className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                玩家登入紀錄
                <Badge variant="outline" className="font-mono text-xs bg-slate-50 text-slate-600 border-slate-200">
                  即時軌跡
                </Badge>
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                追蹤全站會員登入時間、IP 位址、裝置系統與安全歷程，保障帳號安全
              </p>
            </div>
          </div>
        </div>

        {/* 右側操作按鈕 */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-xl border-slate-200 hover:bg-slate-50 font-bold text-slate-700 text-xs gap-1.5 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-600' : ''}`} />
            <span>重新整理</span>
          </Button>

          <Button
            size="sm"
            onClick={handleExportCsv}
            disabled={filteredLogs.length === 0}
            className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1.5 shadow-md shadow-slate-900/10 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>匯出 CSV 報表</span>
          </Button>
        </div>
      </div>

      {/* 4 核心統計指標卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 今日登入總人次 */}
        <Card className="rounded-2xl border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>今日登入人次</span>
              <Activity className="w-4 h-4 text-cyan-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.todayTotal.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400">當日登入事件累計</p>
          </CardContent>
        </Card>

        {/* 今日活躍玩家數 */}
        <Card className="rounded-2xl border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>今日活躍玩家</span>
              <Users className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-600 font-mono">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.todayUnique.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400">獨立 UID 會員數</p>
          </CardContent>
        </Card>

        {/* Google 登入比例 */}
        <Card className="rounded-2xl border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Google 登入人次</span>
              <Globe className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.googleCount.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400">
              密碼登入: {stats.emailCount.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        {/* 手機 / 電腦比例 */}
        <Card className="rounded-2xl border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>行動裝置登入</span>
              <Smartphone className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-black text-indigo-600 font-mono">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stats.mobileCount.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400">
              電腦端: {stats.desktopCount.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 搜尋與篩選控制面板 */}
      <Card className="rounded-2xl border-slate-200/80 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* 搜尋框 */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                placeholder="搜尋玩家暱稱、Email、UID、登入 IP 或瀏覽器..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 h-10 rounded-xl bg-slate-50/80 border-slate-200 text-xs sm:text-sm focus:bg-white transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
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
                <SelectTrigger className="h-10 w-[125px] rounded-xl text-xs font-bold border-slate-200 bg-white">
                  <SelectValue placeholder="登入方式" />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-xs">
                  <SelectItem value="all">全部方式</SelectItem>
                  <SelectItem value="google">Google 登入</SelectItem>
                  <SelectItem value="email">帳號密碼</SelectItem>
                  <SelectItem value="register">新註冊</SelectItem>
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
                <SelectContent className="rounded-xl text-xs">
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
                <SelectContent className="rounded-xl text-xs">
                  <SelectItem value="all">所有日期</SelectItem>
                  <SelectItem value="today">今日登入</SelectItem>
                  <SelectItem value="yesterday">昨日登入</SelectItem>
                  <SelectItem value="7days">近 7 天</SelectItem>
                  <SelectItem value="30days">近 30 天</SelectItem>
                </SelectContent>
              </Select>

              {/* 重設按鈕 */}
              {(searchTerm || methodFilter !== 'all' || deviceFilter !== 'all' || dateFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setMethodFilter('all');
                    setDeviceFilter('all');
                    setDateFilter('all');
                    setCurrentPage(1);
                  }}
                  className="h-10 rounded-xl text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-bold px-3"
                >
                  重設篩選
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span>
              共篩選出 <strong className="text-slate-900 font-mono">{filteredLogs.length}</strong> 筆登入歷史紀錄
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
                <SelectContent className="rounded-lg text-xs">
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
      <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80 border-b border-slate-200">
              <TableRow>
                <TableHead className="font-bold text-slate-700 text-xs w-[180px]">登入時間</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs w-[240px]">玩家資訊</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs w-[130px]">登入方式</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs w-[150px]">登入 IP</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs w-[220px]">裝置與系統</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs text-center w-[100px]">狀態</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs text-right w-[110px]">操作</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-9 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-14 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <LogIn className="w-6 h-6" />
                    </div>
                    <p className="text-slate-600 font-bold text-sm">找不到符合條件的登入紀錄</p>
                    <p className="text-slate-400 text-xs">請嘗試調整搜尋關鍵字或篩選日期與方式</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLogs.map((log) => {
                  const logDate = getLogDate(log);
                  const isLogToday = logDate ? isToday(logDate) : false;
                  const isLogYesterday = logDate ? isYesterday(logDate) : false;

                  return (
                    <TableRow key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* 登入時間 */}
                      <TableCell className="align-top py-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            {isLogToday && (
                              <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/30 text-[10px] px-1.5 py-0 h-4.5 font-bold">
                                今日
                              </Badge>
                            )}
                            {isLogYesterday && (
                              <Badge className="bg-amber-500/10 text-amber-700 hover:bg-amber-500/10 border-amber-500/30 text-[10px] px-1.5 py-0 h-4.5 font-bold">
                                昨日
                              </Badge>
                            )}
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {logDate ? format(logDate, 'HH:mm:ss') : '-'}
                            </span>
                          </div>
                          <p className="font-mono text-[11px] text-slate-400">
                            {logDate ? format(logDate, 'yyyy-MM-dd') : (log.loginTime || '-')}
                          </p>
                        </div>
                      </TableCell>

                      {/* 玩家資訊 */}
                      <TableCell className="align-top py-3">
                        <div className="flex items-start gap-2.5">
                          <Avatar className="w-8 h-8 rounded-xl border border-slate-200 mt-0.5 shrink-0">
                            {log.photoURL && <AvatarImage src={log.photoURL} alt={log.username} />}
                            <AvatarFallback className="bg-slate-900 text-white font-black text-xs rounded-xl">
                              {(log.username || log.email || 'U')[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 space-y-0.5">
                            <p className="font-black text-slate-900 text-xs sm:text-sm truncate">
                              {log.username || '匿名玩家'}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">{log.email || '未綁定信箱'}</p>
                            <button
                              onClick={() => handleCopy(log.userId, 'UID')}
                              className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-cyan-600 transition-colors group cursor-pointer"
                              title="點擊複製完整 UID"
                            >
                              <span>UID: {log.userId.slice(0, 8)}...</span>
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
                      <TableCell className="align-top py-3">
                        {log.loginMethod === 'google' ? (
                          <Badge className="bg-amber-500/10 text-amber-800 hover:bg-amber-500/10 border-amber-500/30 text-xs px-2 py-0.5 font-bold gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Google
                          </Badge>
                        ) : log.loginMethod === 'register' ? (
                          <Badge className="bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/10 border-emerald-500/30 text-xs px-2 py-0.5 font-bold gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            新註冊
                          </Badge>
                        ) : (
                          <Badge className="bg-sky-500/10 text-sky-800 hover:bg-sky-500/10 border-sky-500/30 text-xs px-2 py-0.5 font-bold gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                            帳號密碼
                          </Badge>
                        )}
                      </TableCell>

                      {/* 登入 IP */}
                      <TableCell className="align-top py-3">
                        <div className="space-y-0.5">
                          <button
                            onClick={() => handleCopy(log.ip, 'IP 位址')}
                            className="font-mono text-xs font-bold text-slate-800 hover:text-cyan-600 flex items-center gap-1 group cursor-pointer"
                            title="點擊複製 IP"
                          >
                            <span>{log.ip || '127.0.0.1'}</span>
                            {copiedId === log.ip ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </button>
                          <p className="text-[10px] text-slate-400 font-medium">客戶端來源</p>
                        </div>
                      </TableCell>

                      {/* 裝置與系統 */}
                      <TableCell className="align-top py-3">
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

                      {/* 狀態 */}
                      <TableCell className="align-top py-3 text-center">
                        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200 text-[10px] font-bold px-2 py-0.5">
                          登入成功
                        </Badge>
                      </TableCell>

                      {/* 操作 */}
                      <TableCell className="align-top py-3 text-right">
                        <Link href={`/admin/users?search=${encodeURIComponent(log.userId)}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs font-bold text-slate-700 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg px-2 gap-1"
                          >
                            <span>會員詳情</span>
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </Link>
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
              第 <strong className="text-slate-900 font-mono">{currentPage}</strong> / <strong className="font-mono">{totalPages}</strong> 頁
            </span>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 rounded-lg text-xs font-bold border-slate-200 hover:bg-white"
              >
                上一頁
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 rounded-lg text-xs font-bold border-slate-200 hover:bg-white"
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
