'use client';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfMonth, endOfMonth, getYear, getMonth } from 'date-fns';
import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { Gem, RefreshCw, User, Info, ArrowDownLeft, Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PPlusIcon } from '@/components/icons';
import type { UserProfile } from '@/types/user-profile';

interface Transaction {
    id: string;
    userId: string;
    transactionDate: { seconds: number };
    amount: number;
    currency?: 'diamond' | 'p-point';
    transactionType: 'QuickSell';
    details?: string;
}

const years = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i);
const months = Array.from({ length: 12 }, (_, i) => ({ value: i, label: `${i + 1}月` }));

function parseQuickSellDetails(details?: string) {
    if (!details) return { count: '?', names: '-' };
    const countMatch = details.match(/快速轉點 (\d+) 張卡片/);
    const namesMatch = details.match(/卡片內容: \[(.*)\]/);
    
    return {
        count: countMatch ? countMatch[1] : '?',
        names: namesMatch ? namesMatch[1] : '-'
    };
}

export default function ConversionsAdminPage() {
  const firestore = useFirestore();
  const [currentYear, setCurrentYear] = useState(getYear(new Date()).toString());
  const [currentMonth, setCurrentMonth] = useState(getMonth(new Date()).toString());
  const [searchTerm, setSearchTerm] = useState('');

  const conversionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'transactions'), 
        where('transactionType', '==', 'QuickSell')
    );
  }, [firestore]);

  const { data: transactions, isLoading: isLoadingTx } = useCollection<Transaction>(conversionsQuery);

  const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);

  const userMap = useMemo(() => {
      const map: Record<string, string> = {};
      users?.forEach(u => map[u.id] = u.username);
      return map;
  }, [users]);

  const filteredTransactions = useMemo(() => {
      if (!transactions) return [];

      const selectedDate = new Date(parseInt(currentYear), parseInt(currentMonth));
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);
      
      return transactions
        .filter(tx => {
            if (!tx.transactionDate) return false;
            const txDate = new Date(tx.transactionDate.seconds * 1000);
            const inDateRange = txDate >= monthStart && txDate <= monthEnd;
            if (!inDateRange) return false;

            if (searchTerm.trim()) {
                const username = userMap[tx.userId]?.toLowerCase() || '';
                const uid = tx.userId?.toLowerCase() || '';
                const details = tx.details?.toLowerCase() || '';
                const term = searchTerm.toLowerCase();
                return username.includes(term) || uid.includes(term) || details.includes(term);
            }
            return true;
        })
        .sort((a,b) => b.transactionDate.seconds - a.transactionDate.seconds);
  }, [transactions, currentYear, currentMonth, searchTerm, userMap]);

  const stats = useMemo(() => {
      return filteredTransactions.reduce((acc, tx) => {
          if (tx.currency === 'p-point') acc.pPoints += tx.amount;
          else acc.diamonds += tx.amount;
          acc.totalCards += parseInt(parseQuickSellDetails(tx.details).count) || 0;
          return acc;
      }, { diamonds: 0, pPoints: 0, totalCards: 0 });
  }, [filteredTransactions]);

  const isLoading = isLoadingTx || isLoadingUsers;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <RefreshCw className="h-7 w-7 text-cyan-600" /> 卡牌轉點與回收紀錄
            </h1>
            <p className="mt-1 text-sm text-slate-500 font-medium">
                追蹤玩家將未出貨卡牌轉換為點數（快速轉點）的歷史流水與卡牌回收明細。
            </p>
        </div>
        <div className="flex items-center gap-2">
            <Select value={currentYear} onValueChange={setCurrentYear}>
                <SelectTrigger className="w-[110px] h-9 bg-white border-slate-200 text-xs font-bold">
                    <SelectValue placeholder="年份" />
                </SelectTrigger>
                <SelectContent>
                    {years.map(year => <SelectItem key={year} value={year.toString()} className="text-xs font-bold">{year}年</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={currentMonth} onValueChange={setCurrentMonth}>
                <SelectTrigger className="w-[100px] h-9 bg-white border-slate-200 text-xs font-bold">
                    <SelectValue placeholder="月份" />
                </SelectTrigger>
                <SelectContent>
                    {months.map(month => <SelectItem key={month.value} value={month.value.toString()} className="text-xs font-bold">{month.label}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                  <CardTitle className="text-[11px] uppercase font-black text-slate-400 tracking-wider">
                      本月回收支出 (鑽石)
                  </CardTitle>
                  <Gem className="h-4 w-4 text-cyan-600" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                  <p className="text-2xl font-black font-code text-cyan-700">{stats.diamonds.toLocaleString()}</p>
                  <p className="text-[11px] text-slate-400 font-bold mt-0.5">系統折抵發放鑽石</p>
              </CardContent>
          </Card>
          <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                  <CardTitle className="text-[11px] uppercase font-black text-slate-400 tracking-wider">
                      本月回收支出 (P點)
                  </CardTitle>
                  <PPlusIcon className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                  <p className="text-2xl font-black font-code text-amber-600">{stats.pPoints.toLocaleString()}</p>
                  <p className="text-[11px] text-slate-400 font-bold mt-0.5">系統折抵發放 P 點</p>
              </CardContent>
          </Card>
          <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                  <CardTitle className="text-[11px] uppercase font-black text-slate-400 tracking-wider">
                      本月回收總卡數
                  </CardTitle>
                  <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                  <p className="text-2xl font-black font-code text-slate-900">{stats.totalCards.toLocaleString()} <span className="text-xs font-bold text-slate-400">張</span></p>
                  <p className="text-[11px] text-slate-400 font-bold mt-0.5">庫存已自動回收重置</p>
              </CardContent>
          </Card>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input 
                  placeholder="搜尋會員帳號或卡牌名稱..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 bg-white border-slate-200 rounded-xl text-xs font-medium"
              />
          </div>
      </div>
      
      {/* Table */}
      <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl overflow-hidden">
        <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
                <CardTitle className="text-base font-black text-slate-900">轉點回收紀錄明細</CardTitle>
                <CardDescription className="text-xs text-slate-500 font-medium">
                    共 {filteredTransactions.length} 筆回收交易
                </CardDescription>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="pl-6 text-[11px] font-black uppercase text-slate-400">會員資訊</TableHead>
                  <TableHead className="text-[11px] font-black uppercase text-slate-400 text-center">張數</TableHead>
                  <TableHead className="text-[11px] font-black uppercase text-slate-400">回收點數</TableHead>
                  <TableHead className="text-[11px] font-black uppercase text-slate-400">回收卡片明細</TableHead>
                  <TableHead className="text-right pr-6 text-[11px] font-black uppercase text-slate-400">交易時間</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="p-4"><Skeleton className="h-10 w-full rounded-xl" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredTransactions.length > 0 ? (
                  filteredTransactions.map((tx) => {
                    const { count, names } = parseQuickSellDetails(tx.details);
                    return (
                        <TableRow key={tx.id} className="hover:bg-slate-50/50 border-slate-100">
                            <TableCell className="pl-6 py-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                                        <User className="h-3.5 w-3.5 text-slate-400" />
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-xs font-black text-slate-900 truncate max-w-[130px]">{userMap[tx.userId] || '未知會員'}</p>
                                        <p className="text-[10px] font-mono text-slate-400 truncate">{tx.userId.slice(0, 10)}...</p>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="text-center font-bold text-xs text-slate-800">
                                {count} 張
                            </TableCell>
                            <TableCell>
                                <div className={cn(
                                    "flex items-center font-code font-black text-xs",
                                    tx.currency === 'p-point' ? "text-amber-600" : "text-emerald-600"
                                )}>
                                    +{tx.amount.toLocaleString()} 
                                    {tx.currency === 'p-point' ? <PPlusIcon className="h-3 w-3 ml-1" /> : <Gem className="h-3 w-3 ml-1 text-cyan-600" />}
                                </div>
                            </TableCell>
                            <TableCell className="max-w-[280px]">
                                <p className="text-xs font-medium text-slate-600 truncate">{names}</p>
                            </TableCell>
                            <TableCell className="text-right pr-6 text-[11px] font-mono font-bold text-slate-400">
                                {tx.transactionDate ? format(new Date(tx.transactionDate.seconds * 1000), 'yyyy-MM-dd HH:mm') : '-'}
                            </TableCell>
                        </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-xs text-slate-400 font-bold">
                        此月份期間尚無任何轉點回收紀錄。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
