import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isProjectAreasMetaDocument } from "@/lib/firestore/projectareas-collection";
import { purgeScopeQuestionFromProjectArea } from "@/lib/server/project-area-scope-answers";
import { projectAreaDocToPublic } from "@/lib/server/project-area-to-public";

export const runtime = "nodejs";

const bodySchema = z.object({
  scopeDocId: z.string().min(1),
});

type RouteContext = { params: Promise<{ id: string }> };

/** Clear redundant scope question data from a project area (answers, lines, metrics). */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isProjectAreasMetaDocument(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const db = getAdminFirestore();
    const result = await purgeScopeQuestionFromProjectArea(db, id, parsed.data.scopeDocId);
    const paSnap = await db.collection("projectareas").doc(id).get();
    if (!paSnap.exists) {
      return NextResponse.json({ error: "Project area not found" }, { status: 404 });
    }
    return NextResponse.json({
      linesRemoved: result.linesRemoved,
      scopeAnswers: result.scopeAnswers,
      projectArea: projectAreaDocToPublic(id, paSnap.data()!),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to purge scope question";
    const status =
      message.includes("not found") || message.includes("Invalid") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
