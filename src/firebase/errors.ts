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

  const providerData = Array.isArray(currentUser.providerData) ? currentUser.providerData : [];
  const identities: Record<string, string[]> = {};
  for (const p of providerData) {
    if (p && p.providerId && p.uid) {
      identities[p.providerId] = [String(p.uid)];
    }
  }

  const token: FirebaseAuthToken = {
    name: currentUser.displayName || null,
    email: currentUser.email || null,
    email_verified: Boolean(currentUser.emailVerified),
    phone_number: currentUser.phoneNumber || null,
    sub: currentUser.uid || '',
    firebase: {
      identities,
      sign_in_provider: providerData[0]?.providerId || 'custom',
      tenant: currentUser.tenantId || null,
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
 * Helper to determine if an object is a pure plain JavaScript object.
 */
function isPlainObject(obj: any): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  const proto = Object.getPrototypeOf(obj);
  return proto === null || proto === Object.prototype;
}

/**
 * Helper to safely clean objects for JSON serialization, handling circular references,
 * Firestore sentinels, DOM objects, and non-plain instances safely.
 */
function deepCleanForJSON(obj: any, seen = new Set(), depth = 0): any {
  if (obj === null || obj === undefined) return obj;
  const t = typeof obj;
  if (t === 'string' || t === 'number' || t === 'boolean') return obj;
  if (t === 'bigint') return obj.toString();
  if (t === 'symbol') return obj.toString();
  if (t === 'function') return '[Function]';
  if (depth > 4) return '[DepthLimit]';

  if (typeof window !== 'undefined') {
    try {
      if (obj instanceof Node || obj instanceof Event || obj instanceof Window) {
        return `[${obj.constructor?.name || 'DOMObject'}]`;
      }
    } catch {
      return '[DOMObject]';
    }
  }

  // Handle circular references using Set (supporting object identity)
  if (seen.has(obj)) {
    return '[Circular]';
  }
  try {
    seen.add(obj);
  } catch {
    // If obj cannot be added to Set
  }

  if (obj instanceof Date) {
    try {
      return obj.toISOString();
    } catch {
      return String(obj);
    }
  }

  if (obj instanceof Error) {
    return {
      name: String(obj.name || 'Error'),
      message: String(obj.message || ''),
      stack: typeof obj.stack === 'string' ? obj.stack.slice(0, 200) : undefined,
    };
  }

  if (Array.isArray(obj)) {
    return obj.slice(0, 50).map(item => deepCleanForJSON(item, seen, depth + 1));
  }

  // Handle Firebase DocumentReference, Timestamp, FieldValue sentinels
  try {
    if (typeof obj.path === 'string' && (obj.firestore || obj.id)) {
      return `[DocumentReference: ${obj.path}]`;
    }
    if (typeof obj.toDate === 'function') {
      return obj.toDate().toISOString();
    }
  } catch {
    // ignore
  }

  // If this is a complex class instance or minified constructor (not a plain Object), do not deeply inspect internal engine fields
  if (!isPlainObject(obj)) {
    const ctorName = obj?.constructor?.name || 'Instance';
    // If it has basic ID/name properties, extract only those
    if (obj && typeof obj === 'object') {
      const basicSummary: Record<string, any> = { _type: ctorName };
      if (obj.id) basicSummary.id = String(obj.id);
      if (obj.name) basicSummary.name = String(obj.name);
      if (obj.code) basicSummary.code = String(obj.code);
      if (obj.message) basicSummary.message = String(obj.message);
      return basicSummary;
    }
    return `[${ctorName}]`;
  }

  const result: Record<string, any> = {};
  try {
    const keys = Object.keys(obj);
    for (const key of keys) {
      if (key.startsWith('_')) continue; // Skip internal hidden properties
      try {
        result[key] = deepCleanForJSON(obj[key], seen, depth + 1);
      } catch {
        result[key] = '[Unserializable]';
      }
    }
  } catch {
    return '[ComplexObject]';
  }

  return result;
}

function safeStringify(obj: any, indent = 2): string {
  try {
    const stringifySeen = new Set();
    const cleaned = deepCleanForJSON(obj);
    return (
      JSON.stringify(
        cleaned,
        (_key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (stringifySeen.has(value)) {
              return '[Circular]';
            }
            try {
              stringifySeen.add(value);
            } catch {
              // ignore
            }
          }
          return value;
        },
        indent
      ) || '{}'
    );
  } catch {
    return '{"error": "[SerializationFailed]"}';
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
    let requestObject: SecurityRuleRequest;
    try {
      const sanitizedContext: SecurityRuleContext = {
        path: String(context.path || ''),
        operation: context.operation,
        requestResourceData: context.requestResourceData ? deepCleanForJSON(context.requestResourceData) : undefined,
      };
      requestObject = buildRequestObject(sanitizedContext);
    } catch {
      requestObject = {
        auth: null,
        method: context.operation,
        path: `/databases/(default)/documents/${context.path || ''}`
      };
    }

    let errorMessage = 'Missing or insufficient permissions: The request was denied by Firestore Security Rules.';
    try {
      errorMessage = buildErrorMessage(requestObject);
    } catch {
      // Keep default message
    }

    super(errorMessage);
    this.name = 'FirebaseError';
    
    // Ensure this.request is a completely plain, safe object
    try {
      this.request = deepCleanForJSON(requestObject);
    } catch {
      this.request = {
        auth: null,
        method: context.operation,
        path: `/databases/(default)/documents/${context.path || ''}`
      };
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      request: this.request,
    };
  }
}
