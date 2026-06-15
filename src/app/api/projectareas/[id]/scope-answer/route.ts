import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isProjectAreasMetaDocument } from "@/lib/firestore/projectareas-collection";
import { applyScopeAnswerToProjectArea } from "@/lib/server/project-area-scope-answers";
import { projectAreaDocToPublic } from "@/lib/server/project-area-to-public";

export const runtime = "nodejs";

const bodySchema = z.object({
  scopeDocId: z.string().min(1),
  answerid: z.union([z.string().uuid(), z.null()]),
  scopeInstanceId: z.string().uuid().optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Apply or clear a scope answer: removes prior lines for that scope, then inserts
 * lines for the chosen answer using only the price-level row matching the area’s effective PL.
 */
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
    const result = await applyScopeAnswerToProjectArea(
      db,
      id,
      parsed.data.scopeDocId,
      parsed.data.answerid,
      parsed.data.scopeInstanceId ?? null,
    );
    const paSnap = await db.collection("projectareas").doc(id).get();
    if (!paSnap.exists) {
      return NextResponse.json({ error: "Project area not found" }, { status: 404 });
    }
    return NextResponse.json({
      linesRemoved: result.linesRemoved,
      linesAdded: result.linesAdded,
      scopeAnswers: result.scopeAnswers,
      diagnostics: result.diagnostics,
      projectArea: projectAreaDocToPublic(id, paSnap.data()!),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to apply scope answer";
    const status =
      message.includes("not found") || message.includes("Invalid")
        ? 400
        : message.includes("not belong") || message.includes("Section headers")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
