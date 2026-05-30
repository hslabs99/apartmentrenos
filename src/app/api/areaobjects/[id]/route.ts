import { FieldValue, type DocumentData, Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isAreaObjectsMetaDocument } from "@/lib/firestore/areaobjects-collection";
import type { AreaObjectPublic } from "@/types/area-object";

export const runtime = "nodejs";

const updateSchema = z.object({
  notes3: z.string().optional(),
  notes4: z.string().optional(),
  default: z.boolean().optional(),
});

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

function docToPublic(id: string, data: DocumentData): AreaObjectPublic {
  const so = data.sortOrder;
  return {
    id,
    sortOrder: typeof so === "number" && Number.isFinite(so) ? so : null,
    areaid: Number(data.areaid ?? 0),
    objectid: Number(data.objectid ?? 0),
    notes3: String(data.notes3 ?? ""),
    notes4: String(data.notes4 ?? ""),
    default: Boolean(data.default),
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isAreaObjectsMetaDocument(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = getAdminFirestore();
    const ref = db.collection("areaobjects").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ areaObject: docToPublic(id, snap.data()!) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load area object";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isAreaObjectsMetaDocument(id)) {
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
    const ref = db.collection("areaobjects").doc(id);
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
    return NextResponse.json({ areaObject: docToPublic(id, next.data()!) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update area object";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isAreaObjectsMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot delete collection metadata" }, { status: 403 });
    }
    const db = getAdminFirestore();
    const ref = db.collection("areaobjects").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete area object";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
