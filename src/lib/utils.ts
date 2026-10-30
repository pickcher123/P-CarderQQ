import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 檢查是否為 Firestore 特殊類型（例如 FieldValue: increment, serverTimestamp, deleteField, 或 DocumentReference）
 */
function isFirestoreSentinel(val: any): boolean {
  if (!val || typeof val !== 'object') return false;
  if ('_methodName' in val || '_delegate' in val) return true;
  const cName = val.constructor?.name || '';
  if (cName.includes('FieldValue') || cName.includes('TransformOperation') || cName.includes('FieldPath')) {
    return true;
  }
  if (typeof val.id === 'string' && typeof val.path === 'string' && val.firestore) {
    return true;
  }
  return false;
}

/**
 * 遞歸清理物件或陣列中所有的 undefined 值，確保符合 Firestore Transaction / Write 規範
 * Firestore 嚴格禁止任何欄位或陣列內的物件含有 undefined，否則會拋出
 * "Function Transaction.update() called with invalid data. Unsupported field value: undefined"
 */
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === undefined) {
    return null as any;
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return obj;
  }
  if (isFirestoreSentinel(obj)) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => cleanFirestoreData(item)) as any;
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = cleanFirestoreData(value);
    }
  }
  return result as T;
}

/**
 * 安全地將 Firestore Timestamp、Date、ISO 字串或包含 seconds 的物件轉換為 JavaScript Date 物件
 */
export function toSafeDate(val: any): Date | null {
  if (!val) return null;
  if (typeof val?.toDate === 'function') {
    try {
      const d = val.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) return d;
    } catch {
      // ignore
    }
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  if (typeof val?.seconds === 'number') {
    return new Date(val.seconds * 1000);
  }
  if (typeof val?._seconds === 'number') {
    return new Date(val._seconds * 1000);
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}
