import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  LOOKUPS_COLOURS_COLLECTION,
  isLookupsColoursMetaDocument,
} from "@/lib/firestore/lookups-colours-collection";
import {
  canonicalLookupColourFields,
  lookupColourDocToPublic,
  lookupColourKeyFromFields,
} from "@/lib/server/lookup-colour-doc";

export const runtime = "nodejs";

const updateSchema = z.object({
  category: z.string().optional(),
  colourClass: z.string().min(1).max(255).optional(),
  descriptor: z.string().min(1).max(255).optional(),
  notes: z.string().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isLookupsColoursMetaDocument(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = getAdminFirestore();
    const snap = await db.collection(LOOKUPS_COLOURS_COLLECTION).doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      item: lookupColourDocToPublic(id, snap.data()!),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load colour lookup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isLookupsColoursMetaDocument(id)) {
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
    const ref = db.collection(LOOKUPS_COLOURS_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const existing = snap.data()!;
    const merged = canonicalLookupColourFields({
      category:
        parsed.data.category !== undefined
          ? parsed.data.category
          : String(existing.category ?? ""),
      colourClass:
        parsed.data.colourClass !== undefined
          ? parsed.data.colourClass
          : String(existing.colourClass ?? ""),
      descriptor:
        parsed.data.descriptor !== undefined
          ? parsed.data.descriptor
          : String(existing.descriptor ?? ""),
    });
    const update: Record<string, unknown> = {
      category: merged.category,
      colourClass: merged.colourClass,
      descriptor: merged.descriptor,
      colourKey: lookupColourKeyFromFields(merged),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;
    await ref.update(update);
    const next = await ref.get();
    return NextResponse.json({ item: lookupColourDocToPublic(id, next.data()!) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update colour lookup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isLookupsColoursMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot delete collection metadata" }, { status: 403 });
    }
    const db = getAdminFirestore();
    const ref = db.collection(LOOKUPS_COLOURS_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete colour lookup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
