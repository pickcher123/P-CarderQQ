'use client';

import { useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import type { UserProfile } from '@/types/user-profile';

/**
 * PublicProfileSync ensures that a subset of the user's profile is mirrored
 * to a public collection for use in leaderboards and public lists.
 */
export function PublicProfileSync() {
  // PublicProfileSync is disabled as users_public collection is no longer in use.
  return null;
}
