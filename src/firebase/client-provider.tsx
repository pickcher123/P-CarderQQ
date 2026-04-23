'use client';

import React, { useState, useEffect, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase/init';

import { doc, getDocFromServer } from 'firebase/firestore';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [services, setServices] = useState<ReturnType<typeof initializeFirebase> | null>(null);

  useEffect(() => {
    // 嚴格確保 Firebase 僅在客戶端掛載後初始化，避免 SSR 期間的 Chunk 載入與 Hydration 錯誤
    const initializedServices = initializeFirebase();
    setServices(initializedServices);

    // 診斷連線狀態
    async function testConnection() {
      try {
        await getDocFromServer(doc(initializedServices.firestore, 'test', 'connection'));
      } catch (error: any) {
        if (error?.message?.includes('the client is offline') || error?.code === 'unavailable') {
          console.error("Firebase 連線失敗：請檢查 Google Cloud Console 中的 API 金鑰限制是否正確，或是否啟用了 Cloud Firestore API。");
        }
      }
    }
    testConnection();
  }, []);

  if (!services) {
    // 在服務就緒前渲染基礎結構，防止 Next.js 頁面塊載入逾時
    return <div className="min-h-screen bg-background" aria-hidden="true" />;
  }

  return (
    <FirebaseProvider
      firebaseApp={services.firebaseApp}
      auth={services.auth}
      firestore={services.firestore}
      storage={services.storage}
    >
      {children}
    </FirebaseProvider>
  );
}
