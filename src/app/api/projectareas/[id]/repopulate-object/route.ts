import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isProjectAreasMetaDocument } from "@/lib/firestore/projectareas-collection";
import { repopulateScopeObjectOnProjectArea } from "@/lib/server/project-area-scope-answers";

export const runtime = "nodejs";

const bodySchema = z.object({
  scopeDocId: z.string().min(1),
  objectid: z.number().int().positive(),
  scopeInstanceId: z.string().uuid().optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Merge current catalog SKUs into one quote object on a scope instance.
 * Keeps healthy SKU lines and their quantities; replaces orphan SKUs at object defaults.
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
    const result = await repopulateScopeObjectOnProjectArea(
      db,
      id,
      parsed.data.scopeDocId,
      parsed.data.objectid,
      parsed.data.scopeInstanceId ?? null,
    );
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to repopulate object";
    const status =
      message.includes("not found") ||
      message.includes("Invalid") ||
      message.includes("does not belong") ||
      message.includes("no orphan") ||
      message.includes("not on the current") ||
      message.includes("No scope answer") ||
      message.includes("Unknown scope") ||
      message.includes("Section markers")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
