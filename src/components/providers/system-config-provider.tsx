'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { doc } from 'firebase/firestore';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import type { SystemConfig } from '@/types/system';

interface SystemConfigContextValue {
  systemConfig: SystemConfig | null;
  isLoading: boolean;
}

const SystemConfigContext = createContext<SystemConfigContextValue>({
  systemConfig: null,
  isLoading: true,
});

/**
 * 全站單一 systemConfig/main 即時監聽 Provider
 * 由 RootLayout 統一訂閱一次，避免各頁面與 Header / Ticker / Dialog 重複建立 Firestore listener
 */
export function SystemConfigProvider({ children }: { children: React.ReactNode }) {
  const firestore = useFirestore();
  const systemConfigRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'systemConfig', 'main') : null),
    [firestore]
  );
  const { data, isLoading } = useDoc<SystemConfig>(systemConfigRef);

  const value = useMemo<SystemConfigContextValue>(
    () => ({
      systemConfig: data ?? null,
      isLoading,
    }),
    [data, isLoading]
  );

  return (
    <SystemConfigContext.Provider value={value}>
      {children}
    </SystemConfigContext.Provider>
  );
}

export function useSystemConfig(): SystemConfigContextValue {
  return useContext(SystemConfigContext);
}
