import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { deleteOrphanedObjectCategoryLookups } from "@/lib/server/orphaned-object-category-lookups";

export const runtime = "nodejs";

/** POST — delete all ObjectCategory lookups with no matching quote_objects.category. */
export async function POST() {
  try {
    const db = getAdminFirestore();
    const result = await deleteOrphanedObjectCategoryLookups(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to delete legacy ObjectCategory lookups";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
