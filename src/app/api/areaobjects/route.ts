import {
  FieldValue,
  type DocumentData,
  Timestamp,
} from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isAreaObjectsMetaDocument } from "@/lib/firestore/areaobjects-collection";
import { isAreasMetaDocument } from "@/lib/firestore/areas-collection";
import { isQuoteObjectsMetaDocument } from "@/lib/firestore/quote-objects-collection";
import {
  ensureAreaNumericId,
  getQuoteObjectNumericIdFromDoc,
} from "@/lib/server/resolve-ids";
import { compareTemplateDocs, renumberAreaObjectsForArea } from "@/lib/server/template-sort-order";
import type {
  AreaObjectCatalogRow,
  AreaObjectPublic,
  QuoteObjectCatalogRow,
} from "@/types/area-object";

export const runtime = "nodejs";

const createSchema = z.object({
  areaDocId: z.string().min(1),
  quoteObjectDocId: z.string().min(1),
  notes3: z.string().optional().default(""),
  notes4: z.string().optional().default(""),
  default: z.boolean().optional().default(false),
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

export async function GET(req: NextRequest) {
  try {
    const db = getAdminFirestore();
    if (req.nextUrl.searchParams.get("catalog") === "1") {
      const [aoSnap, areasSnap, qoSnap] = await Promise.all([
        db.collection("areaobjects").get(),
        db.collection("areas").get(),
        db.collection("quote_objects").get(),
      ]);
      const areaNameById = new Map<number, string>();
      for (const d of areasSnap.docs) {
        if (isAreasMetaDocument(d.id)) continue;
        const data = d.data();
        const aid = Number(data.areaid);
        if (Number.isInteger(aid)) {
          areaNameById.set(aid, String(data.areaname ?? ""));
        }
      }
      const objectNameById = new Map<number, string>();
      for (const d of qoSnap.docs) {
        if (isQuoteObjectsMetaDocument(d.id)) continue;
        const data = d.data();
        const oid = Number(data.objectid);
        if (Number.isInteger(oid)) {
          objectNameById.set(oid, String(data.objectname ?? ""));
        }
      }
      const filtered = aoSnap.docs.filter((d) => !isAreaObjectsMetaDocument(d.id));
      const secondary = (data: DocumentData, docId: string) =>
        `${String(data.objectid ?? "")}\u0000${docId}`;
      const sortedDocs = [...filtered].sort((a, b) => compareTemplateDocs(a, b, secondary));
      const catalog: AreaObjectCatalogRow[] = sortedDocs.map((d) => {
        const data = d.data();
        const areaid = Number(data.areaid ?? 0);
        const objectid = Number(data.objectid ?? 0);
        return {
          id: d.id,
          areaid,
          objectid,
          areaname: areaNameById.get(areaid) ?? `Area #${areaid}`,
          objectname: objectNameById.get(objectid) ?? `Object #${objectid}`,
        };
      });

      const quoteCatalog: QuoteObjectCatalogRow[] = qoSnap.docs
        .filter((d) => !isQuoteObjectsMetaDocument(d.id))
        .map((d) => {
          const data = d.data();
          const objectid = Number(data.objectid ?? 0);
          return {
            id: d.id,
            objectid: Number.isInteger(objectid) ? objectid : 0,
            objectname: String(data.objectname ?? ""),
          };
        })
        .sort((a, b) => {
          const c = a.objectname.localeCompare(b.objectname, undefined, { sensitivity: "base" });
          if (c !== 0) return c;
          return a.id.localeCompare(b.id);
        });

      return NextResponse.json({ catalog, quoteCatalog });
    }

    const areaidParam = req.nextUrl.searchParams.get("areaid");
    if (!areaidParam) {
      return NextResponse.json({ error: "areaid is required" }, { status: 400 });
    }
    const areaid = Number(areaidParam);
    if (!Number.isInteger(areaid)) {
      return NextResponse.json({ error: "areaid must be an integer" }, { status: 400 });
    }

    const snap = await db
      .collection("areaobjects")
      .where("areaid", "==", areaid)
      .get();
    const filtered = snap.docs.filter((d) => !isAreaObjectsMetaDocument(d.id));
    const secondary = (data: DocumentData, docId: string) =>
      `${String(data.objectid ?? "")}\u0000${docId}`;
    const sortedDocs = [...filtered].sort((a, b) => compareTemplateDocs(a, b, secondary));
    const areaObjects: AreaObjectPublic[] = sortedDocs.map((d) => docToPublic(d.id, d.data()));
    return NextResponse.json({ areaObjects });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list area objects";
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
    const areaid = await ensureAreaNumericId(db, parsed.data.areaDocId);
    const objectid = await getQuoteObjectNumericIdFromDoc(db, parsed.data.quoteObjectDocId);

    const sortOrder = await renumberAreaObjectsForArea(db, areaid);
    const ref = db.collection("areaobjects").doc();
    await ref.set({
      areaid,
      objectid,
      notes3: parsed.data.notes3,
      notes4: parsed.data.notes4,
      default: parsed.data.default,
      sortOrder,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create area object";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
