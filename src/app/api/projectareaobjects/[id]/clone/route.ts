import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureProjectAreaObjectsBootstrap } from "@/lib/firestore/collection-bootstrap";
import { isProjectAreaObjectsMetaDocument } from "@/lib/firestore/projectareaobjects-collection";
import { cloneProjectAreaObject } from "@/lib/server/clone-project-area-object";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isProjectAreaObjectsMetaDocument(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const db = getAdminFirestore();
    await ensureProjectAreaObjectsBootstrap(db);
    const newId = await cloneProjectAreaObject(db, id);
    return NextResponse.json({ id: newId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to clone line";
    const status = message === "Line not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
