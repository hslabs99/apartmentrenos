import { FieldValue, type DocumentData, Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isAreasMetaDocument } from "@/lib/firestore/areas-collection";
import type { AreaPublic } from "@/types/area";

export const runtime = "nodejs";

const updateSchema = z.object({
  areaname: z.string().min(1).max(255).optional(),
  areadescription: z.string().optional(),
  areameters: z.union([z.number(), z.null()]).optional(),
  default: z.boolean().optional(),
});

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

function numOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

function docToPublic(id: string, data: DocumentData): AreaPublic {
  const so = data.sortOrder;
  return {
    id,
    sortOrder: typeof so === "number" && Number.isFinite(so) ? so : null,
    areaid: numOrNull(data.areaid),
    areaname: String(data.areaname ?? ""),
    areadescription: String(data.areadescription ?? ""),
    areameters: numOrNull(data.areameters),
    default: Boolean(data.default),
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isAreasMetaDocument(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = getAdminFirestore();
    const ref = db.collection("areas").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ area: docToPublic(id, snap.data()!) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load area";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isAreasMetaDocument(id)) {
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
    const ref = db.collection("areas").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v !== undefined) update[k] = v;
    }
    await ref.update(update);
    const next = await ref.get();
    return NextResponse.json({ area: docToPublic(id, next.data()!) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update area";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isAreasMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot delete collection metadata" }, { status: 403 });
    }
    const db = getAdminFirestore();
    const ref = db.collection("areas").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const areaData = snap.data() as DocumentData;
    const areaid = numOrNull(areaData.areaid);
    if (areaid != null) {
      const linked = await db
        .collection("areaobjects")
        .where("areaid", "==", areaid)
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
    const message = e instanceof Error ? e.message : "Failed to delete area";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
