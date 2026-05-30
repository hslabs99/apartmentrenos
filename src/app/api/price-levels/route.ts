import { FieldValue, type DocumentData, Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isPriceLevelsMetaDocument } from "@/lib/firestore/price-levels-collection";
import { allocateNextSequence } from "@/lib/firestore/sequences";
import { sortPriceLevelsPublic } from "@/lib/sort-price-levels";
import type { PriceLevelPublic } from "@/types/price-level";

export const runtime = "nodejs";

const createSchema = z.object({
  pricelevel: z.string().min(1).max(100),
  description: z.string().max(200).optional().default(""),
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

export async function GET() {
  try {
    const db = getAdminFirestore();
    const snap = await db.collection("price_levels").get();
    const filtered = snap.docs.filter((d) => !isPriceLevelsMetaDocument(d.id));
    const priceLevels: PriceLevelPublic[] = sortPriceLevelsPublic(
      filtered.map((d) => docToPublic(d.id, d.data())),
    );
    return NextResponse.json({ priceLevels });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list price levels";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const db = getAdminFirestore();
    const pricelevelid = await allocateNextSequence(db, "pricelevelid");
    const snap = await db.collection("price_levels").get();
    const filtered = snap.docs.filter((d) => !isPriceLevelsMetaDocument(d.id));
    const existing = sortPriceLevelsPublic(
      filtered.map((d) => docToPublic(d.id, d.data())),
    );
    const sortOrder = existing.length;
    const ref = db.collection("price_levels").doc();
    await ref.set({
      pricelevelid,
      sortOrder,
      pricelevel: parsed.data.pricelevel,
      description: parsed.data.description,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id, pricelevelid });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create price level";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
