import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isProjectsMetaDocument } from "@/lib/firestore/projects-collection";
import { ensurePaintingSiteFeeLine } from "@/lib/server/ensure-painting-site-fee-line";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** Create the General-area painting site fee line when this project has paint. */
export async function POST(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id || isProjectsMetaDocument(id)) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const db = getAdminFirestore();
    const result = await ensurePaintingSiteFeeLine(db, id);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add painting site fee";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
