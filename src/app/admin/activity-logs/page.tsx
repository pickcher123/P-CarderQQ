'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileText,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Download,
  Eye,
  Clock,
  UserCheck,
  Filter,
  X,
  ArrowRight,
  Layers,
  AlertTriangle,
  Info,
  Globe,
  Monitor,
  Activity,
  KeyRound,
  DollarSign,
  Dices,
  PlusCircle,
  Package,
  LogIn,
} from 'lucide-react';
import { format, isToday, subDays, isAfter } from 'date-fns';
import { cn, toSafeDate } from '@/lib/utils';
import type { FieldChangeItem, AuditSeverity, AuditRiskTag } from '@/lib/admin-audit';

type FocusPreset =
  | 'all'
  | 'card_pool_all'
  | 'price_or_prob'
  | 'price_tamper'
  | 'prob_tamper'
  | 'card_pool_create'
  | 'admin_login'
  | 'points_perm';

interface ActivityLogDoc {
  id: string;
  adminUid?: string;
  userEmail?: string;
  userName?: string;
  adminRole?: 'superadmin' | 'admin';
  adminRoleLabel?: string;
  ipAddress?: string;
  userAgent?: string;
  routePath?: string;
  module?: string;
  moduleLabel?: string;
  operationType?: string;
  severity?: AuditSeverity;
  riskTags?: AuditRiskTag[];
  action?: string;
  targetCollection?: string;
  targetId?: string;
  targetName?: string;
  details?: string;
  changes?: FieldChangeItem[];
  batchCount?: number;
  batchItems?: string[];
  createdAt?: any;
}

interface EnrichedActivityLog extends ActivityLogDoc {
  isCardOrPool: boolean;
  isPriceTamper: boolean;
  isProbTamper: boolean;
  isCardPoolCreate: boolean;
  isCardPoolDelete: boolean;
  isAdminLogin: boolean;
}

const CARD_POOL_MODULES = new Set([
  'cards',
  'card-pools',
  'betting',
  'lucky-bags',
  'group-breaks',
]);

const CARD_POOL_COLLECTIONS = new Set([
  'allCards',
  'cardPools',
  'drawCategories',
  'betting-items',
  'bettingCategories',
  'luckBags',
  'lucky_wheels',
  'group_breaks',
]);

const PRICE_SENSITIVE_FIELDS = new Set([
  'sellPrice',
  'price',
  'price3Draws',
  'price10Draws',
  'pricePerDraw',
  'pricePerPack',
  'pointMultiplier',
  'currency',
]);

const PROB_SENSITIVE_FIELDS = new Set([
  '_computed_probability',
  'cards',
  'cardRarities',
  'pointPrizes',
  'lastPrizeCardId',
  'totalPacks',
  'remainingPacks',
  'kujiTickets',
  'totalTicketsCount',
  'enablePickNumber',
  'hasProtection',
  'prizes',
  'otherPrizes',
  'totalParticipants',
  'winners',
  'allCardIds',
  'soldCardIds',
]);

function isPriceField(fieldName: string): boolean {
  const clean = fieldName.includes('.') ? fieldName.split('.').pop() || fieldName : fieldName;
  return PRICE_SENSITIVE_FIELDS.has(fieldName) || PRICE_SENSITIVE_FIELDS.has(clean);
}

function isProbField(fieldName: string): boolean {
  if (
    PROB_SENSITIVE_FIELDS.has(fieldName) ||
    fieldName.startsWith('cardRarities.') ||
    fieldName.startsWith('prizes.')
  ) {
    return true;
  }
  const clean = fieldName.includes('.') ? fieldName.split('.').pop() || fieldName : fieldName;
  return PROB_SENSITIVE_FIELDS.has(clean);
}

function classifyCardPoolFlags(log: ActivityLogDoc): {
  isCardOrPool: boolean;
  isPriceTamper: boolean;
  isProbTamper: boolean;
  isCardPoolCreate: boolean;
  isCardPoolDelete: boolean;
} {
  const tags = Array.isArray(log.riskTags) ? log.riskTags : [];
  const changes = Array.isArray(log.changes) ? log.changes : [];
  const actionStr = log.action || '';
  const opType = log.operationType || '';

  const isCardOrPool =
    CARD_POOL_MODULES.has(log.module || '') ||
    CARD_POOL_COLLECTIONS.has(log.targetCollection || '') ||
    tags.includes('card_pool_create') ||
    tags.includes('price_tamper') ||
    tags.includes('prob_tamper');

  const isCreateOp =
    opType === 'create' ||
    tags.includes('card_pool_create') ||
    actionStr.includes('新增卡片') ||
    actionStr.includes('新建抽卡') ||
    actionStr.includes('新建一番') ||
    actionStr.includes('批次新增卡片');

  const isCardPoolCreate = isCardOrPool && isCreateOp;
  const isCardPoolDelete =
    isCardOrPool && (opType === 'delete' || actionStr.includes('刪除'));

  const touchedPriceInUpdate =
    !isCreateOp &&
    opType !== 'delete' &&
    changes.some((c) => isPriceField(c.field));

  const touchedProbInUpdate =
    !isCreateOp &&
    opType !== 'delete' &&
    changes.some((c) => isProbField(c.field));

  const isPriceTamper =
    tags.includes('price_tamper') ||
    opType === 'price_change' ||
    (isCardOrPool &&
      (touchedPriceInUpdate ||
        actionStr.includes('價格') ||
        actionStr.includes('回收市值') ||
        actionStr.includes('計價幣別') ||
        actionStr.includes('紅利倍率')));

  const isProbTamper =
    tags.includes('prob_tamper') ||
    opType === 'probability_change' ||
    (isCardOrPool &&
      (touchedProbInUpdate ||
        actionStr.includes('機率') ||
        actionStr.includes('稀有度') ||
        actionStr.includes('籤位') ||
        actionStr.includes('最後賞') ||
        actionStr.includes('包數配比') ||
        actionStr.includes('中獎號碼') ||
        actionStr.includes('重置一番福袋')));

  return {
    isCardOrPool,
    isPriceTamper,
    isProbTamper,
    isCardPoolCreate,
    isCardPoolDelete,
  };
}

