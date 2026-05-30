import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isAreasMetaDocument } from "@/lib/firestore/areas-collection";
import { reorderNeighborAndRenumber } from "@/lib/server/template-sort-order";

export const runtime = "nodejs";

const bodySchema = z.object({
  id: z.string().min(1),
  direction: z.enum(["up", "down"]),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const db = getAdminFirestore();
    if (isAreasMetaDocument(parsed.data.id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const result = await reorderNeighborAndRenumber(
      db,
      "areas",
      isAreasMetaDocument,
      parsed.data.id,
      parsed.data.direction,
      (data) => String(data.areaname ?? ""),
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to reorder";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
