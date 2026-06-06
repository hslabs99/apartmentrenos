import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isLookupsMetaDocument } from "@/lib/firestore/lookups-collection";
import { allocateNextSequence } from "@/lib/firestore/sequences";
import { lookupDocToPublic } from "@/lib/server/lookup-doc";
import { lookupTypeCreateSchema } from "@/lib/lookup-types";
import { orphanedObjectCategoryLookupIds } from "@/lib/server/orphaned-object-category-lookups";
import { collectQuoteObjectCategoryNorms } from "@/lib/server/quote-object-categories";
import type { LookupPublic } from "@/types/lookup";

export const runtime = "nodejs";

const createSchema = z.object({
  lookuptype: lookupTypeCreateSchema,
  lookupvalue: z.string().min(1).max(255),
  notes: z.string().optional().default(""),
});

export async function GET() {
  try {
    const db = getAdminFirestore();
    const snap = await db.collection("lookups").get();
    const lookups: LookupPublic[] = snap.docs
      .filter((d) => !isLookupsMetaDocument(d.id))
      .map((d) => lookupDocToPublic(d.id, d.data()))
      .sort((a, b) => {
        const t = a.lookuptype.localeCompare(b.lookuptype, undefined, {
          sensitivity: "base",
        });
        if (t !== 0) return t;
        return a.lookupvalue.localeCompare(b.lookupvalue, undefined, {
          sensitivity: "base",
        });
      });
    const objectCategoryNorms = await collectQuoteObjectCategoryNorms(db);
    const orphanedObjectCategoryLookupIdsList = orphanedObjectCategoryLookupIds(
      lookups,
      objectCategoryNorms,
    );
    return NextResponse.json({
      lookups,
      objectCategoryInUse: [...objectCategoryNorms].sort(),
      orphanedObjectCategoryLookupIds: orphanedObjectCategoryLookupIdsList,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list lookups";
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
    const lookupid = await allocateNextSequence(db, "lookupid");
    const ref = await db.collection("lookups").add({
      lookupid,
      lookuptype: parsed.data.lookuptype,
      lookupvalue: parsed.data.lookupvalue,
      notes: parsed.data.notes,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id, lookupid });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create lookup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
