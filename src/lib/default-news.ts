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
    id: "official-v5-release",
    title: "🚀【重磅發布】P+Carder 公測版 5.0 旗艦版本全面上線！全方位微距放大鏡與資產安全革新",
    category: "遊戲更新",
    type: "image",
    imageUrl: "/version_5_release.jpg",
    isPinned: true,
    isMarquee: true,
    createdAt: { seconds: Math.floor(Date.now() / 1000) },
    content: `
<div class="space-y-4 text-slate-200">
  <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
    <h3 class="text-base sm:text-lg font-black text-amber-400 mb-1">🎉 歡迎來到 P+Carder 數位球員卡全新世代！</h3>
    <p class="text-xs sm:text-sm text-slate-300">
      我們非常榮幸地向全體收藏家與玩家宣布：<strong>【P+Carder 公測版 5.0】旗艦版本正式全面實裝上線！</strong>
      本次改版匯聚了社群反饋、頂尖前端物理渲染技術與安全防護架構，為所有喜愛球員卡與動漫卡牌的玩家帶來跨世代的數位收藏與抽卡體驗。
    </p>
  </div>

  <div class="space-y-3">
    <h4 class="text-sm sm:text-base font-black text-white flex items-center gap-2">
      <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
      五大核心革命性升級亮點
    </h4>
    
    <div class="grid grid-cols-1 gap-2.5 text-xs sm:text-sm">
      <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
        <strong class="text-cyan-400 font-bold block mb-1">🔍 1. 全方位雙面數位放大鏡 (2.5x Ultra-Res Inspector)</strong>
        <span>全新突破！無論在卡盒預覽或個人收藏庫，皆可切換 2.5x 視網膜級微距放大。卡片正面的球員簽名防偽雷射燙金、背面限量編號與球員歷年數據，皆清晰可辨，還原實體評級卡盒的真實觸摸質感。</span>
      </div>

      <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
        <strong class="text-purple-400 font-bold block mb-1">🌌 2. Cyberpunk 全息玻璃擬態 2.0 (Glassmorphism & Progressive Aura)</strong>
        <span>全面升級午夜深藍磨砂材質，搭配專屬動態流光霓虹青（#06B6D4）與傳奇金（#EAB308），開盒、抽卡與查看卡片時伴隨細緻星芒粒子，視覺震撼拉滿。</span>
      </div>

      <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
        <strong class="text-emerald-400 font-bold block mb-1">🛡️ 3. 已回收數位資產獨立管理體系 (Recycled Vault)</strong>
        <span>導入全站唯一數位資產識別碼（Digital Asset ID），玩家卡片「轉點/熔煉」後自動進入隔離回收庫，保障所有即時流通卡片之稀缺性與唯一性，杜絕誤刪風險。</span>
      </div>

      <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
        <strong class="text-amber-400 font-bold block mb-1">🤖 4. AI 智慧營運價格推薦演算法 (AI Pricing Engine)</strong>
        <span>智慧演算卡池期望值與獎項分佈比率，提供最公平合理的單抽與多抽售價模型，杜絕暗箱，落實「公開透明、機率披露」宗旨。</span>
      </div>

      <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
        <strong class="text-yellow-400 font-bold block mb-1">📱 5. 行動端全介面極致優化</strong>
        <span>包含手機版 2x2 四宮格卡片規則導覽、VIP 榮耀階級橫向圖譜、頂部一體化點數與秒級安全加值彈窗，單手操作絲滑流暢。</span>
      </div>
    </div>
  </div>

  <div class="space-y-3 pt-2">
    <h4 class="text-sm sm:text-base font-black text-white flex items-center gap-2">
      <span class="w-2 h-2 rounded-full bg-amber-400"></span>
      全版本更新歷程回顧 (Version History Overview)
    </h4>
    <div class="text-xs space-y-1.5 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 font-medium leading-relaxed">
      <p><span class="text-amber-400 font-bold">【公測版 5.0】</span>雙面 2.5x 數位放大鏡、Cyberpunk 2.0、回收資產庫、AI 價格演算法。</p>
      <p><span class="text-cyan-400 font-bold">【公測版 1.1】</span>已回收資產手動管理、福袋重製退款邏輯修正、物理真實卡片翻轉視距。</p>
      <p><span class="text-purple-400 font-bold">【公測版 1.0】</span>拆卡直播重播系統、收藏庫點擊觸發優化、Firestore 權限重構與效能飛躍。</p>
      <p><span class="text-slate-300 font-bold">【版本 7.4.5】</span>VIP 橫向圖譜、手機版 2x2 四宮格規則、整合加值彈窗。</p>
      <p><span class="text-slate-300 font-bold">【版本 7.4.4】</span>微距放大鏡首發、AI 定價推薦、移除遮罩 100% 原始卡面。</p>
      <p><span class="text-slate-300 font-bold">【版本 7.4.3】</span>VIP 專屬 Progressive Aura 光暈、成就牆視覺強化、1x4 寬螢幕網格。</p>
      <p><span class="text-slate-300 font-bold">【版本 7.4.2】</span>全站 JSON-LD SEO 結構化資料、動態 Sitemap、社群分享卡。</p>
      <p><span class="text-slate-300 font-bold">【版本 7.4.1】</span>品牌精神「公開透明、機率披露」、按鈕權重與福袋進度條純淨化。</p>
      <p><span class="text-slate-300 font-bold">【版本 7.4.0】</span>全息玻璃擬態風格奠基、開獎前置權益校驗。</p>
    </div>
  </div>

  <div class="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-transparent border border-amber-500/20 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div>
      <span class="text-amber-300 font-bold">🎁 公測版 5.0 限定回饋慶典：</span>
      <span class="text-slate-300">連續每日簽到享雙倍紅利，至首頁加入官方 Line 社群即可領取免費抽卡券！</span>
    </div>
    <a href="/changelog" class="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-bold underline shrink-0">
      前往完整更新日誌 &rarr;
    </a>
  </div>
</div>
    `.trim()
  },
  {
    id: "official-security-rules",
    title: "🛡️【系統公告】P+Carder 數位資產防護與公平抽卡機率披露準則",
    category: "系統公告",
    type: "text",
    isPinned: false,
    isMarquee: false,
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 86400 },
    content: `
<div class="space-y-3 text-xs sm:text-sm text-slate-300">
  <p>P+Carder 始終堅持「公開透明、機率披露、數位存證」的最高運作準則：</p>
  <ul class="list-disc pl-5 space-y-1.5">
    <li><strong>實時卡池公示</strong>：每一款卡池的大獎清冊、剩餘包數與機率完全即時公開，無任何後台操控。</li>
    <li><strong>資產安全鐵壁</strong>：使用者的卡片資產與帳戶點數受 Firestore 頂級安全規則保護，嚴格防禦任何非授權篡改。</li>
    <li><strong>實物兌換保障</strong>：抽中之稀有實體球員卡支援防偽包裝寄送，提供完整的拆盒拆卡公證錄影。</li>
  </ul>
</div>
    `.trim()
  },
  {
    id: "official-vip-privilege",
    title: "👑【活動快訊】VIP 榮耀階級圖譜升級與專屬星芒光暈開放體驗",
    category: "活動快訊",
    type: "text",
    isPinned: false,
    isMarquee: false,
    createdAt: { seconds: Math.floor(Date.now() / 1000) - 172800 },
    content: `
<div class="space-y-3 text-xs sm:text-sm text-slate-300">
  <p>全新 VIP 階級特權現已開放！玩家累積充值與抽卡活躍度，即可解鎖對應階級頭像框、Progressive Aura 動態星芒光暈，並享有專屬手續費減免與每日簽到雙倍紅利回饋。</p>
  <p>前往「會員中心 &gt; VIP 榮耀特權」即可查看您目前的階級進度與專屬權益！</p>
</div>
    `.trim()
  }
];
