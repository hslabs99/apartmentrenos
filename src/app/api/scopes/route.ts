import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { allocateNextSequence } from "@/lib/firestore/sequences";
import { isScopesMetaDocument } from "@/lib/firestore/scopes-collection";
import { compareScopesForGlobalList, dedupeAreaDocIds } from "@/lib/scope-areas";
import {
  loadScopeAreaContext,
  type ScopeAreaContext,
} from "@/lib/server/scope-area-load-context";
import { ensureAreaNumericId } from "@/lib/server/resolve-ids";
import { orderScopeAreaDocIdsByTemplate, scopeDocToPublic } from "@/lib/server/scope-doc";
import {
  insertScopesAfterDoc,
  migrateAllLegacyScopeDocs,
  renumberScopesForAreaDocId,
} from "@/lib/server/template-sort-order";
import type { ScopePublic } from "@/types/scope";
import { normalizeScopeToolFields } from "@/lib/scope-tools";
import { normalizeScopeAnswers, normalizeScopeMetrics, normalizeSystemScopeFields, scopeWriteSchema } from "./scope-validation";

export const runtime = "nodejs";

function publicFromData(
  id: string,
  data: DocumentData,
  docIdByAreaid: Map<number, string>,
  nameByAreaid: Map<number, string>,
  areasOrdered: ScopeAreaContext["areasOrdered"],
): ScopePublic {
  return scopeDocToPublic(id, data, docIdByAreaid, nameByAreaid, areasOrdered);
}

function templateAreaIdsSet(ctx: Awaited<ReturnType<typeof loadScopeAreaContext>>): Set<string> {
  return new Set(ctx.areasOrdered.map((a) => a.id));
}

