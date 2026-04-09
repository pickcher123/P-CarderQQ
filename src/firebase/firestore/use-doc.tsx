'use client';
    
import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useDoc hook.
 * @template T Type of the document data.
 */
export interface UseDocResult<T> {
  data: WithId<T> | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
  setData?: (data: T & { id: string }) => void;
  forceRefetch?: () => void;
}

/**
 * React hook to subscribe to a single Firestore document in real-time.
 */
export function useDoc<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
): UseDocResult<T> {
  type StateDataType = WithId<T> | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const [tick, setTick] = useState(0);

  const forceRefetch = () => setTick(t => t + 1);

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (snapshot.exists()) {
          setData({ ...(snapshot.data() as T), id: snapshot.id });
        } else {
          setData(null);
        }
        setError(null);
        setIsLoading(false);
      },
      (fError: FirestoreError) => {
        console.error("Firestore useDoc Error:", fError.code, fError.message);

        if (fError.code === 'permission-denied') {
            const contextualError = new FirestorePermissionError({
              operation: 'get',
              path: memoizedDocRef.path,
            })
            setError(contextualError)
            errorEmitter.emit('permission-error', contextualError);
        } else {
            setError(fError);
        }
        
        setData(null)
        setIsLoading(false)
      }
    );

    return () => unsubscribe();
  }, [memoizedDocRef, tick]);

  return { data, isLoading, error, setData, forceRefetch };
}