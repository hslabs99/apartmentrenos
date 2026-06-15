import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isProjectAreasMetaDocument } from "@/lib/firestore/projectareas-collection";
import { cloneProjectAreaScope } from "@/lib/server/clone-project-area-scope";
import { projectAreaDocToPublic } from "@/lib/server/project-area-to-public";

export const runtime = "nodejs";

const bodySchema = z.object({
  scopeDocId: z.string().min(1),
  scopeInstanceId: z.string().uuid().optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

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
    const result = await cloneProjectAreaScope(
      db,
      id,
      parsed.data.scopeDocId,
      parsed.data.scopeInstanceId ?? null,
    );
    const paSnap = await db.collection("projectareas").doc(id).get();
    if (!paSnap.exists) {
      return NextResponse.json({ error: "Project area not found" }, { status: 404 });
    }
    return NextResponse.json({
      ...result,
      projectArea: projectAreaDocToPublic(id, paSnap.data()!),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to clone scope";
    const status =
      message.includes("not found") || message.includes("Nothing to clone") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
