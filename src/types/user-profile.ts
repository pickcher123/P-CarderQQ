
import { FieldValue, Timestamp } from "firebase/firestore";

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
  tags?: string[];
  createdAt?: Timestamp;
  address?: string;
}
