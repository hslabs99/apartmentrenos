/** Firestore rejects `undefined`; convert to `null` and drop undefined keys. */
export function sanitizeForFirestore<T>(value: T): T {
  if (value === undefined) {
    return null as T;
  }
  if (value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForFirestore(item)) as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (child === undefined) continue;
      out[key] = sanitizeForFirestore(child);
    }
    return out as T;
  }
  return value;
}
