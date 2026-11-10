'use client';

import { useMemo, useEffect } from 'react';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { UserProfile } from '@/types/user-profile';

export const SUPER_ADMIN_EMAILS = [
  'pickcher123@gmail.com',
  'pickcher1234@gmail.com',
];

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();
  return SUPER_ADMIN_EMAILS.some(adminEmail => adminEmail.toLowerCase().trim() === cleanEmail);
}

export function useIsAdmin() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  // 額外監聽 admins/{user.uid}
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'admins', user.uid);
  }, [firestore, user]);
  const { data: adminDoc, isLoading: isAdminDocLoading } = useDoc<any>(adminDocRef);

  // 額外監聽以 email 為鍵名之 admins/{email}
  const cleanEmail = user?.email?.toLowerCase().trim();
  const adminEmailDocRef = useMemoFirebase(() => {
    if (!firestore || !cleanEmail) return null;
    return doc(firestore, 'admins', cleanEmail);
  }, [firestore, cleanEmail]);
  const { data: adminEmailDoc, isLoading: isAdminEmailDocLoading } = useDoc<any>(adminEmailDocRef);

  const isSuperAdmin = useMemo(() => {
    return isSuperAdminEmail(user?.email);
  }, [user]);

  const isAdmin = useMemo(() => {
    if (isSuperAdmin) return true;

    // 1. 檢查 users/{uid} 集合之 role / isAdmin 標記
    const role = userProfile?.role?.toLowerCase()?.trim();
    if (role === 'admin' || role === 'superadmin' || userProfile?.isAdmin === true || (userProfile as any)?.is_admin === true) {
      return true;
    }

    // 2. 檢查 admins/{uid} 文件是否存在或角色為 admin
    if (adminDoc && (adminDoc.role?.toLowerCase() === 'admin' || adminDoc.isAdmin === true || adminDoc.uid === user?.uid || adminDoc.id === user?.uid)) {
      return true;
    }

    // 3. 檢查 admins/{email} 文件
    if (adminEmailDoc && (adminEmailDoc.role?.toLowerCase() === 'admin' || adminEmailDoc.isAdmin === true || adminEmailDoc.id)) {
      return true;
    }

    return false;
  }, [isSuperAdmin, userProfile, adminDoc, adminEmailDoc, user?.uid]);

  // 當被指派的管理員登入時，自動同步確保 users/{uid} 與 admins/{uid} 皆具備完整管理員標記
  useEffect(() => {
    if (!firestore || !user || !isAdmin) return;

    const needsUserSync = userProfile && (userProfile.role !== 'admin' || !userProfile.isAdmin);
    const needsAdminDocSync = !adminDoc;

    if (needsUserSync || needsAdminDocSync) {
      try {
        const cleanEmail = user.email?.toLowerCase().trim() || '';
        // 同步更新 users/{user.uid}
        setDoc(doc(firestore, 'users', user.uid), {
          role: 'admin',
          isAdmin: true,
          updatedAt: serverTimestamp(),
        }, { merge: true }).catch(() => {});

        // 同步更新 admins/{user.uid}
        setDoc(doc(firestore, 'admins', user.uid), {
          uid: user.uid,
          email: cleanEmail,
          role: 'admin',
          isAdmin: true,
          updatedAt: serverTimestamp(),
        }, { merge: true }).catch(() => {});
      } catch (err) {
        // 忽略背景同步錯誤
      }
    }
  }, [firestore, user, isAdmin, userProfile, adminDoc]);

  // 正確等待所有管理員驗證文件完成讀取，避免網路微秒延遲導致 false negative
  const isLoading = isUserLoading || (!isSuperAdmin && !isAdmin && (
    isProfileLoading ||
    isAdminDocLoading ||
    (Boolean(cleanEmail) && isAdminEmailDocLoading)
  ));

  return {
    user,
    userProfile,
    isAdmin: Boolean(isAdmin),
    isSuperAdmin,
    isLoading,
  };
}
