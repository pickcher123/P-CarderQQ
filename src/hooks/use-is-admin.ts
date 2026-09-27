'use client';

import { useMemo } from 'react';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/types/user-profile';

const SUPER_ADMINS = ['pickcher123@gmail.com'];

export function useIsAdmin() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const isSuperAdmin = useMemo(() => {
    return Boolean(user?.email && SUPER_ADMINS.includes(user.email));
  }, [user]);

  const isAdmin = useMemo(() => {
    if (isSuperAdmin) return true;
    return userProfile?.role === 'admin';
  }, [isSuperAdmin, userProfile]);

  return {
    user,
    userProfile,
    isAdmin: Boolean(isAdmin),
    isSuperAdmin,
    isLoading: isUserLoading || isProfileLoading,
  };
}
