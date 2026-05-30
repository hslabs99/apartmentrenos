import {
  FieldValue,
  type DocumentData,
  Timestamp,
} from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isAreasMetaDocument } from "@/lib/firestore/areas-collection";
import { allocateNextSequence } from "@/lib/firestore/sequences";
import { compareTemplateDocs, renumberAllAndNextIndex } from "@/lib/server/template-sort-order";
import type { AreaPublic } from "@/types/area";

export const runtime = "nodejs";

const createSchema = z.object({
  areaname: z.string().min(1).max(255),
  areadescription: z.string().optional().default(""),
  areameters: z.union([z.number(), z.null()]).optional(),
  default: z.boolean().optional().default(false),
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

export async function GET() {
  try {
    const db = getAdminFirestore();
    const snap = await db.collection("areas").get();
    const filtered = snap.docs.filter((d) => !isAreasMetaDocument(d.id));
    const sortedDocs = [...filtered].sort((a, b) =>
      compareTemplateDocs(a, b, (data) => String(data.areaname ?? "")),
    );
    const areas: AreaPublic[] = sortedDocs.map((d) => docToPublic(d.id, d.data()));
    return NextResponse.json({ areas });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list areas";
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
    const areaid = await allocateNextSequence(db, "areaid");
    const sortOrder = await renumberAllAndNextIndex(db, "areas", isAreasMetaDocument, (data) =>
      String(data.areaname ?? ""),
    );
    const ref = db.collection("areas").doc();
    await ref.set({
      areaid,
      areaname: parsed.data.areaname,
      areadescription: parsed.data.areadescription,
      areameters: parsed.data.areameters ?? null,
      default: parsed.data.default,
      sortOrder,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id, areaid });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create area";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
