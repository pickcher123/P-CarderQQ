'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function FirebaseErrorListener() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (err: FirestorePermissionError) => {
      setErrorMessage(err?.message || 'Firestore Permission Error');
      console.warn("Firestore Permission Notice:", err?.message);
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  return null;
}

