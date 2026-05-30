import type { Firestore } from "firebase-admin/firestore";
import { blindWidthFieldName, isSupportedBlindWidthMm } from "@/lib/google/blinds-width-columns";
import { blindsPriceDocId } from "@/lib/google/blinds-type-slug";
import { isDataBlindsMetaDocument } from "@/lib/firestore/data-blinds-collection";

/** Raw matrix price (GST exclusive cost) for type + drop + width. */
export async function lookupBlindsUnitPrice(
  db: Firestore,
  blindType: string,
  dropMm: number,
  widthMm: number,
): Promise<number | null> {
  const type = blindType.trim();
  if (!type || !Number.isFinite(dropMm) || !isSupportedBlindWidthMm(widthMm)) return null;
  const ref = db.collection("data_blinds").doc(blindsPriceDocId(type, dropMm));
  const snap = await ref.get();
  if (!snap.exists || isDataBlindsMetaDocument(snap.id)) return null;
  const field = blindWidthFieldName(widthMm);
  const raw = snap.data()?.[field];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return null;
}
