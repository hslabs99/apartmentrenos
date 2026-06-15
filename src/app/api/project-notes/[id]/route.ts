import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isProjectNotesMetaDocument } from "@/lib/firestore/project-notes-collection";
import { projectNoteDocToPublic } from "@/lib/server/project-note-doc";
import { PROJECT_NOTE_TRADE_TAGS } from "@/lib/project-note-trades";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  notetype: z.string().min(1).max(255),
  trades: z.array(z.enum(PROJECT_NOTE_TRADE_TAGS)).default([]),
  note: z.string().min(1).max(8000),
});

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isProjectNotesMetaDocument(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = getAdminFirestore();
    const snap = await db.collection("project_notes").doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      projectNote: projectNoteDocToPublic(snap.id, snap.data() ?? {}),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load project note";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isProjectNotesMetaDocument(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const raw = await req.json();
    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const db = getAdminFirestore();
    const ref = db.collection("project_notes").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { notetype, trades, note } = parsed.data;
    await ref.update({
      notetype: notetype.trim(),
      trades,
      note: note.trim(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const updated = projectNoteDocToPublic(id, (await ref.get()).data() ?? {});
    return NextResponse.json({ projectNote: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update project note";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isProjectNotesMetaDocument(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = getAdminFirestore();
    const ref = db.collection("project_notes").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await ref.delete();
    return NextResponse.json({ deleted: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete project note";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
