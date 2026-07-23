import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isProjectNotesMetaDocument } from "@/lib/firestore/project-notes-collection";
import { allocateNextSequence } from "@/lib/firestore/sequences";
import { projectNoteDocToPublic } from "@/lib/server/project-note-doc";
import { ensureProjectNumericId } from "@/lib/server/resolve-ids";
import { PROJECT_NOTE_TRADE_TAGS } from "@/lib/project-note-trades";
import type { ProjectNotePublic } from "@/types/project-note";
import { uniqueProjectNotes } from "@/lib/project-note-filters";

export const runtime = "nodejs";

const createSchema = z.object({
  projectid: z.number().int().positive(),
  areaid: z.number().int().positive().optional().nullable(),
  objectid: z.number().int().positive().optional().nullable(),
  notetype: z.string().min(1).max(255),
  trades: z.array(z.enum(PROJECT_NOTE_TRADE_TAGS)).default([]),
  author: z.string().min(1).max(255),
  note: z.string().min(1).max(8000),
});

export async function GET(req: NextRequest) {
  try {
    const db = getAdminFirestore();
    const projectDocId = req.nextUrl.searchParams.get("projectDocId");
    const projectidParam = req.nextUrl.searchParams.get("projectid");

    let projectid: number;
    if (projectDocId) {
      projectid = await ensureProjectNumericId(db, projectDocId);
    } else if (projectidParam) {
      projectid = Number(projectidParam);
      if (!Number.isInteger(projectid) || projectid <= 0) {
        return NextResponse.json({ error: "projectid must be a positive integer" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "projectDocId or projectid is required" }, { status: 400 });
    }

    const snap = await db.collection("project_notes").where("projectid", "==", projectid).get();
    const notes: ProjectNotePublic[] = uniqueProjectNotes(
      snap.docs
        .filter((d) => !isProjectNotesMetaDocument(d.id))
        .map((d) => projectNoteDocToPublic(d.id, d.data()))
        .sort((a, b) => {
          const ta = a.notedatetime ?? a.createdAt ?? "";
          const tb = b.notedatetime ?? b.createdAt ?? "";
          return tb.localeCompare(ta);
        }),
    );

    return NextResponse.json({ projectNotes: notes });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list project notes";
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

    const { projectid, areaid, objectid, notetype, trades, author, note } = parsed.data;

    if (objectid != null && areaid == null) {
      return NextResponse.json(
        { error: "areaid is required when objectid is set" },
        { status: 400 },
      );
    }

    const db = getAdminFirestore();
    const noteid = await allocateNextSequence(db, "noteid");
    const now = FieldValue.serverTimestamp();
    const ref = await db.collection("project_notes").add({
      noteid,
      notedatetime: now,
      projectid,
      areaid: areaid ?? null,
      objectid: objectid ?? null,
      notetype: notetype.trim(),
      trades,
      author: author.trim(),
      note: note.trim(),
      createdAt: now,
      updatedAt: now,
    });

    const created = projectNoteDocToPublic(ref.id, (await ref.get()).data() ?? {});
    return NextResponse.json({ projectNote: created });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create project note";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
