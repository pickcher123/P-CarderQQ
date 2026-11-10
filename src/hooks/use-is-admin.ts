'use client';

import { useMemo } from 'react';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
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

  return {
    user,
    userProfile,
    isAdmin: Boolean(isAdmin),
    isSuperAdmin,
    isLoading: isUserLoading || (isProfileLoading && !isSuperAdmin && !isAdmin),
  };
}
