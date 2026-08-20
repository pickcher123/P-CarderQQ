'use client';
import { getAuth, type User } from 'firebase/auth';

type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

interface FirebaseAuthToken {
  name: string | null;
  email: string | null;
  email_verified: boolean;
  phone_number: string | null;
  sub: string;
  firebase: {
    identities: Record<string, string[]>;
    sign_in_provider: string;
    tenant: string | null;
  };
}

interface FirebaseAuthObject {
  uid: string;
  token: FirebaseAuthToken;
}

interface SecurityRuleRequest {
  auth: FirebaseAuthObject | null;
  method: string;
  path: string;
  resource?: {
    data: any;
  };
}

/**
 * Builds a security-rule-compliant auth object from the Firebase User.
 * @param currentUser The currently authenticated Firebase user.
 * @returns An object that mirrors request.auth in security rules, or null.
 */
function buildAuthObject(currentUser: User | null): FirebaseAuthObject | null {
  if (!currentUser) {
    return null;
  }

  const token: FirebaseAuthToken = {
    name: currentUser.displayName,
    email: currentUser.email,
    email_verified: currentUser.emailVerified,
    phone_number: currentUser.phoneNumber,
    sub: currentUser.uid,
    firebase: {
      identities: currentUser.providerData.reduce((acc, p) => {
        if (p.providerId) {
          acc[p.providerId] = [p.uid];
        }
        return acc;
      }, {} as Record<string, string[]>),
      sign_in_provider: currentUser.providerData[0]?.providerId || 'custom',
      tenant: currentUser.tenantId,
    },
  };

  return {
    uid: currentUser.uid,
    token: token,
  };
}

/**
 * Builds the complete, simulated request object for the error message.
 * It safely tries to get the current authenticated user.
 * @param context The context of the failed Firestore operation.
 * @returns A structured request object.
 */
function buildRequestObject(context: SecurityRuleContext): SecurityRuleRequest {
  let authObject: FirebaseAuthObject | null = null;
  try {
    // Safely attempt to get the current user.
    const firebaseAuth = getAuth();
    const currentUser = firebaseAuth.currentUser;
    if (currentUser) {
      authObject = buildAuthObject(currentUser);
    }
  } catch {
    // This will catch errors if the Firebase app is not yet initialized.
    // In this case, we'll proceed without auth information.
  }

  return {
    auth: authObject,
    method: context.operation,
    path: `/databases/(default)/documents/${context.path}`,
    resource: context.requestResourceData ? { data: context.requestResourceData } : undefined,
  };
}

/**
 * Helper to safely clean objects for JSON serialization, handling circular references,
 * Firestore sentinels, DOM objects, and non-plain instances safely.
 */
function deepCleanForJSON(obj: any, seen = new WeakSet()): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object' && typeof obj !== 'function') return obj;
  
  if (typeof obj === 'function') return '[Function]';

  if (typeof window !== 'undefined') {
    if (obj instanceof Node || obj instanceof Event || obj instanceof Window) {
      return `[${obj.constructor?.name || 'DOMObject'}]`;
    }
  }

  if (seen.has(obj)) {
    return '[Circular]';
  }
  seen.add(obj);

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: obj.message,
      stack: obj.stack
    };
  }

  // Handle non-plain object instances (like Firestore DocumentReference, Timestamp, FieldValue)
  if (obj.constructor && obj.constructor.name !== 'Object' && obj.constructor.name !== 'Array') {
    if (typeof obj.path === 'string') {
      return `[DocumentReference: ${obj.path}]`;
    }
    if (typeof obj.toDate === 'function') {
      try { return obj.toDate().toISOString(); } catch { return '[Timestamp]'; }
    }
    if (obj.isEqual || obj._delegate || obj.type) {
      return `[${obj.constructor.name || 'FirestoreSentinel'}]`;
    }
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepCleanForJSON(item, seen));
  }

  const result: Record<string, any> = {};
  try {
    const keys = Object.keys(obj);
    for (const key of keys) {
      if (key.startsWith('_')) continue; // Skip internal hidden properties
      try {
        result[key] = deepCleanForJSON(obj[key], seen);
      } catch {
        result[key] = '[Unserializable]';
      }
    }
  } catch {
    return String(obj);
  }

  return result;
}

function safeStringify(obj: any, indent = 2): string {
  try {
    const seen = new WeakSet();
    return JSON.stringify(
      obj,
      (key, value) => {
        if (key.startsWith('_')) return undefined;
        if (typeof value === 'function') return '[Function]';
        if (typeof value === 'object' && value !== null) {
          if (typeof window !== 'undefined') {
            if (value instanceof Node || value instanceof Event || value instanceof Window) {
              return `[${value.constructor?.name || 'DOMObject'}]`;
            }
          }
          if (value instanceof Error) {
            return { name: value.name, message: value.message, stack: value.stack };
          }
          if (typeof value.toDate === 'function') {
            try { return value.toDate().toISOString(); } catch { return '[Timestamp]'; }
          }
          if (typeof value.path === 'string' && value.firestore) {
            return `[DocumentReference: ${value.path}]`;
          }
          if (seen.has(value)) {
            return '[Circular]';
          }
          seen.add(value);
        }
        return value;
      },
      indent
    );
  } catch {
    return '[Unserializable Object]';
  }
}

/**
 * Builds the final, formatted error message for the LLM.
 * @param requestObject The simulated request object.
 * @returns A string containing the error message and the JSON payload.
 */
function buildErrorMessage(requestObject: SecurityRuleRequest): string {
  return `Missing or insufficient permissions: The following request was denied by Firestore Security Rules:
${safeStringify(requestObject, 2)}`;
}

/**
 * A custom error class designed to be consumed by an LLM for debugging.
 * It structures the error information to mimic the request object
 * available in Firestore Security Rules.
 */
export class FirestorePermissionError extends Error {
  public readonly request: SecurityRuleRequest;

  constructor(context: SecurityRuleContext) {
    const requestObject = buildRequestObject(context);
    super(buildErrorMessage(requestObject));
    this.name = 'FirebaseError';
    
    // Clean requestObject to ensure it contains no circular or DOM references for Next.js error serialization
    try {
      this.request = JSON.parse(safeStringify(requestObject));
    } catch {
      this.request = {
        auth: null,
        method: context.operation,
        path: `/databases/(default)/documents/${context.path}`
      };
    }
  }
}
