import { auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const cleanObject = (obj: any): any => {
  if (obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(v => cleanObject(v));
  } else if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned = Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, v === undefined ? null : cleanObject(v)])
    );
    return cleaned;
  }
  return obj;
};

// Client-side safeguard against query loops
let readHistory: number[] = [];
const RATE_LIMIT_WINDOW_MS = 10000; // 10 seconds
const RATE_LIMIT_THRESHOLD = 80;    // 80 reads (approx. one full panel load + buffer)

export function trackClientReadRate(count: number = 1) {
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    readHistory.push(now);
  }
  // Keep only timestamps within the window
  readHistory = readHistory.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);
  
  if (readHistory.length > RATE_LIMIT_THRESHOLD) {
    console.warn(
      `[CRITICAL WARNING-FIRESTORE] High read operation rate detected: ${readHistory.length} reads in the last ${RATE_LIMIT_WINDOW_MS / 1000}s. ` +
      `Please check for infinite render loops or uncontrolled useEffect hooks.`
    );
  }
}

