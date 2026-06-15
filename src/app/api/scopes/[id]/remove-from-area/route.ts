import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isScopesMetaDocument } from "@/lib/firestore/scopes-collection";
import { normalizedScopeAreaState } from "@/lib/scope-areas";
import { loadScopeAreaContext } from "@/lib/server/scope-area-load-context";
import { ensureAreaNumericId } from "@/lib/server/resolve-ids";
import { orderScopeAreaDocIdsByTemplate, scopeDocToPublic } from "@/lib/server/scope-doc";
import {
  migrateAllLegacyScopeDocs,
  renumberScopesForAreaDocId,
} from "@/lib/server/template-sort-order";

export const runtime = "nodejs";

const bodySchema = z.object({
  areaDocId: z.string().min(1),
  deleteScope: z.boolean().optional().default(false),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isScopesMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot modify collection metadata" }, { status: 403 });
    }
    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const areaDocId = parsed.data.areaDocId.trim();
    const deleteScope = parsed.data.deleteScope === true;

    const db = getAdminFirestore();
    const ctx = await loadScopeAreaContext(db);
    await migrateAllLegacyScopeDocs(db, ctx.docIdByAreaid);
    const allow = new Set(ctx.areasOrdered.map((a) => a.id));
    if (!allow.has(areaDocId)) {
      return NextResponse.json({ error: "Invalid area" }, { status: 400 });
    }

    const ref = db.collection("scopes").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const data = snap.data()!;
    const prevNorm = normalizedScopeAreaState(data as Record<string, unknown>, ctx.docIdByAreaid);
    if (!prevNorm.areaDocIds.includes(areaDocId)) {
      return NextResponse.json({ error: "Scope is not tagged for this area" }, { status: 400 });
    }

    const kind =
      data.kind === "header" ? "header" : data.kind === "footer" ? "footer" : "question";

    if (deleteScope || kind === "header" || kind === "footer") {
      await ref.delete();
      for (const ad of prevNorm.areaDocIds) {
        const aid = await ensureAreaNumericId(db, ad);
        await renumberScopesForAreaDocId(db, ad, aid, ctx.docIdByAreaid);
      }
      return NextResponse.json({ ok: true, deleted: true });
    }

    const nextAreaDocIds = prevNorm.areaDocIds.filter((ad) => ad !== areaDocId);
    const nextSort = { ...prevNorm.sortOrderByAreaDocId };
    delete nextSort[areaDocId];

    const update: Record<string, unknown> = {
      areaDocIds: nextAreaDocIds,
      sortOrderByAreaDocId: nextSort,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (nextAreaDocIds.length > 0) {
      const ordered = orderScopeAreaDocIdsByTemplate(ctx.areasOrdered, nextAreaDocIds);
      update.areaid = await ensureAreaNumericId(db, ordered[0]);
    } else {
      update.areaid = FieldValue.delete();
    }

    await ref.update(update);
    const aid = await ensureAreaNumericId(db, areaDocId);
    await renumberScopesForAreaDocId(db, areaDocId, aid, ctx.docIdByAreaid);

    const next = await ref.get();
    const ctx2 = await loadScopeAreaContext(db);
    return NextResponse.json({
      ok: true,
      deleted: false,
      scope: scopeDocToPublic(
        id,
        next.data()!,
        ctx2.docIdByAreaid,
        ctx2.nameByAreaid,
        ctx2.areasOrdered,
      ),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to remove scope from area";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