export async function GET() {
  try {
    const db = getAdminFirestore();
    const ctx = await loadScopeAreaContext(db);
    await migrateAllLegacyScopeDocs(db, ctx.docIdByAreaid);
    const snap = await db.collection("scopes").get();
    const filtered = snap.docs.filter((d) => !isScopesMetaDocument(d.id));
    const areasForSort = ctx.areasOrdered.map((a) => ({
      id: a.id,
      areaname: a.areaname,
      sortOrder: a.sortOrder,
      areaid: a.areaid,
      areadescription: "",
      default: false,
    }));
    const scopes: ScopePublic[] = filtered
      .map((d) => publicFromData(d.id, d.data(), ctx.docIdByAreaid, ctx.nameByAreaid, ctx.areasOrdered))
      .sort((a, b) => compareScopesForGlobalList(a, b, areasForSort));
    return NextResponse.json({ scopes });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list scopes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = scopeWriteSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const db = getAdminFirestore();
    const ctx = await loadScopeAreaContext(db);
    await migrateAllLegacyScopeDocs(db, ctx.docIdByAreaid);
    const allowed = templateAreaIdsSet(ctx);

    const kind = parsed.data.kind ?? "question";
    let areaDocIds: string[] = [];
    if (kind === "header" || kind === "footer") {
      const ad = parsed.data.areaDocId!.trim();
      if (!allowed.has(ad)) {
        return NextResponse.json({ error: "Invalid area" }, { status: 400 });
      }
      areaDocIds = [ad];
    } else if (parsed.data.tagAllAreas === true) {
      areaDocIds = ctx.areasOrdered.map((a) => a.id);
    } else if ((parsed.data.areaDocIds?.length ?? 0) > 0) {
      areaDocIds = dedupeAreaDocIds(parsed.data.areaDocIds!);
    } else if (parsed.data.areaDocId) {
      areaDocIds = [parsed.data.areaDocId.trim()];
    }
    for (const ad of areaDocIds) {
      if (!allowed.has(ad)) {
        return NextResponse.json({ error: `Invalid area: ${ad}` }, { status: 400 });
      }
    }
    if (areaDocIds.length === 0) {
      return NextResponse.json({ error: "No template areas selected" }, { status: 400 });
    }

    areaDocIds = orderScopeAreaDocIdsByTemplate(ctx.areasOrdered, areaDocIds);
    const primaryAreaid = await ensureAreaNumericId(db, areaDocIds[0]);
    const insertAfterId = parsed.data.insertAfterScopeDocId;

    async function validateInsertAfterSameArea(insertAfterDocId: string, contextAreaDocId: string) {
      const afterRef = db.collection("scopes").doc(insertAfterDocId);
      const afterSnap = await afterRef.get();
      if (!afterSnap.exists) {
        throw new Error("insertAfter scope not found");
      }
      const ids = afterSnap.data()!.areaDocIds;
      if (!Array.isArray(ids) || !ids.includes(contextAreaDocId)) {
        throw new Error("insertAfter scope must belong to the selected area");
      }
    }
    if (insertAfterId && areaDocIds.length === 1) {
      await validateInsertAfterSameArea(insertAfterId, areaDocIds[0]);
    }

    const ref = db.collection("scopes").doc();
    if (kind === "header") {
      const scopeid = await allocateNextSequence(db, "scopeid");
      const pairFooter = parsed.data.pairFooter !== false;
      await ref.set({
        scopeid,
        areaid: primaryAreaid,
        areaDocIds,
        sortOrderByAreaDocId: {},
        kind: "header",
        question: parsed.data.question,
        answers: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      const idsToPlace: string[] = [ref.id];
      if (pairFooter) {
        const footerRef = db.collection("scopes").doc();
        const footerScopeid = await allocateNextSequence(db, "scopeid");
        const fq = (parsed.data.footerQuestion ?? "Footer").trim() || "Footer";
        await footerRef.set({
          scopeid: footerScopeid,
          areaid: primaryAreaid,
          areaDocIds,
          sortOrderByAreaDocId: {},
          kind: "footer",
          question: fq,
          answers: [],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        idsToPlace.push(footerRef.id);
      }
      const aid = await ensureAreaNumericId(db, areaDocIds[0]);
      await insertScopesAfterDoc(
        db,
        areaDocIds[0],
        aid,
        ctx.docIdByAreaid,
        insertAfterId ?? null,
        idsToPlace,
      );
    } else if (kind === "footer") {
      const scopeid = await allocateNextSequence(db, "scopeid");
      await ref.set({
        scopeid,
        areaid: primaryAreaid,
        areaDocIds,
        sortOrderByAreaDocId: {},
        kind: "footer",
        question: parsed.data.question,
        answers: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      const aid = await ensureAreaNumericId(db, areaDocIds[0]);
      await insertScopesAfterDoc(
        db,
        areaDocIds[0],
        aid,
        ctx.docIdByAreaid,
        insertAfterId ?? null,
        [ref.id],
      );
    } else {
      const scopeid = await allocateNextSequence(db, "scopeid");
      const answers = normalizeScopeAnswers(parsed.data.answers!);
      const answerIdSet = new Set(answers.map((a) => a.answerid));
      const scopeMetrics = normalizeScopeMetrics(parsed.data.scopeMetrics, answerIdSet);
      const { systemScope, systemScopeType } = normalizeSystemScopeFields(parsed.data);
      const { exposeTool, scopeToolType } = normalizeScopeToolFields(parsed.data);
      await ref.set({
        scopeid,
        areaid: primaryAreaid,
        areaDocIds,
        sortOrderByAreaDocId: {},
        kind: "question",
        question: parsed.data.question,
        answers,
        ...(scopeMetrics.length > 0 ? { scopeMetrics } : {}),
        systemScope,
        systemScopeType,
        exposeTool,
        scopeToolType,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (areaDocIds.length === 1 && insertAfterId) {
        const aid = await ensureAreaNumericId(db, areaDocIds[0]);
        await insertScopesAfterDoc(
          db,
          areaDocIds[0],
          aid,
          ctx.docIdByAreaid,
          insertAfterId,
          [ref.id],
        );
      } else {
        for (const ad of areaDocIds) {
          const aid = await ensureAreaNumericId(db, ad);
          await renumberScopesForAreaDocId(db, ad, aid, ctx.docIdByAreaid);
        }
      }
    }
    const next = await ref.get();
    const ctx2 = await loadScopeAreaContext(db);
    return NextResponse.json({
      scope: publicFromData(ref.id, next.data()!, ctx2.docIdByAreaid, ctx2.nameByAreaid, ctx2.areasOrdered),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create scope";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