const SEVERITY_CONFIG: Record<
  AuditSeverity,
  { label: string; badgeClass: string; rowClass: string; icon: any }
> = {
  critical: {
    label: '高風險敏感',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    rowClass: 'bg-rose-50/35 hover:bg-rose-50/70',
    icon: ShieldAlert,
  },
  warning: {
    label: '重要異動',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    rowClass: 'hover:bg-slate-50/90',
    icon: AlertTriangle,
  },
  info: {
    label: '一般操作',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    rowClass: 'hover:bg-slate-50/80',
    icon: Info,
  },
};

const MODULE_OPTIONS = [
  { value: 'all', label: '全部模組' },
  { value: 'card-pools', label: '抽卡卡池' },
  { value: 'cards', label: '卡片資產庫' },
  { value: 'betting', label: '拼卡專區' },
  { value: 'lucky-bags', label: '福袋與轉盤' },
  { value: 'group-breaks', label: '團拆管理' },
  { value: 'permissions', label: '管理員權限' },
  { value: 'points', label: '點數與帳務' },
  { value: 'users', label: '會員與帳戶' },
  { value: 'shipping', label: '出貨物流' },
  { value: 'rewards', label: '優惠與兌換獎品' },
  { value: 'coupons', label: '優惠券與推薦碼' },
  { value: 'agents', label: '代理業務' },
  { value: 'marketing', label: '行銷與公告' },
  { value: 'system', label: '系統與安全設定' },
  { value: 'auth', label: '後台登入存取' },
];

const OP_TYPE_OPTIONS = [
  { value: 'all', label: '全部動作類型' },
  { value: 'price_change', label: '價格 / 回收市值異動' },
  { value: 'probability_change', label: '機率 / 獎項配比異動' },
  { value: 'points', label: '點數 / 票券調整' },
  { value: 'permission', label: '權限 / 角色變更' },
  { value: 'create', label: '新增建立' },
  { value: 'update', label: '修改更新' },
  { value: 'delete', label: '刪除移除' },
  { value: 'batch', label: '批次操作' },
  { value: 'system', label: '系統設定' },
  { value: 'api', label: '後端 API 執行' },
  { value: 'login', label: '登入管理後台' },
];

function parseBrowserSummary(ua?: string): string {
  if (!ua) return '未知裝置';
  const os = ua.includes('Windows')
    ? 'Windows'
    : ua.includes('Mac OS')
    ? 'macOS'
    : ua.includes('iPhone') || ua.includes('iPad')
    ? 'iOS'
    : ua.includes('Android')
    ? 'Android'
    : 'Linux/Other';
  const browser = ua.includes('Edg/')
    ? 'Edge'
    : ua.includes('Chrome/')
    ? 'Chrome'
    : ua.includes('Safari/') && !ua.includes('Chrome/')
    ? 'Safari'
    : ua.includes('Firefox/')
    ? 'Firefox'
    : 'Browser';
  return `${os} · ${browser}`;
}

