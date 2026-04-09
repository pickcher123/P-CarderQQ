'use client';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth, endOfMonth, getYear, getMonth } from 'date-fns';
import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { Gem, User as UserIcon, Search, Calculator, TrendingUp } from 'lucide-react';
import type { UserProfile } from '@/types/user-profile';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PPlusIcon } from '@/components/icons';

type TransactionType = 'Purchase' | 'Deposit' | 'Withdrawal' | 'QuickSell' | 'Refund';
type TransactionSection = 'draw' | 'lucky-bag' | 'betting' | 'admin' | 'shipping' | 'group-break' | 'deposit';

interface Transaction {
    id: string;
    userId: string;
    transactionDate: { seconds: number };
    amount: number;
    transactionType: TransactionType;
    section?: TransactionSection;
    details?: string;
    currency?: 'diamond' | 'p-point';
}

const sectionTabs: {value: TransactionSection | 'all', label: string}[] = [
    { value: 'all', label: '全部遊戲' },
    { value: 'draw', label: '抽卡專區' },
    { value: 'lucky-bag', label: '福袋專區' },
    { value: 'betting', label: '拼卡專區' },
    { value: 'group-break', label: '團拆專區' },
];

const years = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i);
const months = Array.from({ length: 12 }, (_, i) => ({ value: i, label: `${i + 1}月` }));

function translateDetails(details?: string): string {
    if (typeof details !== 'string' || !details) return '-';

    // 1. 抽卡專區
    let match = details.match(/^Draw (\d+) from pool: (.*)$/);
    if (match) return `從「${match[2]}」卡池抽 ${match[1]} 次`;

    match = details.match(/^Won (.*) P-Points from pool: (.*)$/);
    if (match) return `從「${match[2]}」卡池贏得 ${match[1]} P點`;

    // 2. 拼卡專區
    match = details.match(/^Bet on (.*)\. Currency: (.*)\. Spots: \[(.*)\]\. Result: (.*)\. Win: (.*)$/);
    if (match) {
        const [_, cardName, currency, spots, result, didWin] = match;
        const curName = currency === 'diamond' ? '鑽石' : 'P點';
        const winText = didWin === 'true' ? '中獎' : '未中獎';
        return `拼卡「${cardName}」(${curName})。選號: [${spots}]。結果: ${result} (${winText})`;
    }

    match = details.match(/^Direct purchase of card: (.*) via (.*)$/);
    if (match) {
        const [_, cardName, currency] = match;
        const curName = currency === 'diamond' ? '鑽石' : 'P點';
        return `直購卡片: ${cardName} (${curName})`;
    }

    // 3. 福袋專區
    match = details.match(/^Purchased (\d+) spots in Luck Bag: (.*)$/);
    if (match) return `購買「${match[2]}」福袋 ${match[1]} 格`;

    // 4. 團拆專區
    if (details.startsWith('購買')) return details;

    // 5. 紅利兌換
    if (details.startsWith('紅利兌換:')) return details;

    return details;
}

