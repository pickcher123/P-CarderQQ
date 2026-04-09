export interface DailyMission {
  id: string;
  title: string;
  description: string;
  rewardPoints: number;
  type: 'login' | 'drawCard' | 'winBet';
  taskTarget: number;
  isActive: boolean;
}

export interface UserMissionProgress {
  id: string;
  userId: string;
  progress: number;
  lastCompleted: string; // YYYY-MM-DD
}

    