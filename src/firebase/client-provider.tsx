'use client';

import React, { useState, useEffect, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase/init';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [services, setServices] = useState<ReturnType<typeof initializeFirebase> | null>(null);

  useEffect(() => {
    // 嚴格確保 Firebase 僅在客戶端掛載後初始化，避免 SSR 期間的 Chunk 載入與 Hydration 錯誤
    setServices(initializeFirebase());
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