export default function OrdersAdminPage() {
  const firestore = useFirestore();
  const [currentYear, setCurrentYear] = useState(getYear(new Date()).toString());
  const [currentMonth, setCurrentMonth] = useState(getMonth(new Date()).toString());
  const [activeTab, setActiveTab] = useState<TransactionSection | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');


  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'transactions'));
  }, [firestore]);

  const { data: transactions, isLoading } = useCollection<Transaction>(transactionsQuery);

  const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const { data: users } = useCollection<UserProfile>(usersQuery);

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
            const isInMonth = txDate >= monthStart && txDate <= monthEnd;
            if (!isInMonth) return false;

            const gameSections = ['draw', 'lucky-bag', 'betting', 'group-break'];
            const matchesTab = activeTab === 'all' ? gameSections.includes(tx.section || '') : tx.section === activeTab;
            if (!matchesTab) return false;

            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const userName = userMap[tx.userId]?.toLowerCase() || '';
                const details = tx.details?.toLowerCase() || '';
                return userName.includes(term) || details.includes(term);
            }

            return true;
        })
        .sort((a,b) => b.transactionDate.seconds - a.transactionDate.seconds);
  }, [transactions, currentYear, currentMonth, activeTab, searchTerm, userMap]);

  const filteredStats = useMemo(() => {
      return filteredTransactions.reduce((acc, tx) => {
          // 交易紀錄中消耗為負數，所以取絕對值作為銷售額
          const amount = Math.abs(tx.amount);
          if (tx.currency === 'p-point') acc.pPoints += amount;
          else acc.diamonds += amount;
          return acc;
      }, { diamonds: 0, pPoints: 0 });
  }, [filteredTransactions]);

  return (
    <div className="container mx-auto p-6 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="font-headline text-3xl font-black tracking-tight text-slate-900">交易紀錄中心</h1>
            <p className="mt-2 text-slate-600 font-bold">追蹤所有遊戲專區的消耗細節，支援關鍵字搜尋特定卡池銷售額。</p>
        </div>
        <div className="flex gap-2">
            <Select value={currentYear} onValueChange={setCurrentYear}>
                <SelectTrigger className="w-[120px] bg-white border-slate-200 font-bold">
                    <SelectValue placeholder="年份" />
                </SelectTrigger>
                <SelectContent>
                    {years.map(year => <SelectItem key={year} value={year.toString()} className="font-bold">{year}年</SelectItem>)}
                </SelectContent>
            </Select>
                <Select value={currentMonth} onValueChange={setCurrentMonth}>
                <SelectTrigger className="w-[120px] bg-white border-slate-200 font-bold">
                    <SelectValue placeholder="月份" />
                </SelectTrigger>
                <SelectContent>
                    {months.map(month => <SelectItem key={month.value} value={month.value.toString()} className="font-bold">{month.label}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
      </div>

      {/* 搜尋列與即時統計 */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-end">
          <div className="xl:col-span-2 space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">搜尋關鍵字 (卡池名稱、會員、詳情)</Label>
              <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="輸入關鍵字篩選..." 
                    className="pl-10 h-12 bg-white border-slate-200 rounded-xl shadow-sm font-bold"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
          </div>
          <div className="p-4 bg-slate-900 rounded-xl border-none shadow-lg flex items-center justify-between">
              <div className="space-y-0.5">
                  <p className="text-[9px] font-black uppercase text-primary tracking-widest">當前篩選鑽石營收</p>
                  <div className="flex items-center gap-2">
                      <span className="text-xl font-black font-code text-white">{filteredStats.diamonds.toLocaleString()}</span>
                      <Gem className="h-4 w-4 text-primary" />
                  </div>
              </div>
              <TrendingUp className="h-8 w-8 text-primary opacity-20" />
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div className="space-y-0.5">
                  <p className="text-[9px] font-black uppercase text-amber-600 tracking-widest">當前篩選 P 點消耗</p>
                  <div className="flex items-center gap-2">
                      <span className="text-xl font-black font-code text-slate-900">{filteredStats.pPoints.toLocaleString()}</span>
                      <PPlusIcon className="h-4 w-4 text-amber-500" />
                  </div>
              </div>
              <Calculator className="h-8 w-8 text-slate-200" />
          </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="bg-slate-200/50 p-1 rounded-2xl h-14 w-full md:w-fit grid grid-cols-5 md:flex border border-slate-200 shadow-inner">
          {sectionTabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="rounded-xl px-6 font-black text-xs data-[state=active]:bg-white data-[state=active]:shadow-md transition-all">
                {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={activeTab} className="mt-6">
             <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-md">
                <Table>
                <TableHeader className="bg-slate-50">
                    <TableRow className="border-b-slate-200">
                    <TableHead className="pl-8 text-[10px] font-black uppercase text-slate-900 tracking-widest py-5">會員資訊</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-900 tracking-widest">專區類別</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-900 tracking-widest">變動金額</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-900 tracking-widest">交易詳情說明</TableHead>
                    <TableHead className="pr-8 text-right text-[10px] font-black uppercase text-slate-900 tracking-widest">交易時間</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ?
                    Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                        <TableCell colSpan={5} className="p-6"><Skeleton className="h-10 w-full rounded-xl" /></TableCell>
                        </TableRow>
                    )) :
                    filteredTransactions.map((tx) => (
                    <TableRow key={tx.id} className="hover:bg-slate-50/50 transition-colors border-slate-100 group">
                        <TableCell className="pl-8 py-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                                    <UserIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-900" />
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-sm font-black text-slate-900 truncate max-w-[150px]">{userMap[tx.userId] || '未知用戶'}</p>
                                    <p className="text-[10px] font-mono font-bold text-slate-400 truncate">{tx.userId}</p>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline" className="capitalize text-[10px] border-slate-200 text-slate-500 font-black tracking-tighter bg-white px-2.5 h-6">
                                {tx.section === 'draw' ? '抽卡專區' : 
                                 tx.section === 'lucky-bag' ? '福袋專區' : 
                                 tx.section === 'betting' ? '拼卡專區' : 
                                 tx.section === 'group-break' ? '團拆專區' : 
                                 tx.section === 'shipping' ? '出貨物流' : tx.section || '-'}
                            </Badge>
                        </TableCell>
                        <TableCell className={cn("font-code font-black text-base", tx.amount > 0 ? 'text-emerald-600' : 'text-slate-900')}>
                            <div className="flex items-center gap-1.5">
                                {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} 
                                {tx.currency === 'p-point' ? <PPlusIcon className="h-4 w-4" /> : <Gem className={cn("h-4 w-4", tx.amount < 0 ? "text-cyan-600" : "text-emerald-600")} />}
                            </div>
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-600 max-w-[300px] leading-relaxed">
                            {translateDetails(tx.details)}
                        </TableCell>
                        <TableCell className="text-right pr-8 text-[10px] font-code font-bold text-slate-400">
                            {tx.transactionDate ? format(new Date(tx.transactionDate.seconds * 1000), 'yyyy-MM-dd HH:mm') : 'N/A'}
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
                {!isLoading && filteredTransactions.length === 0 && (
                <div className="text-center py-32 text-slate-400 font-bold italic flex flex-col items-center gap-4">
                    <Search className="h-12 w-12 opacity-10" />
                    <p>此搜尋條件下沒有找到任何交易紀錄。</p>
                </div>
                )}
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
