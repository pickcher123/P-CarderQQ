'use client';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth, endOfMonth, getYear, getMonth } from 'date-fns';
import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { Gem, RefreshCw, Calendar, Sparkles, User, Info, ArrowDownLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
            return txDate >= monthStart && txDate <= monthEnd;
        })
        .sort((a,b) => b.transactionDate.seconds - a.transactionDate.seconds);
  }, [transactions, currentYear, currentMonth]);

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
    <div className="container mx-auto p-6 md:p-8 space-y-8 text-slate-900">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="font-headline text-3xl font-black tracking-tight flex items-center gap-3">
                <RefreshCw className="h-8 w-8 text-primary" /> 轉點紀錄管理
            </h1>
            <p className="mt-2 text-slate-600 font-bold">追蹤系統買回（快速轉點）卡片的詳細明細與支付點數。</p>
        </div>
        <div className="flex gap-2">
            <Select value={currentYear} onValueChange={setCurrentYear}>
                <SelectTrigger className="w-[120px] bg-white border-slate-200 font-bold text-slate-900">
                    <SelectValue placeholder="年份" />
                </SelectTrigger>
                <SelectContent>
                    {years.map(year => <SelectItem key={year} value={year.toString()} className="font-bold">{year}年</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={currentMonth} onValueChange={setCurrentMonth}>
                <SelectTrigger className="w-[120px] bg-white border-slate-200 font-bold text-slate-900">
                    <SelectValue placeholder="月份" />
                </SelectTrigger>
                <SelectContent>
                    {months.map(month => <SelectItem key={month.value} value={month.value.toString()} className="font-bold">{month.label}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="py-4">
                  <CardTitle className="text-[10px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2">
                      <Gem className="h-3.5 w-3.5 text-cyan-600" /> 本月回收支出 (鑽石)
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <p className="text-3xl font-black font-code text-cyan-700">{stats.diamonds.toLocaleString()}</p>
              </CardContent>
          </Card>
          <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="py-4">
                  <CardTitle className="text-[10px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2">
                      <PPlusIcon className="h-3.5 w-3.5 text-amber-600" /> 本月回收支出 (P點)
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <p className="text-3xl font-black font-code text-amber-600">{stats.pPoints.toLocaleString()}</p>
              </CardContent>
          </Card>
          <Card className="bg-slate-900 border-none shadow-xl">
              <CardHeader className="py-4">
                  <CardTitle className="text-[10px] uppercase font-black text-slate-400 tracking-widest flex items-center gap-2">
                      <ArrowDownLeft className="h-3.5 w-3.5 text-primary" /> 本月回收總張數
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <p className="text-3xl font-black font-code text-white">{stats.totalCards.toLocaleString()} <span className="text-xs font-bold text-slate-500 ml-1">ITEMS</span></p>
              </CardContent>
          </Card>
      </div>
      
      <Card className="border-slate-200 bg-white overflow-hidden shadow-sm rounded-2xl">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow className="border-b-slate-200">
              <TableHead className="pl-8 text-[10px] font-black uppercase text-slate-900 tracking-widest py-5">會員資訊</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-slate-900 tracking-widest text-center">張數</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-slate-900 tracking-widest">回購金額</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-slate-900 tracking-widest w-[35%]">收回卡片明細</TableHead>
              <TableHead className="text-right pr-8 text-[10px] font-black uppercase text-slate-900 tracking-widest">交易時間</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5} className="p-6"><Skeleton className="h-10 w-full rounded-xl" /></TableCell>
                </TableRow>
              ))}
            {!isLoading && filteredTransactions.map((tx) => {
                const { count, names } = parseQuickSellDetails(tx.details);
                return (
                    <TableRow key={tx.id} className="hover:bg-slate-50 transition-colors border-b-slate-100">
                        <TableCell className="pl-8 py-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                                    <User className="h-4 w-4 text-slate-400" />
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-sm font-black text-slate-900 truncate max-w-[150px]">{userMap[tx.userId] || '未知會員'}</p>
                                    <p className="text-[10px] font-mono font-bold text-slate-400 truncate">{tx.userId}</p>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell className="text-center font-black text-sm text-slate-900">{count} 張</TableCell>
                        <TableCell>
                            <div className={cn(
                                "flex items-center font-code font-black text-base",
                                tx.currency === 'p-point' ? "text-amber-600" : "text-emerald-600"
                            )}>
                                +{tx.amount.toLocaleString()} 
                                {tx.currency === 'p-point' ? <PPlusIcon className="h-3.5 w-3.5 ml-1" /> : <Gem className="h-3.5 w-3.5 ml-1 text-cyan-600" />}
                            </div>
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 max-w-sm">
                                <Info className="h-3 w-3 shrink-0 text-slate-400" />
                                <span className="truncate">{names}</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-right pr-8 text-[10px] font-code font-bold text-slate-400">
                            {tx.transactionDate ? format(new Date(tx.transactionDate.seconds * 1000), 'yyyy-MM-dd HH:mm') : 'N/A'}
                        </TableCell>
                    </TableRow>
                );
            })}
          </TableBody>
        </Table>
        {!isLoading && filteredTransactions.length === 0 && (
          <div className="text-center py-32 text-slate-400 font-bold italic flex flex-col items-center gap-4">
              <RefreshCw className="h-12 w-12 opacity-10" />
              <p>此月份目前沒有任何轉點回收紀錄。</p>
          </div>
        )}
      </Card>
    </div>
  );
}
