import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isAreaObjectsMetaDocument } from "@/lib/firestore/areaobjects-collection";
import {
  reorderAreaObjectNeighbor,
  reorderAreaObjectsByOrderedIds,
} from "@/lib/server/template-sort-order";

export const runtime = "nodejs";

const neighborSchema = z.object({
  id: z.string().min(1),
  direction: z.enum(["up", "down"]),
});

const orderedSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

const bodySchema = z.union([neighborSchema, orderedSchema]);

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
    if ("orderedIds" in parsed.data) {
      const firstId = parsed.data.orderedIds[0];
      if (isAreaObjectsMetaDocument(firstId)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      }
      const ref = db.collection("areaobjects").doc(firstId);
      const snap = await ref.get();
      if (!snap.exists) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const areaid = Number(snap.data()?.areaid);
      if (!Number.isInteger(areaid)) {
        return NextResponse.json({ error: "Invalid area object" }, { status: 400 });
      }
      const result = await reorderAreaObjectsByOrderedIds(db, areaid, parsed.data.orderedIds);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ ok: true });
    }
    if (isAreaObjectsMetaDocument(parsed.data.id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const ref = db.collection("areaobjects").doc(parsed.data.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const areaid = Number(snap.data()?.areaid);
    if (!Number.isInteger(areaid)) {
      return NextResponse.json({ error: "Invalid area object" }, { status: 400 });
    }
    const result = await reorderAreaObjectNeighbor(db, areaid, parsed.data.id, parsed.data.direction);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to reorder";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
