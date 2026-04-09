'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 為了安全性考量，金流設定頁面已從管理後台 UI 中移除。
 * 相關設定應直接透過伺服器環境變數 (.env) 進行配置。
 */
export default function PaymentAdminPage() {
  const router = useRouter();

  useEffect(() => {
    // 自動導向回管理首頁，防止直接輸入網址進入
    router.replace('/admin');
  }, [router]);

  return null;
}
