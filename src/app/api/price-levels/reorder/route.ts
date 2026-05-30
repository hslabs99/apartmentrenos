import { FieldValue, type DocumentData, Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isPriceLevelsMetaDocument } from "@/lib/firestore/price-levels-collection";
import { sortPriceLevelsPublic } from "@/lib/sort-price-levels";
import type { PriceLevelPublic } from "@/types/price-level";

export const runtime = "nodejs";

const bodySchema = z.object({
  id: z.string().min(1),
  direction: z.enum(["up", "down"]),
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

function docToPublic(id: string, data: DocumentData): PriceLevelPublic {
  return {
    id,
    pricelevelid: numOrNull(data.pricelevelid) ?? null,
    sortOrder: numOrNull(data.sortOrder) ?? null,
    pricelevel: String(data.pricelevel ?? ""),
    description: String(data.description ?? ""),
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}

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
    const { id, direction } = parsed.data;
    if (isPriceLevelsMetaDocument(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const snap = await db.collection("price_levels").get();
    const filtered = snap.docs.filter((d) => !isPriceLevelsMetaDocument(d.id));
    const sorted = sortPriceLevelsPublic(filtered.map((d) => docToPublic(d.id, d.data())));
    const idx = sorted.findIndex((r) => r.id === id);
    if (idx < 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const j = direction === "up" ? idx - 1 : idx + 1;
    if (j < 0 || j >= sorted.length) {
      return NextResponse.json({ error: "Cannot move further" }, { status: 400 });
    }
    const nextOrder = [...sorted];
    [nextOrder[idx], nextOrder[j]] = [nextOrder[j], nextOrder[idx]];

    const batch = db.batch();
    nextOrder.forEach((pl, i) => {
      batch.update(db.collection("price_levels").doc(pl.id), {
        sortOrder: i,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to reorder price levels";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
