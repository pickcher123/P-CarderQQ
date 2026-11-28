
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, CheckCircle2, ChevronLeft, Zap, ShieldCheck, Palette, Bug, Globe, Crown, Search, Calculator } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { APP_VERSION, getAppVersionFromSystem } from '@/lib/version';
import { useSystemConfig } from '@/components/providers/system-config-provider';

interface ChangeLogItem {
  version: string;
  title: string;
  type: 'feature' | 'fix' | 'ui' | 'security' | 'seo';
  changes: string[];
}

const changelogData: ChangeLogItem[] = [
  {
    version: "公測版 8.0 (最新里程碑)",
    title: "銀行級防作弊架構、7-11 交貨便智慧物流、圖像化玩法與極速入庫全面升級",
    type: "security",
    changes: [
      "銀行級全站安全與防作弊升級：收藏庫轉點、拼卡轉盤、直購、出貨退單與隱藏 VIP 兌換碼全面改由後端 Admin SDK 原子交易執行；Firestore 規則徹底鎖死前端偽造卡片與新帳號點數篡改，並串接 Cloudflare Turnstile 無感人機驗證與金流 SHA256 簽章／金額核對。",
      "7-11 交貨便智慧物流體系：出貨申請支援即時官方門市／6 碼店號自動查詢，會員中心新增一鍵「查貨態」捷徑，後台同步支援官方範本 Excel 一鍵批次匯出與寄件資訊管理。",
      "God Pack 卡池視覺與圖像化玩法升級：優化卡池無鋸齒曜石香檳金外觀、全新精選卡池徽章與剩餘抽數進度線；新增圖像化「God Pack 一番賞 玩法說明」彈窗，並以 Portal 重構手機版跳窗置中體驗；首頁升級「Get God Pack」主按鈕與全新 3D 質感 4 步驟玩法指南。",
      "行動端版面與互動全方位精修：修復手機版頂部頭像擠壓跑版，將站內公告小鈴鐺移至右下浮動鈕與頭像選單；精簡「全部卡池」與「收藏庫」多餘分類列，並微調手機版「卡展行事曆」單頁可視比例。",
      "後台卡片庫存代碼與 47 組預查卡表極速入庫：卡片全面新增「庫存代碼」欄位方便與現場實卡對應搜尋；上傳工作台改為「先傳正反面」6 步 SOP，並內建預查卡表組別一鍵位置對齊帶入；同步修復後台 AI 聯網查價、賽事與卡展同步機制。"
    ]
  },
  {
    version: "公測版 7.5",
    title: "3D 扇形多抽開包、追蹤尾盤提醒、極速秒開引擎與推薦碼全面升級",
    type: "feature",
    changes: [
      "3D 扇形立體卡包堆與大獎壓軸開獎：3 抽／10 抽以上自動展開多包扇形立體堆疊並依真實卡包色階著色，搭配色階數量預告列，系統自動由小獎排至金包／SP 黑包／最後賞壓軸登場。",
      "我的追蹤卡池與尾盤狙擊提醒：卡池新增一鍵追蹤與「我的追蹤」篩選膠囊，追蹤機台進入尾盤（剩餘 ≤ 20% 或 ≤ 15 抽）即自動於頂部提醒；新增分類篩選、剩餘最少排序與五色方塊直看卡表。",
      "全站極速秒開快取引擎：全面改用跨頁按需批次查詢與記憶體快取，主題卡池、全部卡池、福袋、收藏庫與會員中心切換皆大幅提速；換上全新 5 款動態香檳金主題卡池插畫。",
      "透明買回估值同步與會員回饋升級：收藏庫直接呈現實際買回鑽石數（GodPack C/D 賞與拼卡專區 9 折、其他模式 8 折，GodPack 另享會員階級最高 10% P 幣回饋），前後一致無落差。",
      "會員推薦碼、會員中心與行動端全方位精修：完整化專屬推薦碼啟用與好友綁定發獎流程；會員中心新增物流單號一鍵複製與快捷儲值；升級新手玩法指南、PWA 安裝卡並修復手機版彈窗與系統列顯示。"
    ]
  },
  {
    version: "公測版 7.0",
    title: "GodPack 五色一番賞、看盤數據分析與暗黑曜石視覺全面升級",
    type: "feature",
    changes: [
      "GodPack 五色一番賞與智能配平引擎：導入金／黑／銀／銅／白五色盲盒分級（A／SP／B／C／D／最後賞），卡池分子隨實際庫存即時同步，並支援配平單抽價雙向連動。",
      "機台看盤明細與價值排序升級：看盤明細完整呈現五色卡包剩餘數量與各卡包即時抽取機率分析；卡池卡片依估值由高到低優先展示，大獎一目了然。",
      "球員卡買回與階級加碼回收體系：球員普／特卡固定 40 鑽快速買回；其他實體卡快速轉點升級為「8 折回收＋會員階級回饋 % 數 P 點」。",
      "紅利加倍活動自動排程：活動到期後自動關閉總開關，全站頂部廣播消息欄亦同步自動隱藏，確保活動資訊精準即時。",
      "暗黑曜石 × 香檳金視覺純淨化：全面統一高質感暗黑曜石與香檳金介面規範，優化跑馬燈排版、精簡收藏庫與開獎確認流程，並強化後台系統安全鎖與店家保護機制。"
    ]
  },
  {
    version: "公測版 6.0",
    title: "現貨在庫承諾、密碼學機率驗證與 3D 沉浸舞台全面實裝",
    type: "feature",
    changes: [
      "100% 實體現貨在庫承諾：宣告『有在庫才會上架，絕不先賣後買』，全站卡片均已在席實體入庫並存放於 24H 恆溫防潮保險庫。",
      "Provably Fair 密碼學機率自主驗證：導入 SHA-256 / HMAC 加密演算法，開獎前預鎖 Server Hash、開獎注入 Client Seed，公式開源可隨時回溯複算。",
      "3D 沉浸旋轉門紅包福袋舞台：福袋專區導入立體旋轉門卡袋舞台，立體翻轉檢視封底賞品大獎，並針對手機端高度優化垂直握持視角。",
      "1/10 拼卡選號微晶按鈕美學升級：選號數字適度縮小更精煉（01~10 補零排版），搭配賽博微晶按鈕、粉紅霓虹漸層與老虎機雷射標線。",
      "新手教學 & 公平驗證一體化雙分頁：整合純中文 4 步圖解指南（挑選開盒➔數位存庫➔現貨保護➔安全宅配）與驗證計算機，文字大幅精簡。",
      "真實賽事自動抓取與機器人 OpenAPI：移除假賽事硬塞機制，每週一定期同步真實賽程；開放 /api/bot/pools 免金鑰卡池日報查詢端點。"
    ]
  },
  {
    version: "公測版 5.0 (旗艦版)",
    title: "數位資產全息革命與微距放大鏡全面降臨",
    type: "feature",
    changes: [
      "新增「全方位數位放大鏡」：首創卡片正面與背面 2.5x 視網膜微距放大檢視，完美呈現金屬壓紋與防偽編號。",
      "全息玻璃擬態 2.0 介面升級：午夜深藍磨砂材質搭配霓虹青（#06B6D4）與傳奇金（#EAB308），營造頂級實體拆盒感。",
      "建立「已回收資產獨立管理體系」：卡片轉點自動歸檔，全站唯一識別碼防竄改防誤刪。",
      "導入「AI 營運價格推薦演算法」：即時運算卡池總價值與期望值，提供科學化的一抽/三抽定價策略。",
      "行動端體驗全面進化：手機版 2x2 四宮格拼卡規則導覽、VIP 橫向榮耀階級圖譜、頂部一體化點數加值彈窗。"
    ]
  },
  {
    version: "1.1 (功能升級)",
    title: "數位資產管理與系統穩健性強化",
    type: "feature",
    changes: [
      "新增「已回收」資產管理：支援卡片轉點後自動進入回收區，並提供管理員手動調整狀態之功能。",
      "強化資產安全保護：導入刪除前檢查機制，防止誤刪已分配至抽卡機、福袋或拼卡活動中的卡片。",
      "修復福袋重製退款邏輯：修正福袋活動手動重製時的點數與鑽石退還機制，並同步更新交易流水紀錄。",
      "優化卡片翻轉體驗：調整卡片翻轉縮放比例與視距，使數位卡片檢視更具物理真實感。",
      "優化預覽視窗佈局：調整全站卡片預覽對話框之標題權重與間距，解決行動裝置標題跑版問題。"
    ]
  },
  {
    version: "1.0 (公開測試)",
    title: "公開測試版全面啟動：體驗優化",
    type: "feature",
    changes: [
      "優化收藏頁：移除原有的自動放大效果，改為點擊後觸發，大幅提升瀏覽流暢度。",
      "優化收藏頁卡片懸停體驗：非翻轉模式卡片新增「預覽放大鏡」懸停提示，直觀標示可檢視資產。",
      "服務條款全面更新：修正條款細節，更新生效日期至最新版本。"
    ]
  },
  {
    version: "7.4.5",
    title: "使用者體驗深度優化與介面整合",
    type: "ui",
    changes: [
      "優化 VIP 頁面手機版佈局：將「榮耀階級圖譜」改為橫向卡片，大幅減少垂直滾動。",
      "簡化 VIP 頁面「每日簽到」與「紅利點數」區塊，採用緊湊的上下排列設計。",
      "優化手機版拚卡專區遊戲規則，改為 2x2 四宮格佈局，提升資訊閱讀效率。",
      "整合導覽列點數顯示與加值功能，實現一體化設計，並優化彈出視窗佈局。",
      "調整「全部卡片」區塊佈局，將標題移至右側並縮減間距，提升整體視覺整齊度。"
    ]
  },
  {
    version: "7.4.4",
    title: "數位資產檢視與營運效率革命",
    type: "feature",
    changes: [
      "新增「全方位數位放大鏡」：支援卡片正面與背面 2.5x 高倍率檢視，完美呈現球員卡細節。",
      "導入「AI 營運價格推薦系統」：自動計算獎項總價值，提供科學化的一抽與三抽售價建議。",
      "重構「卡片預覽佈局」：名稱移至頂部並支援自動換行，比例縮減 1/3 以解決行動裝置跑版問題。",
      "優化「視覺純淨度」：移除卡片側邊黑塊與名稱遮罩，實現 100% 藝術圖像露出。",
      "優化手機版 Header 點數間距與返回按鈕位置，解決介面重疊並提升操作舒適度。"
    ]
  },
  {
    version: "7.4.3",
    title: "榮耀成就系統與視覺巔峰升級",
    type: "ui",
    changes: [
      "全面升級 VIP 階級頭像，引入 Progressive Aura (進階光暈) 與動態星芒特效。",
      "優化成就牆視覺層次，大幅提升「未解鎖成就」之辨識度與可讀性。",
      "調整全站遊戲專區為「扁平化一行四個」網格佈局，極大化寬螢幕視野。",
      "強化「卡片唯一資產制」邏輯，確保資產在全專區之獨特性與即時銷毀機制。"
    ]
  },
  {
    version: "7.4.2",
    title: "全球搜尋與 SEO 指數優化",
    type: "seo",
    changes: [
      "建構全站 JSON-LD 結構化資料 (Organization & WebSite)，提升 Google 品牌呈現。",
      "整合動態 Sitemap 自動生成系統與 Robots.txt 爬蟲權限規範。",
      "優化 Open Graph 與 Twitter Cards 社交分享標籤，支援美觀的預覽縮圖。",
      "修正頂部導覽鑽石餘額顯示間距，優化手機版操作寬鬆度。"
    ]
  },
  {
    version: "7.4.1",
    title: "核心品牌語更新與介面純淨化",
    type: "ui",
    changes: [
      "更新首頁品牌標語為「公開透明、機率披露、數位存證」。",
      "重構卡池獎項清冊，移除多餘英文標籤與剩餘量條，回歸純淨視覺。",
      "調整抽卡機台按鈕權重，引導高價值連抽操作。",
      "優化福袋募集進度線條，改用高對比實體線段呈現。"
    ]
  },
  {
    version: "7.4.0",
    title: "沉浸式全息 UI 升級",
    type: "ui",
    changes: [
      "全面升級全站頁面為玻璃擬態 (Glassmorphism) 風格。",
      "優化開獎前置流程，整合權益保障與即時金額確認。",
      "重構會員中心與收藏庫，強化資產視覺階級感。",
      "修復手機版分類導覽滑動體驗。"
    ]
  }
];

