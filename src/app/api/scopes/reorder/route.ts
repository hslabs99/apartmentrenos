import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isScopesMetaDocument } from "@/lib/firestore/scopes-collection";
import { loadScopeAreaContext } from "@/lib/server/scope-area-load-context";
import { ensureAreaNumericId } from "@/lib/server/resolve-ids";
import { migrateAllLegacyScopeDocs, reorderScopeNeighbor } from "@/lib/server/template-sort-order";

export const runtime = "nodejs";

const bodySchema = z.object({
  id: z.string().min(1),
  direction: z.enum(["up", "down"]),
  /** Template area (Firestore doc id) whose column you are reordering in. */
  contextAreaDocId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const db = getAdminFirestore();
    if (isScopesMetaDocument(parsed.data.id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const ctx = await loadScopeAreaContext(db);
    await migrateAllLegacyScopeDocs(db, ctx.docIdByAreaid);
    const allowed = new Set(ctx.areasOrdered.map((a) => a.id));
    if (!allowed.has(parsed.data.contextAreaDocId)) {
      return NextResponse.json({ error: "Invalid context area" }, { status: 400 });
    }
    const ref = db.collection("scopes").doc(parsed.data.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const data = snap.data()!;
    const tags: string[] = Array.isArray(data.areaDocIds)
      ? data.areaDocIds.filter((x: unknown): x is string => typeof x === "string")
      : [];
    if (!tags.includes(parsed.data.contextAreaDocId)) {
      return NextResponse.json(
        { error: "Scope is not tagged with this template area" },
        { status: 400 },
      );
    }
    const areaid = await ensureAreaNumericId(db, parsed.data.contextAreaDocId);
    const result = await reorderScopeNeighbor(
      db,
      parsed.data.contextAreaDocId,
      areaid,
      ctx.docIdByAreaid,
      parsed.data.id,
      parsed.data.direction,
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to reorder";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
