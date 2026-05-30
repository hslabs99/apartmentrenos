import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isProjectAreasMetaDocument } from "@/lib/firestore/projectareas-collection";
import { repriceProjectAreaLinesForEffectiveTier } from "@/lib/server/reprice-project-area-lines";
import { projectAreaDocToPublic } from "@/lib/server/project-area-to-public";

export const runtime = "nodejs";

const numberOrNull = z.union([z.number(), z.null()]);

const updateSchema = z.object({
  displayName: z.union([z.string(), z.null()]).optional(),
  areanotes1: z.string().optional(),
  areanotes2: z.string().optional(),
  aream2: z.union([z.number(), z.null()]).optional(),
  areafinish: z.string().optional(),
  pricelevelid: numberOrNull.optional(),
  style: z.union([z.string(), z.null()]).optional(),
  colour: z.union([z.string(), z.null()]).optional(),
  /** Replace the full list of manually attached scope doc ids (question scopes only in UI). */
  extraScopeDocIds: z.array(z.string().min(1)).optional(),
});

function numOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isProjectAreasMetaDocument(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = getAdminFirestore();
    const ref = db.collection("projectareas").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ projectArea: projectAreaDocToPublic(id, snap.data()!) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load project area";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isProjectAreasMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot modify collection metadata" }, { status: 403 });
    }
    const raw = await req.json();
    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const db = getAdminFirestore();
    const ref = db.collection("projectareas").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const prevData = snap.data() as DocumentData;
    const prevPlRaw = numOrNull(prevData.pricelevelid);
    const prevPl = prevPlRaw ?? null;

    const d = parsed.data;
    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    let priceLevelChanged = false;
    if (d.pricelevelid !== undefined) {
      update.pricelevelid = d.pricelevelid;
      if (d.pricelevelid === null) {
        update.areafinish = "";
      } else {
        const plSnap = await db
          .collection("price_levels")
          .where("pricelevelid", "==", d.pricelevelid)
          .limit(1)
          .get();
        update.areafinish = String(plSnap.docs[0]?.data()?.pricelevel ?? "");
      }
      const nextPl = d.pricelevelid ?? null;
      priceLevelChanged = prevPl !== nextPl;
    }

    if (d.displayName !== undefined) {
      const t = d.displayName === null ? "" : String(d.displayName).trim();
      if (t) update.displayName = t;
      else update.displayName = FieldValue.delete();
    }
    if (d.areanotes1 !== undefined) update.areanotes1 = d.areanotes1;
    if (d.areanotes2 !== undefined) update.areanotes2 = d.areanotes2;
    if (d.aream2 !== undefined) update.aream2 = d.aream2;
    if (d.areafinish !== undefined && d.pricelevelid === undefined) {
      update.areafinish = d.areafinish;
    }
    if (d.style !== undefined) {
      const t = d.style === null ? "" : String(d.style).trim();
      if (t) update.style = t;
      else update.style = FieldValue.delete();
    }
    if (d.colour !== undefined) {
      const t = d.colour === null ? "" : String(d.colour).trim();
      if (t) update.colour = t;
      else update.colour = FieldValue.delete();
    }
    if (d.extraScopeDocIds !== undefined) {
      if (d.extraScopeDocIds.length === 0) {
        update.extraScopeDocIds = FieldValue.delete();
      } else {
        update.extraScopeDocIds = d.extraScopeDocIds;
      }
    }

    await ref.update(update);
    if (priceLevelChanged) {
      await repriceProjectAreaLinesForEffectiveTier(db, id);
    }
    const next = await ref.get();
    return NextResponse.json({ projectArea: projectAreaDocToPublic(id, next.data()!) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update project area";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isProjectAreasMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot delete collection metadata" }, { status: 403 });
    }
    const db = getAdminFirestore();
    const ref = db.collection("projectareas").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const data = snap.data() as DocumentData;
    const projectid = Number(data.projectid ?? NaN);
    if (Number.isInteger(projectid)) {
      const linked = await db
        .collection("projectareaobjects")
        .where("projectid", "==", projectid)
        .where("projectAreaDocId", "==", id)
        .get();
      if (!linked.empty) {
        const batch = db.batch();
        linked.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete project area";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
