
import { Timestamp } from "firebase/firestore";

export interface UserProfile {
  id: string;
  username: string;
  hasChangedUsername?: boolean; // 新增：紀錄是否已修改過會員名稱
  realName?: string; // 新增：出貨用真實姓名
  email: string;
  phone?: string;
  photoURL?: string;
  userLevel: string;
  points: number; // Diamonds
  bonusPoints: number; // Bonus P-Points (10 P-Points = 1 Diamond)
  totalSpent: number; // 累積消費金額 (Diamonds)，用於升級
  role: 'admin' | 'user';
  permissions?: string[];
  agentId?: string; // 綁定的業務/代理人 ID
  agentName?: string; // 綁定的業務名稱
  tags?: string[];
  createdAt?: Timestamp;
  address?: string;
  freeDrawTickets?: number; // 持有的免費抽卡券數量
  claimedWelcomeTicket?: boolean; // 是否已領取新手首登免費券
  claimedPromoCodes?: string[]; // 已領取的兌換碼列表
  inviteCode?: string; // 專屬邀請碼
  invitedBy?: string; // 綁定的邀請人代碼
  inviteCount?: number; // 成功邀請好友數量
}
