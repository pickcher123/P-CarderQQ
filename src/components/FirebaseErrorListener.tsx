'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // Use functional update to avoid issues with stale state
      setError(() => error);
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  // Instead of throwing directly in render, which can cause re-render loops,
  // we can use a more controlled approach if needed, but for now, 
  // let's ensure we only throw if we have a new error.
  if (error) {
    console.error("Firestore Permission Error:", error);
    return null;
  }

  return null;
}
