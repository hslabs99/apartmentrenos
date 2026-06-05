import type { DocumentData } from "firebase-admin/firestore";
import { buildDataObjectKey } from "@/lib/data-object-key";
import {
  BLINDS_QUOTE_CATEGORY,
  BLINDS_SYSTEM_OBJECT,
} from "@/lib/server/sync-blinds-quote-objects";

/** Match key used between `data_objects` and SKU-derived `quote_objects` (objectname = product type). */
export function quoteObjectSkuPipelineKey(data: DocumentData): string {
  return buildDataObjectKey({
    category: String(data.category ?? ""),
    productType: String(data.objectname ?? ""),
  });
}

/** Blinds quote objects are managed separately; never prune via SKU → data_objects pipeline. */
export function isBlindsQuoteObject(docId: string, data: DocumentData): boolean {
  if (String(data.systemObject ?? "").trim() === BLINDS_SYSTEM_OBJECT) return true;
  if (docId.startsWith("blinds_")) return true;
  if (String(data.category ?? "").trim() === BLINDS_QUOTE_CATEGORY) return true;
  return false;
}