export default function ActivityLogsPage() {
  const firestore = useFirestore();

  const [fetchLimit, setFetchLimit] = useState<number>(300);
  const [focusPreset, setFocusPreset] = useState<FocusPreset>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAdmin, setSelectedAdmin] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedOpType, setSelectedOpType] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | '3d' | '7d' | '30d'>('all');
  const [selectedLog, setSelectedLog] = useState<EnrichedActivityLog | null>(null);

  // 支援網址帶入 ?admin=xxx@gmail.com、?search=xxx 或 ?focus=price_tamper
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const adminParam = params.get('admin');
      const searchParam = params.get('search');
      const focusParam = params.get('focus') as FocusPreset | null;
      if (adminParam) setSelectedAdmin(adminParam);
      if (searchParam) setSearchTerm(searchParam);
      if (
        focusParam &&
        [
          'all',
          'card_pool_all',
          'price_or_prob',
          'price_tamper',
          'prob_tamper',
          'card_pool_create',
          'admin_login',
          'points_perm',
        ].includes(focusParam)
      ) {
        setFocusPreset(focusParam);
      }
    }
  }, []);

  const logsQuery = useMemoFirebase(
    () =>
      firestore
        ? query(
            collection(firestore, 'activityLogs'),
            orderBy('createdAt', 'desc'),
            limit(fetchLimit)
          )
        : null,
    [firestore, fetchLimit]
  );
  const { data: rawLogs, isLoading, forceRefetch } = useCollection<ActivityLogDoc>(logsQuery);

  // 正規化、套用卡片/卡池防竄改分類標籤，並依時間倒序排列
  const normalizedLogs = useMemo<EnrichedActivityLog[]>(() => {
    if (!rawLogs) return [];
    return [...rawLogs]
      .map((log) => {
        const flags = classifyCardPoolFlags(log);
        const autoCritical =
          flags.isPriceTamper ||
          flags.isProbTamper ||
          flags.isCardPoolDelete ||
          log.action?.includes('刪除') ||
          log.action?.includes('權限') ||
          log.action?.includes('點數');

        const severity: AuditSeverity = autoCritical
          ? 'critical'
          : log.severity === 'critical' || log.severity === 'warning' || log.severity === 'info'
          ? log.severity
          : 'info';

        const isAdminLogin =
          log.operationType === 'login' ||
          log.module === 'auth' ||
          Boolean(
            log.action?.includes('進入管理後台') ||
              log.action?.includes('登入進入後台') ||
              log.action?.includes('登入管理後台')
          );

        return {
          ...log,
          ...flags,
          isAdminLogin,
          severity,
          userName: log.userName || (log.userEmail ? log.userEmail.split('@')[0] : '系統管理員'),
          userEmail: log.userEmail || '',
          adminRoleLabel:
            log.adminRoleLabel || (log.adminRole === 'superadmin' ? '最高主管' : '管理員'),
          module: log.module || 'system',
          moduleLabel: log.moduleLabel || '系統操作',
          operationType: log.operationType || 'update',
          action: log.action || '後台操作',
          details:
            typeof log.details === 'string'
              ? log.details
              : JSON.stringify(log.details ?? ''),
          changes: Array.isArray(log.changes) ? log.changes : [],
        };
      })
      .sort((a, b) => {
        const da = toSafeDate(a.createdAt)?.getTime() || Date.now();
        const db = toSafeDate(b.createdAt)?.getTime() || Date.now();
        return db - da;
      });
  }, [rawLogs]);

  // 統計每位管理員的操作次數、登入次數與「改價/調機率」敏感次數，供頂部「管理員一鍵快篩列」即時預警
  const adminOperators = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        email: string;
        roleLabel: string;
        isSuper: boolean;
        count: number;
        loginCount: number;
        criticalCount: number;
        priceOrProbCount: number;
      }
    >();

    for (const log of normalizedLogs) {
      const key = log.userEmail || log.adminUid || log.userName || 'unknown';
      const hitPriceOrProb = log.isPriceTamper || log.isProbTamper ? 1 : 0;
      const hitLogin = log.isAdminLogin ? 1 : 0;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.loginCount += hitLogin;
        if (log.severity === 'critical') existing.criticalCount += 1;
        existing.priceOrProbCount += hitPriceOrProb;
      } else {
        map.set(key, {
          key,
          name: log.userName || '管理員',
          email: log.userEmail || '',
          roleLabel: log.adminRoleLabel || '管理員',
          isSuper: log.adminRole === 'superadmin' || log.adminRoleLabel === '最高主管',
          count: 1,
          loginCount: hitLogin,
          criticalCount: log.severity === 'critical' ? 1 : 0,
          priceOrProbCount: hitPriceOrProb,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [normalizedLogs]);

  // 統計頂部 KPI 與防竄改專項計數
  const kpiStats = useMemo(() => {
    let todayCount = 0;
    let criticalCount = 0;
    let pointsAndPermCount = 0;
    let cardPoolTotalCount = 0;
    let priceTamperCount = 0;
    let probTamperCount = 0;
    let priceOrProbCount = 0;
    let cardPoolCreateCount = 0;
    let adminLoginCount = 0;
    const todayAdmins = new Set<string>();

    for (const log of normalizedLogs) {
      const d = toSafeDate(log.createdAt);
      if (d && isToday(d)) {
        todayCount += 1;
        todayAdmins.add(log.userEmail || log.adminUid || log.userName || '');
      }
      if (log.severity === 'critical') {
        criticalCount += 1;
      }
      if (
        log.operationType === 'points' ||
        log.operationType === 'permission' ||
        log.module === 'points' ||
        log.module === 'permissions'
      ) {
        pointsAndPermCount += 1;
      }
      if (log.isCardOrPool) cardPoolTotalCount += 1;
      if (log.isPriceTamper) priceTamperCount += 1;
      if (log.isProbTamper) probTamperCount += 1;
      if (log.isPriceTamper || log.isProbTamper) priceOrProbCount += 1;
      if (log.isCardPoolCreate) cardPoolCreateCount += 1;
      if (log.isAdminLogin) adminLoginCount += 1;
    }

    return {
      todayCount,
      todayAdminCount: todayAdmins.size,
      criticalCount,
      pointsAndPermCount,
      cardPoolTotalCount,
      priceTamperCount,
      probTamperCount,
      priceOrProbCount,
      cardPoolCreateCount,
      adminLoginCount,
      totalAdmins: adminOperators.length,
    };
  }, [normalizedLogs, adminOperators.length]);

  const applyFocusPreset = (preset: FocusPreset) => {
    setFocusPreset((prev) => (prev === preset && preset !== 'all' ? 'all' : preset));
    setSelectedModule('all');
    setSelectedOpType('all');
    setSelectedSeverity('all');
  };

  // 多條件篩選
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const kw = searchTerm.trim().toLowerCase();

    return normalizedLogs.filter((log) => {
      // 0. 卡片/卡池防竄改與後台登入專項監控模式
      if (focusPreset === 'card_pool_all' && !log.isCardOrPool) return false;
      if (focusPreset === 'price_or_prob' && !log.isPriceTamper && !log.isProbTamper) return false;
      if (focusPreset === 'price_tamper' && !log.isPriceTamper) return false;
      if (focusPreset === 'prob_tamper' && !log.isProbTamper) return false;
      if (focusPreset === 'card_pool_create' && !log.isCardPoolCreate) return false;
      if (focusPreset === 'admin_login' && !log.isAdminLogin) return false;
      if (
        focusPreset === 'points_perm' &&
        log.operationType !== 'points' &&
        log.operationType !== 'permission' &&
        log.module !== 'points' &&
        log.module !== 'permissions'
      ) {
        return false;
      }

      // 1. 指定管理員
      if (selectedAdmin !== 'all') {
        const matchAdmin =
          log.userEmail === selectedAdmin ||
          log.adminUid === selectedAdmin ||
          log.userName === selectedAdmin;
        if (!matchAdmin) return false;
      }

      // 2. 風險等級
      if (selectedSeverity !== 'all' && log.severity !== selectedSeverity) {
        return false;
      }

      // 3. 功能模組
      if (selectedModule !== 'all' && log.module !== selectedModule) {
        return false;
      }

      // 4. 操作類型（含舊紀錄相容判斷）
      if (selectedOpType !== 'all') {
        if (selectedOpType === 'price_change') {
          if (!log.isPriceTamper) return false;
        } else if (selectedOpType === 'probability_change') {
          if (!log.isProbTamper) return false;
        } else if (log.operationType !== selectedOpType) {
          return false;
        }
      }

      // 5. 時間範圍
      if (dateRange !== 'all') {
        const d = toSafeDate(log.createdAt);
        if (!d) return false;
        if (dateRange === 'today' && !isToday(d)) return false;
        if (dateRange === '3d' && !isAfter(d, subDays(now, 3))) return false;
        if (dateRange === '7d' && !isAfter(d, subDays(now, 7))) return false;
        if (dateRange === '30d' && !isAfter(d, subDays(now, 30))) return false;
      }

      // 6. 關鍵字搜尋
      if (kw) {
        const haystack = [
          log.userName,
          log.userEmail,
          log.adminUid,
          log.action,
          log.moduleLabel,
          log.targetName,
          log.targetId,
          log.details,
          log.ipAddress,
          log.routePath,
          ...(log.changes || []).map((c) => `${c.fieldLabel} ${c.before} ${c.after}`),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(kw)) return false;
      }

      return true;
    });
  }, [
    normalizedLogs,
    focusPreset,
    selectedAdmin,
    selectedSeverity,
    selectedModule,
    selectedOpType,
    dateRange,
    searchTerm,
  ]);

  const hasActiveFilters =
    focusPreset !== 'all' ||
    selectedAdmin !== 'all' ||
    selectedSeverity !== 'all' ||
    selectedModule !== 'all' ||
    selectedOpType !== 'all' ||
    dateRange !== 'all' ||
    Boolean(searchTerm.trim());

  const resetFilters = () => {
    setFocusPreset('all');
    setSelectedAdmin('all');
    setSelectedSeverity('all');
    setSelectedModule('all');
    setSelectedOpType('all');
    setDateRange('all');
    setSearchTerm('');
  };

  // 匯出 CSV 稽核報表 (含 UTF-8 BOM 相容 Excel 與防竄改標記欄)
  const handleExportCsv = () => {
    if (filteredLogs.length === 0) return;

    const headers = [
      '操作時間',
      '管理員名稱',
      '管理員信箱',
      '管理員角色',
      '來源IP',
      '風險等級',
      '防竄改監控標記',
      '所屬模組',
      '執行動作',
      '目標對象',
      '目標ID',
      '操作頁面路徑',
      '詳細變更摘要',
    ];

    const escapeCsv = (val: any) => {
      const s = String(val ?? '').replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = filteredLogs.map((log) => {
      const d = toSafeDate(log.createdAt);
      const timeStr = d ? format(d, 'yyyy-MM-dd HH:mm:ss') : '-';
      const sevLabel = SEVERITY_CONFIG[log.severity || 'info']?.label || '一般操作';
      const auditTagParts: string[] = [];
      if (log.isPriceTamper) auditTagParts.push('價格/市值異動');
      if (log.isProbTamper) auditTagParts.push('機率/配比異動');
      if (log.isCardPoolCreate) auditTagParts.push('新增卡片/卡池');
      if (log.isCardPoolDelete) auditTagParts.push('刪除卡片/卡池');

      return [
        timeStr,
        log.userName,
        log.userEmail,
        log.adminRoleLabel,
        log.ipAddress || '-',
        sevLabel,
        auditTagParts.join(' / ') || '-',
        log.moduleLabel,
        log.action,
        log.targetName || '-',
        log.targetId || '-',
        log.routePath || '-',
        log.details,
      ]
        .map(escapeCsv)
        .join(',');
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `管理員操作稽核報表_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 text-slate-900">
      {/* 頂部標題與匯出/重整工具列 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2.5 rounded-2xl bg-slate-900 text-amber-400 shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              管理員操作稽核日誌
            </h1>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              全模組自動記錄 · 唯讀防竄改
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            嚴密監控多位管理員與助理的「卡片/卡池新增與異動、價格與回收市值變更、抽獎機率與籤位配比調整、點數與權限發放」完整軌跡。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={String(fetchLimit)}
            onValueChange={(v) => setFetchLimit(Number(v))}
          >
            <SelectTrigger className="h-9 w-[135px] rounded-xl bg-white border-slate-200 text-xs font-bold text-slate-700">
              <SelectValue placeholder="讀取筆數" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="100" className="text-xs font-bold">最新 100 筆</SelectItem>
              <SelectItem value="300" className="text-xs font-bold">最新 300 筆</SelectItem>
              <SelectItem value="600" className="text-xs font-bold">最新 600 筆</SelectItem>
              <SelectItem value="1000" className="text-xs font-bold">最新 1,000 筆</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => forceRefetch?.()}
            className="h-9 rounded-xl bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
            重新整理
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={filteredLogs.length === 0}
            onClick={handleExportCsv}
            className="h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1.5 shadow-sm cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            匯出 CSV 稽核報表 ({filteredLogs.length})
          </Button>
        </div>
      </div>

      {/* 頂部 4 張即時稽核數據指標卡 (可點擊一鍵篩選) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => {
            resetFilters();
            setDateRange(dateRange === 'today' ? 'all' : 'today');
          }}
          className={cn(
            'text-left p-4 rounded-2xl bg-white border transition-colors duration-150 cursor-pointer',
            dateRange === 'today' ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200 hover:border-slate-300'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">今日後台操作</span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono tabular-nums text-slate-900">
              {kpiStats.todayCount.toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-slate-400 truncate">
              筆 · {kpiStats.todayAdminCount} 位管理員活躍
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => applyFocusPreset('card_pool_all')}
          className={cn(
            'text-left p-4 rounded-2xl bg-white border transition-colors duration-150 cursor-pointer',
            focusPreset === 'card_pool_all'
              ? 'border-indigo-600 bg-indigo-50/30 ring-2 ring-indigo-600/15'
              : 'border-slate-200 hover:border-indigo-300'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">卡片 / 卡池新增與異動</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono tabular-nums text-slate-900">
              {kpiStats.cardPoolTotalCount.toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-indigo-600 truncate">
              筆（含新增 {kpiStats.cardPoolCreateCount} 筆）
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => applyFocusPreset('price_or_prob')}
          className={cn(
            'text-left p-4 rounded-2xl bg-white border transition-colors duration-150 cursor-pointer',
            focusPreset === 'price_or_prob' ||
              focusPreset === 'price_tamper' ||
              focusPreset === 'prob_tamper'
              ? 'border-rose-500 bg-rose-50/40 ring-2 ring-rose-500/20'
              : 'border-rose-200 hover:border-rose-400'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700">改價格 / 調機率警示</span>
            <div className="p-2 rounded-xl bg-rose-100 text-rose-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono tabular-nums text-rose-600">
              {kpiStats.priceOrProbCount.toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-rose-600/85 truncate">
              改價 {kpiStats.priceTamperCount} · 調機率 {kpiStats.probTamperCount}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => applyFocusPreset('points_perm')}
          className={cn(
            'text-left p-4 rounded-2xl bg-white border transition-colors duration-150 cursor-pointer',
            focusPreset === 'points_perm'
              ? 'border-amber-500 bg-amber-50/30 ring-2 ring-amber-500/20'
              : 'border-slate-200 hover:border-amber-300'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">點數配發與權限變更</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <KeyRound className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono tabular-nums text-slate-900">
              {kpiStats.pointsAndPermCount.toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-slate-400 truncate">
              筆 · 共 {kpiStats.totalAdmins} 位管理員
            </span>
          </div>
        </button>
      </div>

      {/* 🛡️ 卡片 / 卡池防竄改專項監控列：一鍵抓出改價、調機率、新增卡片或卡池 */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 text-white space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs sm:text-sm font-black tracking-tight text-white">
              卡片 / 卡池新增與異動防竄改監控
            </span>
            <span className="hidden md:inline text-xs text-slate-400">
              · 自動計算卡池整體機率變化、單卡稀有度、包數增減與回收市值漲跌幅
            </span>
          </div>
          {focusPreset !== 'all' && (
            <button
              type="button"
              onClick={() => setFocusPreset('all')}
              className="text-xs font-bold text-amber-300 hover:text-amber-200 cursor-pointer self-start sm:self-auto whitespace-nowrap shrink-0"
            >
              返回全部日誌
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {(
            [
              {
                id: 'all' as FocusPreset,
                label: '全部操作紀錄',
                count: normalizedLogs.length,
                icon: Layers,
                activeClass: 'bg-white text-slate-900',
              },
              {
                id: 'card_pool_all' as FocusPreset,
                label: '卡片 / 卡池全部異動',
                count: kpiStats.cardPoolTotalCount,
                icon: Package,
                activeClass: 'bg-indigo-500 text-white',
              },
              {
                id: 'price_tamper' as FocusPreset,
                label: '防竄改：改價格 / 回收市值',
                count: kpiStats.priceTamperCount,
                icon: DollarSign,
                activeClass: 'bg-rose-600 text-white',
              },
              {
                id: 'prob_tamper' as FocusPreset,
                label: '防亂調：調機率 / 獎項 / 籤位',
                count: kpiStats.probTamperCount,
                icon: Dices,
                activeClass: 'bg-amber-500 text-slate-950',
              },
              {
                id: 'card_pool_create' as FocusPreset,
                label: '新增卡片 / 新建卡池',
                count: kpiStats.cardPoolCreateCount,
                icon: PlusCircle,
                activeClass: 'bg-emerald-500 text-slate-950',
              },
              {
                id: 'admin_login' as FocusPreset,
                label: '管理員後台登入',
                count: kpiStats.adminLoginCount,
                icon: LogIn,
                activeClass: 'bg-cyan-400 text-slate-950',
              },
              {
                id: 'points_perm' as FocusPreset,
                label: '點數與權限操作',
                count: kpiStats.pointsAndPermCount,
                icon: KeyRound,
                activeClass: 'bg-sky-500 text-slate-950',
              },
            ] as const
          ).map((tab) => {
            const TabIcon = tab.icon;
            const isActive = focusPreset === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => applyFocusPreset(tab.id)}
                className={cn(
                  'shrink-0 px-3 py-2 rounded-xl text-xs font-black transition-colors duration-150 cursor-pointer flex items-center gap-1.5 whitespace-nowrap',
                  isActive
                    ? tab.activeClass
                    : 'bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80'
                )}
              >
                <TabIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-md font-mono tabular-nums text-[10px]',
                    isActive ? 'bg-black/15 text-current' : 'bg-slate-700 text-slate-200'
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 管理員一鍵快篩列：多人管理時直接點選單一助理/管理員檢視其所有操作 */}
      {adminOperators.length > 0 && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-slate-600" />
              依操作管理員 / 助理快速檢視（可搭配上方「改價格 / 調機率」交叉過濾）
            </span>
            {selectedAdmin !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedAdmin('all')}
                className="text-xs font-bold text-rose-600 hover:underline cursor-pointer whitespace-nowrap shrink-0"
              >
                顯示全部管理員
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedAdmin('all')}
              className={cn(
                'shrink-0 px-3 py-2 rounded-xl border text-xs font-black transition-colors duration-150 cursor-pointer flex items-center gap-2 whitespace-nowrap',
                selectedAdmin === 'all'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              )}
            >
              <span>全部管理員</span>
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-md font-mono tabular-nums text-[10px]',
                  selectedAdmin === 'all'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-700'
                )}
              >
                {normalizedLogs.length}
              </span>
            </button>

            {adminOperators.map((op) => {
              const isSelected =
                selectedAdmin === op.key ||
                (op.email && selectedAdmin === op.email);
              return (
                <button
                  key={op.key}
                  type="button"
                  onClick={() => setSelectedAdmin(isSelected ? 'all' : op.key)}
                  className={cn(
                    'shrink-0 px-3 py-2 rounded-xl border text-left transition-colors duration-150 cursor-pointer flex items-center gap-2.5',
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                  )}
                >
                  <div
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0',
                      isSelected
                        ? 'bg-amber-400 text-slate-950'
                        : op.isSuper
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-700'
                    )}
                  >
                    {(op.name || op.email || 'A').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black truncate max-w-[110px]">
                        {op.name}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-bold whitespace-nowrap',
                          isSelected
                            ? 'text-amber-300'
                            : op.isSuper
                            ? 'text-amber-700'
                            : 'text-slate-500'
                        )}
                      >
                        · {op.roleLabel}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'text-[10px] font-mono truncate max-w-[150px]',
                        isSelected ? 'text-slate-300' : 'text-slate-400'
                      )}
                    >
                      {op.email || op.key}
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0 pl-1">
                    <span
                      className={cn(
                        'font-mono tabular-nums text-xs font-black',
                        isSelected ? 'text-amber-300' : 'text-slate-800'
                      )}
                    >
                      {op.count} 筆
                    </span>
                    {op.priceOrProbCount > 0 ? (
                      <span
                        className={cn(
                          'text-[10px] font-black font-mono tabular-nums',
                          isSelected ? 'text-rose-300' : 'text-rose-600'
                        )}
                      >
                        改價/機率 {op.priceOrProbCount}
                      </span>
                    ) : op.loginCount > 0 ? (
                      <span
                        className={cn(
                          'text-[10px] font-bold font-mono tabular-nums',
                          isSelected ? 'text-cyan-300' : 'text-cyan-700'
                        )}
                      >
                        登入 {op.loginCount} 次
                      </span>
                    ) : op.criticalCount > 0 ? (
                      <span
                        className={cn(
                          'text-[10px] font-bold font-mono tabular-nums',
                          isSelected ? 'text-amber-200' : 'text-amber-700'
                        )}
                      >
                        敏感 {op.criticalCount}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 多維度搜尋與條件過濾列 */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* 關鍵字搜尋 */}
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋卡池名稱、卡片名稱、回收市值、機率、管理員信箱或 IP..."
              className="pl-9 pr-8 h-10 rounded-xl bg-slate-50 border-slate-200 focus:bg-white text-xs font-medium text-slate-900"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* 風險等級篩選 */}
          <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
            <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-bold text-slate-800">
              <SelectValue placeholder="風險等級" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all" className="text-xs font-bold">全部風險等級</SelectItem>
              <SelectItem value="critical" className="text-xs font-bold text-rose-700">高風險敏感操作</SelectItem>
              <SelectItem value="warning" className="text-xs font-bold text-amber-700">重要業務異動</SelectItem>
              <SelectItem value="info" className="text-xs font-bold text-slate-700">一般日常操作</SelectItem>
            </SelectContent>
          </Select>

          {/* 模組篩選 */}
          <Select value={selectedModule} onValueChange={setSelectedModule}>
            <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-bold text-slate-800">
              <SelectValue placeholder="所屬功能模組" />
            </SelectTrigger>
            <SelectContent className="bg-white max-h-[300px]">
              {MODULE_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs font-bold">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 動作類型篩選 */}
          <Select value={selectedOpType} onValueChange={setSelectedOpType}>
            <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-bold text-slate-800">
              <SelectValue placeholder="動作類型" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {OP_TYPE_OPTIONS.map((op) => (
                <SelectItem key={op.value} value={op.value} className="text-xs font-bold">
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 時間快篩與狀態統計列 */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> 時間區間：
            </span>
            {(
              [
                { id: 'all', label: '全部時間' },
                { id: 'today', label: '今日' },
                { id: '3d', label: '近 3 天' },
                { id: '7d', label: '近 7 天' },
                { id: '30d', label: '近 30 天' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setDateRange(t.id)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-bold transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0',
                  dateRange === t.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-500 font-semibold">
              符合條件共 <strong className="text-slate-900 font-mono tabular-nums">{filteredLogs.length}</strong> 筆紀錄
            </span>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-7 px-2.5 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 cursor-pointer whitespace-nowrap shrink-0"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                清除篩選
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 稽核日誌主表格 */}
      <Card className="border-slate-200 rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto custom-scrollbar">
            <Table className="min-w-[940px]">
              <TableHeader className="bg-slate-50/90 border-b border-slate-200">
                <TableRow>
                  <TableHead className="pl-6 py-3.5 text-xs font-black text-slate-700 w-[145px]">
                    操作時間
                  </TableHead>
                  <TableHead className="text-xs font-black text-slate-700 w-[195px]">
                    操作管理員 / IP
                  </TableHead>
                  <TableHead className="text-xs font-black text-slate-700 w-[155px]">
                    風險與監控分類
                  </TableHead>
                  <TableHead className="text-xs font-black text-slate-700 w-[205px]">
                    執行動作 / 目標對象
                  </TableHead>
                  <TableHead className="text-xs font-black text-slate-700">
                    價格與機率變更摘要
                  </TableHead>
                  <TableHead className="pr-6 text-right text-xs font-black text-slate-700 w-[100px]">
                    稽核比對
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16">
                      <Loader2 className="w-7 h-7 animate-spin mx-auto text-slate-400" />
                      <p className="text-xs text-slate-400 font-bold mt-2">
                        正在讀取管理員操作稽核紀錄...
                      </p>
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16 space-y-2">
                      <Filter className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-sm font-bold text-slate-600">
                        目前查無符合篩選條件的操作紀錄
                      </p>
                      <p className="text-xs text-slate-400">
                        當管理員或助理新增卡片/卡池、調整價格或回收市值、修改卡片稀有度與機率時，系統皆會即時寫入此處。
                      </p>
                      {hasActiveFilters && (
                        <div className="pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={resetFilters}
                            className="rounded-xl text-xs font-bold cursor-pointer"
                          >
                            清除所有篩選條件
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => {
                    const d = toSafeDate(log.createdAt);
                    const sev = SEVERITY_CONFIG[log.severity || 'info'] || SEVERITY_CONFIG.info;
                    const SevIcon = sev.icon;

                    return (
                      <TableRow
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className={cn(
                          'border-b border-slate-100 transition-colors cursor-pointer',
                          sev.rowClass
                        )}
                      >
                        {/* 時間 */}
                        <TableCell className="pl-6 py-3.5 align-top">
                          <div className="font-mono tabular-nums text-xs font-black text-slate-800">
                            {d ? format(d, 'MM-dd HH:mm:ss') : '剛剛'}
                          </div>
                          <div className="font-mono tabular-nums text-[10px] text-slate-400 mt-0.5">
                            {d ? format(d, 'yyyy 年') : ''}
                          </div>
                        </TableCell>

                        {/* 操作管理員 */}
                        <TableCell className="py-3.5 align-top">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-slate-900 text-xs">
                              {log.userName}
                            </span>
                            <span
                              className={cn(
                                'text-[10px] font-bold',
                                log.adminRole === 'superadmin' || log.adminRoleLabel === '最高主管'
                                  ? 'text-amber-700'
                                  : 'text-slate-500'
                              )}
                            >
                              · {log.adminRoleLabel}
                            </span>
                          </div>
                          {log.userEmail && (
                            <div className="text-[10px] font-mono text-slate-500 truncate max-w-[180px] mt-0.5">
                              {log.userEmail}
                            </div>
                          )}
                          {log.ipAddress && log.ipAddress !== '未知 IP' && (
                            <div className="text-[10px] font-mono tabular-nums text-slate-400 mt-0.5">
                              IP: {log.ipAddress}
                            </div>
                          )}
                        </TableCell>

                        {/* 風險與模組 */}
                        <TableCell className="py-3.5 align-top space-y-1">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-black px-2 py-0.5 flex items-center gap-1 w-fit whitespace-nowrap',
                              sev.badgeClass
                            )}
                          >
                            <SevIcon className="w-3 h-3 shrink-0" />
                            {sev.label}
                          </Badge>

                          <div className="text-[11px] font-bold text-slate-600 pl-0.5">
                            {log.moduleLabel}
                          </div>

                          {(log.isPriceTamper || log.isProbTamper || log.isCardPoolCreate) && (
                            <div className="flex flex-wrap items-center gap-1 text-[10px] font-black pl-0.5">
                              {log.isPriceTamper && (
                                <span className="text-rose-700">價格/市值異動</span>
                              )}
                              {log.isPriceTamper && log.isProbTamper && (
                                <span className="text-slate-300">·</span>
                              )}
                              {log.isProbTamper && (
                                <span className="text-amber-700">機率/獎項異動</span>
                              )}
                              {!log.isPriceTamper && !log.isProbTamper && log.isCardPoolCreate && (
                                <span className="text-emerald-700">新增卡片/卡池</span>
                              )}
                            </div>
                          )}
                        </TableCell>

                        {/* 動作與對象 */}
                        <TableCell className="py-3.5 align-top">
                          <div className="text-xs font-black text-slate-900 leading-snug">
                            {log.action}
                          </div>
                          {log.targetName && (
                            <div className="text-[11px] font-bold text-slate-600 max-w-[190px] truncate mt-1">
                              目標：{log.targetName}
                            </div>
                          )}
                          {log.isCardPoolCreate && (
                            <div className="text-[11px] font-bold text-emerald-700 max-w-[190px] truncate mt-0.5">
                              新增人員：{log.userName}
                            </div>
                          )}
                        </TableCell>

                        {/* 變更重點摘要 */}
                        <TableCell className="py-3.5 align-top max-w-[380px]">
                          <p className="text-xs text-slate-700 leading-relaxed line-clamp-2 font-medium">
                            {log.details}
                          </p>
                          {log.changes && log.changes.length > 0 && (
                            <div className="flex flex-col gap-1 mt-1.5">
                              {log.changes.slice(0, 2).map((c, idx) => {
                                const highlightPrice = isPriceField(c.field);
                                const highlightProb = isProbField(c.field);
                                return (
                                  <div
                                    key={idx}
                                    className={cn(
                                      'inline-flex items-center gap-1 text-[11px] font-mono tabular-nums px-2 py-0.5 rounded-md border w-fit max-w-full',
                                      highlightPrice
                                        ? 'bg-rose-50/90 border-rose-200 text-rose-900'
                                        : highlightProb
                                        ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                                        : 'bg-slate-100/90 border-slate-200/80 text-slate-700'
                                    )}
                                  >
                                    <strong className="font-sans text-slate-900 shrink-0">
                                      {c.fieldLabel}:
                                    </strong>
                                    <span className="truncate max-w-[125px] text-slate-500">
                                      {c.before}
                                    </span>
                                    <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span
                                      className={cn(
                                        'truncate max-w-[195px] font-bold',
                                        highlightPrice
                                          ? 'text-rose-700'
                                          : highlightProb
                                          ? 'text-amber-800'
                                          : 'text-emerald-700'
                                      )}
                                    >
                                      {c.after}
                                    </span>
                                  </div>
                                );
                              })}
                              {log.changes.length > 2 && (
                                <span className="text-[10px] font-bold text-slate-400">
                                  另有 {log.changes.length - 2} 項欄位變更，點擊查看完整比對
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>

                        {/* 查看詳情按鈕 */}
                        <TableCell className="pr-6 py-3.5 align-top text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                            className="h-8 px-2.5 rounded-xl bg-white border-slate-200 hover:bg-slate-900 hover:text-white text-xs font-bold gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            比對
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 單筆操作完整稽核詳情與欄位前後差異比對 Dialog */}
      <Dialog
        open={Boolean(selectedLog)}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      >
        <DialogContent className="light max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white border border-slate-200 text-slate-900 p-6 shadow-2xl">
          {selectedLog && (() => {
            const d = toSafeDate(selectedLog.createdAt);
            const sev =
              SEVERITY_CONFIG[selectedLog.severity || 'info'] || SEVERITY_CONFIG.info;
            const SevIcon = sev.icon;
            const probSummaryChange = selectedLog.changes?.find(
              (c) => c.field === '_computed_probability'
            );
            const priceChanges = (selectedLog.changes || []).filter((c) =>
              isPriceField(c.field)
            );

            return (
              <div className="space-y-5">
                <DialogHeader className="border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs font-black px-2.5 py-0.5 flex items-center gap-1',
                          sev.badgeClass
                        )}
                      >
                        <SevIcon className="w-3.5 h-3.5" />
                        {sev.label}
                      </Badge>
                      <span className="text-xs font-bold text-slate-600">
                        {selectedLog.moduleLabel}
                      </span>
                      {selectedLog.isPriceTamper && (
                        <span className="text-xs font-black text-rose-700">
                          · 價格 / 回收市值異動
                        </span>
                      )}
                      {selectedLog.isProbTamper && (
                        <span className="text-xs font-black text-amber-700">
                          · 機率 / 獎項配比異動
                        </span>
                      )}
                      {selectedLog.isCardPoolCreate && (
                        <span className="text-xs font-black text-emerald-700">
                          · 新增卡片 / 卡池
                        </span>
                      )}
                    </div>
                    <span className="font-mono tabular-nums text-xs font-bold text-slate-500">
                      {d ? format(d, 'yyyy-MM-dd HH:mm:ss') : '-'}
                    </span>
                  </div>
                  <DialogTitle className="text-xl font-black text-slate-900 pt-2">
                    {selectedLog.action}
                    {selectedLog.targetName ? ` — ${selectedLog.targetName}` : ''}
                  </DialogTitle>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {selectedLog.details}
                  </p>
                </DialogHeader>

                {/* 🛡️ 價格與機率防竄改重點摘要框 */}
                {(probSummaryChange || priceChanges.length > 0) && (
                  <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-black text-rose-800">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                      價格與中獎機率防竄改稽核重點
                    </div>

                    {priceChanges.length > 0 && (
                      <div className="space-y-1.5">
                        {priceChanges.map((pc, i) => (
                          <div
                            key={i}
                            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-rose-200/80 text-xs"
                          >
                            <span className="font-black text-slate-800">
                              {pc.fieldLabel}
                            </span>
                            <div className="flex items-center gap-2 font-mono tabular-nums">
                              <span className="text-slate-500 line-through">
                                {pc.before}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              <span className="font-black text-rose-700">
                                {pc.after}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {probSummaryChange && (
                      <div className="p-3 rounded-xl bg-white border border-amber-200 space-y-1.5 text-xs">
                        <div className="font-black text-amber-900">
                          {probSummaryChange.fieldLabel}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono tabular-nums text-[11px]">
                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                            <div className="text-[10px] font-sans font-bold text-slate-400 mb-0.5">
                              變更前機率分佈
                            </div>
                            <div className="text-slate-700 font-semibold">
                              {probSummaryChange.before}
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200">
                            <div className="text-[10px] font-sans font-bold text-amber-700 mb-0.5">
                              變更後機率分佈
                            </div>
                            <div className="text-amber-950 font-black">
                              {probSummaryChange.after}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 操作管理員與環境中繼資料 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-400">操作管理員</div>
                    <div className="font-black text-slate-900 flex items-center gap-1.5">
                      <span>{selectedLog.userName}</span>
                      <span className="text-[11px] text-amber-700 font-bold">
                        · {selectedLog.adminRoleLabel}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-600">
                      {selectedLog.userEmail || '-'}
                    </div>
                    {selectedLog.adminUid && (
                      <div className="font-mono text-[10px] text-slate-400">
                        UID: {selectedLog.adminUid}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-400">來源環境與目標位置</div>
                    <div className="flex items-center gap-1.5 text-slate-700 font-mono tabular-nums">
                      <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>IP: {selectedLog.ipAddress || '未知 IP'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Monitor className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{parseBrowserSummary(selectedLog.userAgent)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
                      <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        頁面: {selectedLog.routePath || '/admin'}
                        {selectedLog.targetCollection
                          ? ` · 集合: ${selectedLog.targetCollection}/${selectedLog.targetId || ''}`
                          : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 欄位級別變更前後對照表 */}
                {selectedLog.changes && selectedLog.changes.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-slate-600" />
                      欄位變更前後明細比對（共 {selectedLog.changes.length} 項）
                    </h4>
                    <div className="rounded-2xl border border-slate-200 overflow-hidden">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-xs font-black text-slate-700 w-[180px]">
                              欄位名稱
                            </TableHead>
                            <TableHead className="text-xs font-black text-slate-500">
                              變更前 (Before)
                            </TableHead>
                            <TableHead className="text-xs font-black text-emerald-700">
                              變更後 (After)
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedLog.changes.map((c, idx) => {
                            const highlightSensitive =
                              isPriceField(c.field) || isProbField(c.field);
                            return (
                              <TableRow
                                key={idx}
                                className={cn(
                                  'border-b border-slate-100',
                                  highlightSensitive && 'bg-amber-50/25'
                                )}
                              >
                                <TableCell className="text-xs font-black text-slate-800 align-top">
                                  {c.fieldLabel}
                                  <div className="font-mono text-[10px] text-slate-400 font-normal">
                                    {c.field}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs font-mono tabular-nums text-slate-500 break-all align-top bg-rose-50/30">
                                  {c.before}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    'text-xs font-mono tabular-nums font-bold break-all align-top',
                                    isPriceField(c.field)
                                      ? 'text-rose-800 bg-rose-50/60'
                                      : isProbField(c.field)
                                      ? 'text-amber-900 bg-amber-50/60'
                                      : 'text-emerald-800 bg-emerald-50/40'
                                  )}
                                >
                                  {c.after}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* 批次項目清單預覽 */}
                {selectedLog.batchItems && selectedLog.batchItems.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-slate-800">
                      批次影響項目清單（顯示前 {selectedLog.batchItems.length} 筆
                      {selectedLog.batchCount ? ` / 總計 ${selectedLog.batchCount} 筆` : ''}）
                    </h4>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto text-xs font-medium text-slate-700">
                      {selectedLog.batchItems.map((itemStr, idx) => (
                        <div
                          key={idx}
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/70 truncate font-mono tabular-nums"
                        >
                          {itemStr}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-slate-100 gap-2 flex-wrap">
                  {selectedLog.userEmail ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedAdmin(selectedLog.userEmail!);
                        setSelectedLog(null);
                      }}
                      className="rounded-xl text-xs font-bold border-slate-200 cursor-pointer"
                    >
                      只看「{selectedLog.userName}」的所有操作紀錄
                    </Button>
                  ) : (
                    <div />
                  )}
                  <Button
                    type="button"
                    onClick={() => setSelectedLog(null)}
                    className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-6 cursor-pointer"
                  >
                    關閉視窗
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
