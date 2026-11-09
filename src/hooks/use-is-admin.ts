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

  const isSuperAdmin = useMemo(() => {
    return isSuperAdminEmail(user?.email);
  }, [user]);

  const isAdmin = useMemo(() => {
    if (isSuperAdmin) return true;
    const role = userProfile?.role?.toLowerCase();
    return role === 'admin' || role === 'superadmin' || userProfile?.isAdmin === true;
  }, [isSuperAdmin, userProfile]);

  return {
    user,
    userProfile,
    isAdmin: Boolean(isAdmin),
    isSuperAdmin,
    isLoading: isUserLoading || isProfileLoading,
  };
}
