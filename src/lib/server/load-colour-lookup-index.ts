import type { Firestore } from "firebase-admin/firestore";
import {
  LOOKUPS_COLOURS_COLLECTION,
  isLookupsColoursMetaDocument,
} from "@/lib/firestore/lookups-colours-collection";
import {
  buildColourLookupIndex,
  type ColourLookupIndex,
} from "@/lib/sku/colour-lookup-index";

let cachedIndex: ColourLookupIndex | null = null;

/** Load and cache colour class → descriptor expansion index from Firestore. */
export async function loadColourLookupIndex(db: Firestore): Promise<ColourLookupIndex> {
  if (cachedIndex) return cachedIndex;

  const snap = await db.collection(LOOKUPS_COLOURS_COLLECTION).get();
  const rows: { colourClass: string; descriptor: string }[] = [];
  for (const doc of snap.docs) {
    if (isLookupsColoursMetaDocument(doc.id)) continue;
    const data = doc.data();
    rows.push({
      colourClass: String(data.colourClass ?? ""),
      descriptor: String(data.descriptor ?? ""),
    });
  }

  cachedIndex = buildColourLookupIndex(rows);
  return cachedIndex;
}

/** Clear in-process colour lookup cache (tests / after import). */
export function clearColourLookupIndexCache(): void {
  cachedIndex = null;
}
