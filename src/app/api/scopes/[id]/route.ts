import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isScopesMetaDocument } from "@/lib/firestore/scopes-collection";
import { dedupeAreaDocIds, normalizedScopeAreaState } from "@/lib/scope-areas";
import { loadScopeAreaContext, type ScopeAreaContext } from "@/lib/server/scope-area-load-context";
import { ensureAreaNumericId } from "@/lib/server/resolve-ids";
import {
  firestoreAnswersToPublic,
  orderScopeAreaDocIdsByTemplate,
  scopeDocToPublic,
} from "@/lib/server/scope-doc";
import {
  migrateAllLegacyScopeDocs,
  renumberScopesForAreaDocId,
} from "@/lib/server/template-sort-order";
import type { ScopePublic } from "@/types/scope";
import { normalizeScopeAnswers, normalizeSystemScopeFields, scopePatchSchema } from "../scope-validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function publicFromData(
  id: string,
  data: DocumentData,
  docIdByAreaid: Map<number, string>,
  nameByAreaid: Map<number, string>,
  areasOrdered: ScopeAreaContext["areasOrdered"],
): ScopePublic {
  return scopeDocToPublic(id, data, docIdByAreaid, nameByAreaid, areasOrdered);
}

function allowedAreaIds(ctx: Awaited<ReturnType<typeof loadScopeAreaContext>>): Set<string> {
  return new Set(ctx.areasOrdered.map((a) => a.id));
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isScopesMetaDocument(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = getAdminFirestore();
    const ref = db.collection("scopes").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const ctx = await loadScopeAreaContext(db);
    await migrateAllLegacyScopeDocs(db, ctx.docIdByAreaid);
    const fresh = await ref.get();
    return NextResponse.json({
      scope: publicFromData(id, fresh.data()!, ctx.docIdByAreaid, ctx.nameByAreaid, ctx.areasOrdered),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load scope";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isScopesMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot modify collection metadata" }, { status: 403 });
    }
    const raw = await req.json();
    const parsed = scopePatchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }
    const db = getAdminFirestore();
    const ctx = await loadScopeAreaContext(db);
    await migrateAllLegacyScopeDocs(db, ctx.docIdByAreaid);
    const allow = allowedAreaIds(ctx);

    const ref = db.collection("scopes").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const prevData = snap.data()!;
    const prevNorm = normalizedScopeAreaState(prevData as Record<string, unknown>, ctx.docIdByAreaid);
    const prevKind =
      prevData.kind === "header"
        ? "header"
        : prevData.kind === "footer"
          ? "footer"
          : "question";
    const nextKind = parsed.data.kind ?? prevKind;

    if (parsed.data.tagAllAreas === true && (nextKind === "header" || nextKind === "footer")) {
      return NextResponse.json(
        { error: "tagAllAreas applies to question scopes only" },
        { status: 400 },
      );
    }

    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (parsed.data.question !== undefined) {
      update.question = parsed.data.question;
    }

    let nextAreaDocIds = prevNorm.areaDocIds;
    const areaPayload =
      parsed.data.tagAllAreas === true ||
      parsed.data.areaDocIds !== undefined ||
      parsed.data.areaDocId !== undefined;

    if (areaPayload) {
      if (nextKind === "header" || nextKind === "footer") {
        const ad = (parsed.data.areaDocId ?? prevNorm.areaDocIds[0] ?? "").trim();
        if (!ad || !allow.has(ad)) {
          return NextResponse.json({ error: "Invalid area for section marker" }, { status: 400 });
        }
        nextAreaDocIds = [ad];
      } else if (parsed.data.tagAllAreas === true) {
        nextAreaDocIds = ctx.areasOrdered.map((a) => a.id);
      } else if (parsed.data.areaDocIds !== undefined) {
        nextAreaDocIds = dedupeAreaDocIds(parsed.data.areaDocIds);
        if (nextKind === "question" && nextAreaDocIds.length === 0) {
          return NextResponse.json(
            { error: "Select at least one template area" },
            { status: 400 },
          );
        }
      } else if (parsed.data.areaDocId !== undefined) {
        nextAreaDocIds = [parsed.data.areaDocId.trim()];
      }
      if (nextKind === "question" && nextAreaDocIds.length > 0) {
        nextAreaDocIds = orderScopeAreaDocIdsByTemplate(ctx.areasOrdered, nextAreaDocIds);
      }
      for (const ad of nextAreaDocIds) {
        if (!allow.has(ad)) {
          return NextResponse.json({ error: `Invalid area: ${ad}` }, { status: 400 });
        }
      }
      if (nextKind === "question" && nextAreaDocIds.length === 0) {
        return NextResponse.json({ error: "Select at least one template area" }, { status: 400 });
      }
      update.areaDocIds = nextAreaDocIds;
      update.areaid = await ensureAreaNumericId(db, nextAreaDocIds[0]);
    }

    if (nextKind === "header" || nextKind === "footer") {
      update.kind = nextKind;
      update.answers = [];
      update.systemScope = false;
      update.systemScopeType = null;
    } else {
      update.kind = "question";
      if (parsed.data.answers !== undefined) {
        update.answers = normalizeScopeAnswers(parsed.data.answers);
      } else if (prevKind === "header" || prevKind === "footer") {
        return NextResponse.json(
          {
            error:
              "Include answers when converting a section marker to a question (or send answers in the same request)",
          },
          { status: 400 },
        );
      }

      if (parsed.data.systemScope !== undefined || parsed.data.systemScopeType !== undefined) {
        const { systemScope, systemScopeType } = normalizeSystemScopeFields({
          systemScope: parsed.data.systemScope,
          systemScopeType: parsed.data.systemScopeType,
        });
        update.systemScope = systemScope;
        update.systemScopeType = systemScopeType;
      }

      let finalAnswerCount = 0;
      if (parsed.data.answers !== undefined) {
        finalAnswerCount = normalizeScopeAnswers(parsed.data.answers).length;
      } else {
        finalAnswerCount = firestoreAnswersToPublic(prevData.answers).length;
      }
      if (finalAnswerCount === 0) {
        return NextResponse.json(
          { error: "Question scopes require at least one answer" },
          { status: 400 },
        );
      }
    }

    if ((nextKind === "header" || nextKind === "footer") && nextAreaDocIds.length !== 1) {
      return NextResponse.json(
        { error: "Headers and footers must tag exactly one template area." },
        { status: 400 },
      );
    }

    await ref.update(update);
    const next = await ref.get();
    const nextData = next.data()!;

    if (areaPayload) {
      const afterNorm = normalizedScopeAreaState(nextData as Record<string, unknown>, ctx.docIdByAreaid);
      const affected = new Set<string>([...prevNorm.areaDocIds, ...afterNorm.areaDocIds]);
      for (const ad of affected) {
        const aid = await ensureAreaNumericId(db, ad);
        await renumberScopesForAreaDocId(db, ad, aid, ctx.docIdByAreaid);
      }
    }

    const ctx2 = await loadScopeAreaContext(db);
    return NextResponse.json({
      scope: publicFromData(id, nextData, ctx2.docIdByAreaid, ctx2.nameByAreaid, ctx2.areasOrdered),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update scope";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isScopesMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot delete collection metadata" }, { status: 403 });
    }
    const db = getAdminFirestore();
    const ctx = await loadScopeAreaContext(db);
    await migrateAllLegacyScopeDocs(db, ctx.docIdByAreaid);
    const ref = db.collection("scopes").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const prevNorm = normalizedScopeAreaState(snap.data()! as Record<string, unknown>, ctx.docIdByAreaid);
    await ref.delete();
    for (const ad of prevNorm.areaDocIds) {
      const aid = await ensureAreaNumericId(db, ad);
      await renumberScopesForAreaDocId(db, ad, aid, ctx.docIdByAreaid);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete scope";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