const typeStyles = {
  feature: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  fix: "bg-green-500/10 text-green-400 border-green-500/20",
  ui: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  security: "bg-red-500/10 text-red-400 border-red-500/20",
  seo: "bg-amber-500/10 text-amber-400 border-amber-400/20",
};

const typeIcons = {
  feature: Zap,
  fix: CheckCircle2,
  ui: Palette,
  security: ShieldCheck,
  seo: Globe,
};

export default function ChangeLogPage() {
  const { systemConfig } = useSystemConfig();
  const currentVersion = getAppVersionFromSystem(systemConfig);

  return (
    <div className="container py-12 md:py-20 max-w-4xl relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[320px] bg-amber-400/10 blur-[120px] pointer-events-none" />
      
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4 relative z-10">
        <div className="space-y-2">
          <Button variant="ghost" asChild className="-ml-4 mb-2 hover:bg-white/[0.05] text-slate-300 hover:text-amber-200 font-bold">
            <Link href="/about"><ChevronLeft className="mr-2 h-4 w-4" /> 返回關於我們</Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-[3px] h-9 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700" />
            <h1 className="font-headline text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <History className="h-9 w-9 text-[#FDE68A]" /> 更新日誌
            </h1>
          </div>
          <p className="text-slate-400 text-base sm:text-lg font-medium">紀錄 P+Carder 的成長軌跡與技術革新。</p>
        </div>
        <Badge variant="outline" className="h-9 px-4 font-code text-sm border-amber-300/40 text-[#FDE68A] bg-amber-400/10 rounded-full tabular-nums">
          CURRENT VER: {currentVersion}
        </Badge>
      </div>

      <div className="space-y-6 md:space-y-8 relative z-10">
        <div className="absolute left-[19px] top-4 bottom-4 w-px bg-white/[0.08] hidden md:block" />

        {changelogData.map((item, index) => {
          const Icon = typeIcons[item.type as keyof typeof typeIcons] || Bug;
          const isLatest = index === 0;
          return (
            <div key={item.version} className="relative md:pl-12 group animate-fade-in-up" style={{ animationDelay: `${index * 60}ms` }}>
              <div className={cn(
                "absolute left-0 top-2 w-10 h-10 rounded-full bg-[#0a0f1c] border items-center justify-center hidden md:flex transition-all z-10",
                isLatest
                  ? "border-amber-300/65 shadow-[0_0_20px_rgba(251,191,36,0.22)]"
                  : "border-white/[0.12] group-hover:border-amber-300/50"
              )}>
                <Icon className={cn("h-5 w-5", isLatest ? "text-[#FDE68A]" : "text-amber-300/80")} />
              </div>

              <Card className={cn(
                "bg-[#0a0f1c]/95 backdrop-blur-2xl border transition-all duration-300 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.85)] overflow-hidden relative",
                isLatest
                  ? "border-amber-300/45 border-t-2 border-t-amber-300/70"
                  : "border-white/[0.08] hover:border-amber-300/35"
              )}>
                <CardHeader className="p-5 sm:p-6 md:p-7 pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={cn("px-2.5 py-0.5 font-black uppercase tracking-widest text-[10px] rounded-full border", typeStyles[item.type as keyof typeof typeStyles])}>
                        {item.type === 'seo' ? 'Search Engine' : item.type}
                      </Badge>
                      {isLatest && (
                        <Badge className="px-2.5 py-0.5 font-black text-[10px] rounded-full bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] border-0">
                          LATEST
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm sm:text-base font-black font-code text-[#FDE68A] tabular-nums">
                      VER {item.version}
                    </span>
                  </div>
                  <CardTitle className="text-lg sm:text-xl font-black text-white font-headline tracking-wide">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-5 sm:p-6 md:p-7 pt-0">
                  <ul className="space-y-2.5">
                    {item.changes.map((change, i) => (
                      <li key={i} className="flex items-start gap-3 text-slate-300 leading-relaxed text-sm font-medium">
                        <div className="h-1.5 w-1.5 rounded-full bg-amber-300 mt-2 shrink-0" />
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      <div className="mt-16 text-center space-y-4 py-10 border-t border-white/[0.08] relative z-10">
        <p className="text-slate-400 font-medium">感謝您的支持，我們會持續進化，打造最純粹透明的收藏殿堂。</p>
        <Button asChild className="rounded-xl bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] font-black h-11 px-8 hover:brightness-105">
          <Link href="/">回首頁開始收藏之旅</Link>
        </Button>
      </div>
    </div>
  );
}
