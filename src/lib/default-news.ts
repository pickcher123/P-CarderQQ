export interface NewsItem {
  id: string;
  title: string;
  content: string;
  category: string;
  type: 'text' | 'image';
  imageUrl?: string;
  createdAt?: { seconds: number };
  isPinned?: boolean;
  isMarquee?: boolean;
  isDeleted?: boolean;
}

export const OFFICIAL_NEWS_LIST: NewsItem[] = [
  {
    id: "official-v6-release",
    title: "🔥【重磅更新】P+Carder 公測版 6.0 震撼上線！100% 現貨在庫承諾 · 密碼學機率驗證 · 3D 沉浸紅包福袋舞台",
    category: "版本更新",
    type: "image",
    imageUrl: "/version_6_release.jpg",
    isPinned: true,
    isMarquee: true,
    createdAt: { seconds: Math.floor(Date.now() / 1000) },
    content: `<div class="space-y-5 text-slate-200">
  <div class="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-cyan-500/10 border border-amber-500/30 text-amber-200 shadow-lg">
    <div class="flex items-center gap-2 mb-2">
      <span class="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider">VERSION 6.0</span>
      <span class="text-xs text-amber-300 font-mono font-bold">OPEN BETA MILESTONE</span>
    </div>
    <h3 class="text-lg sm:text-xl font-black text-amber-300 mb-2">🎉 P+Carder 公測版 6.0 旗艦新里程碑正式上線！</h3>
    <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">
      感謝廣大卡迷與玩家熱情支持！從公測版 5.0 至今，開發團隊聆聽社群深度反饋，全面完成了<strong>「100% 現貨在庫嚴選」</strong>、<strong>「Provably Fair 密碼學機率自主驗證」</strong>、<strong>「全新 3D 旋轉門紅包福袋展台」</strong>與<strong>「新手教學 & 公平驗證一體化」</strong>等重大功能迭代，為全台收藏家打造最真實、最透明、最純粹的極致玩卡殿堂！
    </p>
  </div>

  {/* 5.0 到 6.0 新增重大功能對照 */}
  <div class="space-y-3">
    <h4 class="text-base font-black text-white flex items-center gap-2">
      <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
      從 5.0 到 6.0：我們為您帶來了哪些全新升級？
    </h4>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm">
      {/* 升級 1 */}
      <div class="p-3.5 rounded-2xl bg-gradient-to-br from-[#121c2e]/90 to-slate-950 border border-cyan-500/30 space-y-1.5 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-xs font-black text-cyan-300 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            1. 密碼學公平驗證（Provably Fair 100% 可驗證）
          </span>
          <span class="text-[10px] font-mono text-cyan-400/80 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-500/20">SHA-256</span>
        </div>
        <p class="text-xs text-slate-300 leading-relaxed">
          杜絕黑箱與調包疑慮！每次開獎前已將伺服器雜湊碼（Server Hash）預先鎖定公示；開獎時注入用戶專屬隨機種子（Client Seed）與 Nonce，任何人皆可在「公平驗證中心」隨時回溯複算真實機率。
        </p>
      </div>

      {/* 升級 2 */}
      <div class="p-3.5 rounded-2xl bg-gradient-to-br from-[#1f1110]/90 to-slate-950 border border-amber-500/30 space-y-1.5 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-xs font-black text-amber-300 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            2. 100% 實體現貨在庫承諾 · 嚴謹恆溫保護
          </span>
          <span class="text-[10px] font-mono text-amber-400/80 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/20">REAL VAULT</span>
        </div>
        <p class="text-xs text-slate-300 leading-relaxed">
          全面宣告核心理念：<strong>「有在庫才會上架，絕不先賣後買」</strong>！所有上架卡片均已在席實體庫存並數位建檔，存放在 24H 恆溫恆濕防潮保險庫；出貨採用高規格防潮卡膜、強固卡磚與防震保險盒安全快遞。
        </p>
      </div>

      {/* 升級 3 */}
      <div class="p-3.5 rounded-2xl bg-gradient-to-br from-[#1a0c1e]/90 to-slate-950 border border-rose-500/30 space-y-1.5 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-xs font-black text-rose-300 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            3. 3D 沉浸旋轉門紅包福袋舞台
          </span>
          <span class="text-[10px] font-mono text-rose-400/80 bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-500/20">3D STAGE</span>
        </div>
        <p class="text-xs text-slate-300 leading-relaxed">
          突破傳統扁平排版！福袋專區導入立體直立紅包袋 3D 旋轉舞台，流暢翻轉檢視封底賞品大獎、募集剩餘格數與保底成團進度；手機端亦針對握持高度全面上移優化。
        </p>
      </div>

      {/* 升級 4 */}
      <div class="p-3.5 rounded-2xl bg-gradient-to-br from-[#101918]/90 to-slate-950 border border-emerald-500/30 space-y-1.5 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-xs font-black text-emerald-300 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            4. 拼卡選號微晶按鈕與視覺質感重構
          </span>
          <span class="text-[10px] font-mono text-emerald-400/80 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/20">ARENA DUEL</span>
        </div>
        <p class="text-xs text-slate-300 leading-relaxed">
          1/10 命運拼卡選號數字適度縮小更精煉（01~10 雙位數補零排版），搭配賽博微晶按鈕、動態漸層外發光以及命運老虎機雷射對齊導軌，開獎緊張刺激感大幅提升！
        </p>
      </div>

      {/* 升級 5 */}
      <div class="p-3.5 rounded-2xl bg-gradient-to-br from-[#161226]/90 to-slate-950 border border-purple-500/30 space-y-1.5 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-xs font-black text-purple-300 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            5. 新手教學 & 公平驗證一體化極簡整合
          </span>
          <span class="text-[10px] font-mono text-purple-400/80 bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-500/20">ALL-IN-ONE</span>
        </div>
        <p class="text-xs text-slate-300 leading-relaxed">
          雙分頁整合視窗！整合純中文 4 步驟新手教學圖解（挑選開盒 ➔ 數位存庫 ➔ 現貨保護 ➔ 安全宅配）與 SHA-256 驗證工具，大幅精簡冗長文字，讓新進玩家 10 秒鐘輕鬆上手。
        </p>
      </div>

      {/* 升級 6 */}
      <div class="p-3.5 rounded-2xl bg-gradient-to-br from-[#181a10]/90 to-slate-950 border border-yellow-500/30 space-y-1.5 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-xs font-black text-yellow-300 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
            6. 真實賽事自動抓取與機器人 OpenAPI 端點
          </span>
          <span class="text-[10px] font-mono text-yellow-400/80 bg-yellow-950/60 px-2 py-0.5 rounded-full border border-yellow-500/20">BOT OPENAPI</span>
        </div>
        <p class="text-xs text-slate-300 leading-relaxed">
          全面移除未開賽假賽事硬塞機制，設定每週一自動抓取真實焦點體育賽事與卡展資訊；開放 <code class="text-cyan-400 font-mono">/api/bot/pools</code> 免金鑰端點，支援 Google Spark / 機器人每日定時推送最新卡池情報！
        </p>
      </div>
    </div>
  </div>

  {/* 更新歷程回顧 */}
  <div class="space-y-3 pt-2">
    <h4 class="text-sm sm:text-base font-black text-white flex items-center gap-2">
      <span class="w-2 h-2 rounded-full bg-amber-400"></span>
      版本演進歷程回顧 (Version History)
    </h4>
    <div class="text-xs space-y-1.5 p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 font-medium leading-relaxed">
      <p><span class="text-amber-400 font-bold">【公測版 6.0】</span>100% 現貨在庫承諾、Provably Fair 密碼學機率驗證、3D 旋轉門紅包福袋、拼卡選號微晶按鈕、新手教學驗證一體化、機器人 OpenAPI。</p>
      <p><span class="text-cyan-400 font-bold">【公測版 5.0】</span>雙面 2.5x 視網膜數位放大鏡、Cyberpunk 2.0 擬態風格、已回收數位資產庫、AI 價格推薦演算法。</p>
      <p><span class="text-purple-400 font-bold">【公測版 1.1】</span>已回收資產管理、福袋重製退款邏輯修正、物理真實卡片翻轉視距。</p>
      <p><span class="text-slate-300 font-bold">【公測版 1.0】</span>公開測試版全面啟動、收藏庫點擊觸發優化、Firestore 效能飛躍。</p>
    </div>
  </div>

  {/* 底部行動呼籲 */}
  <div class="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-transparent border border-amber-500/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div>
      <span class="text-amber-300 font-bold">🎉 公測版 6.0 限時狂歡：</span>
      <span class="text-slate-300">每日簽到贈送雙倍紅利，完成首抽更可於個人收藏庫體驗無損折現轉點與極速出庫！</span>
    </div>
    <a href="/changelog" class="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-bold underline shrink-0">
      查看完整更新日誌 &rarr;
    </a>
  </div>
</div>`.trim()
  },
  {
    id: "official-v5-release",
    title: "🚀【歷史更新】P+Carder 公測版 5.0 旗艦版本全面上線！全方位微距放大鏡與資產安全革新",
    category: "版本更新",
    type: "image",
    imageUrl: "/version_5_release.jpg",
    isPinned: false,
    isMarquee: false,
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 86400 * 7 },
    content: `<div class="space-y-4 text-slate-200">
  <div class="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-300">
    <h3 class="text-base font-bold text-amber-400 mb-1">P+Carder 公測版 5.0 歷程存檔</h3>
    <p class="text-xs leading-relaxed">
      公測版 5.0 正式導入 2.5x 微距放大鏡檢視、午夜深藍全息玻璃擬態 2.0、已回收獨立資產管理體系以及 AI 營運價格推薦演算法。
    </p>
  </div>
</div>`.trim()
  },
  {
    id: "official-security-rules",
    title: "🛡️【系統公告】P+Carder 數位資產防護與公平抽卡機率披露準則",
    category: "系統公告",
    type: "text",
    isPinned: false,
    isMarquee: false,
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 86400 },
    content: `<div class="space-y-3 text-xs sm:text-sm text-slate-300">
  <p>P+Carder 始終堅持「公開透明、機率披露、數位存證」的最高運作準則：</p>
  <ul class="list-disc pl-5 space-y-1.5">
    <li><strong>實時卡池公示</strong>：每一款卡池的大獎清冊、剩餘包數與機率完全即時公開，無任何後台操控。</li>
    <li><strong>資產安全鐵壁</strong>：使用者的卡片資產與帳戶點數受 Firestore 頂級安全規則保護，嚴格防禦任何非授權篡改。</li>
    <li><strong>實物兌換保障</strong>：抽中之稀有實體球員卡支援防偽包裝寄送，提供完整的拆盒拆卡公證錄影。</li>
  </ul>
</div>`.trim()
  },
  {
    id: "official-vip-privilege",
    title: "👑【活動快訊】VIP 榮耀階級圖譜升級與專屬星芒光暈開放體驗",
    category: "活動快訊",
    type: "text",
    isPinned: false,
    isMarquee: false,
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 172800 },
    content: `<div class="space-y-3 text-xs sm:text-sm text-slate-300">
  <p>全新 VIP 階級特權現已開放！玩家累積充值與抽卡活躍度，即可解鎖對應階級頭像框、Progressive Aura 動態星芒光暈，並享有專屬手續費減免與每日簽到雙倍紅利回饋。</p>
  <p>前往「會員中心 &gt; VIP 榮耀特權」即可查看您目前的階級進度與專屬權益！</p>
</div>`.trim()
  }
];
