import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isAreasMetaDocument } from "@/lib/firestore/areas-collection";
import {
  reorderCollectionByOrderedIds,
  reorderNeighborAndRenumber,
} from "@/lib/server/template-sort-order";

export const runtime = "nodejs";

const neighborSchema = z.object({
  id: z.string().min(1),
  direction: z.enum(["up", "down"]),
});

const orderedSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

const bodySchema = z.union([neighborSchema, orderedSchema]);

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
    const secondaryLabel = (data: { areaname?: unknown }) => String(data.areaname ?? "");
    const result =
      "orderedIds" in parsed.data
        ? await reorderCollectionByOrderedIds(
            db,
            "areas",
            isAreasMetaDocument,
            parsed.data.orderedIds,
            secondaryLabel,
          )
        : isAreasMetaDocument(parsed.data.id)
          ? { ok: false as const, error: "Invalid id", status: 400 }
          : await reorderNeighborAndRenumber(
              db,
              "areas",
              isAreasMetaDocument,
              parsed.data.id,
              parsed.data.direction,
              secondaryLabel,
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
