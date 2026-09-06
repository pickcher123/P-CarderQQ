'use client';

/**
 * Global circular-safe JSON.stringify protection.
 * Prevents "Uncaught TypeError: Converting circular structure to JSON"
 * when complex objects (such as Firebase WebChannel connection instances,
 * event listeners, or DOM objects) are serialized by browser devtools,
 * Next.js telemetry, or iframe error bridges.
 */
if (typeof window !== 'undefined') {
  const originalStringify = JSON.stringify;
  try {
    JSON.stringify = function (value: any, replacer?: any, space?: any): string {
      try {
        return originalStringify(value, replacer, space);
      } catch (err: any) {
        const errorMsg = String(err?.message || '');
        if (
          err instanceof TypeError &&
          (errorMsg.includes('circular') || errorMsg.includes('cyclic'))
        ) {
          const seen = new WeakSet();
          const safeReplacer = (key: string, val: any) => {
            if (typeof val === 'object' && val !== null) {
              if (seen.has(val)) {
                return '[Circular]';
              }
              seen.add(val);
            }
            if (typeof replacer === 'function') {
              return replacer(key, val);
            }
            return val;
          };
          try {
            return originalStringify(value, safeReplacer, space);
          } catch {
            return '"[Circular]"';
          }
        }
        throw err;
      }
    };
  } catch {
    // If JSON.stringify cannot be reassigned in the environment, continue gracefully
  }
}

export {};
