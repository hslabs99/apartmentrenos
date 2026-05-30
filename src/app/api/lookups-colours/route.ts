import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureLookupsColoursBootstrap } from "@/lib/firestore/collection-bootstrap";
import {
  LOOKUPS_COLOURS_COLLECTION,
  isLookupsColoursMetaDocument,
} from "@/lib/firestore/lookups-colours-collection";
import {
  canonicalLookupColourFields,
  lookupColourDocToPublic,
  lookupColourKeyFromFields,
} from "@/lib/server/lookup-colour-doc";
import { allocateNextSequence } from "@/lib/firestore/sequences";
import type { LookupColourPublic } from "@/types/lookup-colour-public";

export const runtime = "nodejs";

const createSchema = z.object({
  category: z.string().optional().default("Colour"),
  colourClass: z.string().min(1).max(255),
  descriptor: z.string().min(1).max(255),
  notes: z.string().optional().default(""),
});

export async function GET() {
  try {
    const db = getAdminFirestore();
    await ensureLookupsColoursBootstrap(db);
    const snap = await db.collection(LOOKUPS_COLOURS_COLLECTION).get();
    const items: LookupColourPublic[] = snap.docs
      .filter((d) => !isLookupsColoursMetaDocument(d.id))
      .map((d) => lookupColourDocToPublic(d.id, d.data()))
      .sort((a, b) => {
        const c = a.colourClass.localeCompare(b.colourClass, undefined, {
          sensitivity: "base",
        });
        if (c !== 0) return c;
        return a.descriptor.localeCompare(b.descriptor, undefined, {
          sensitivity: "base",
        });
      });
    return NextResponse.json({ items, count: items.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load lookups_colours";
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
    await ensureLookupsColoursBootstrap(db);
    const canon = canonicalLookupColourFields(parsed.data);
    const colourKey = lookupColourKeyFromFields(canon);
    const colourLookupId = await allocateNextSequence(db, "colourlookupid");
    const ref = await db.collection(LOOKUPS_COLOURS_COLLECTION).add({
      colourLookupId,
      category: canon.category,
      colourClass: canon.colourClass,
      descriptor: canon.descriptor,
      notes: parsed.data.notes,
      colourKey,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id, colourLookupId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create colour lookup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
