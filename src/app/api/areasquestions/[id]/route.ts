import { FieldValue, type DocumentData, Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isAreasQuestionsMetaDocument } from "@/lib/firestore/areasquestions-collection";
import type { AreaQuestionPublic } from "@/types/area-question";

export const runtime = "nodejs";

const updateSchema = z.object({
  questionText: z.string().min(1).max(2000).optional(),
  defaultAnswer: z.string().optional().nullable(),
  applicableTradeLookupIds: z.array(z.number().int()).optional(),
  sortOrder: z.union([z.number(), z.null()]).optional(),
  active: z.boolean().optional(),
});

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

function docToPublic(id: string, data: DocumentData): AreaQuestionPublic {
  const so = data.sortOrder;
  const tradeIds = Array.isArray(data.applicableTradeLookupIds)
    ? data.applicableTradeLookupIds
        .map((x: unknown) => (typeof x === "number" && Number.isInteger(x) ? x : null))
        .filter((x: number | null): x is number => x != null)
    : [];
  return {
    id,
    questionId: Number(data.questionId ?? 0),
    areaId: Number(data.areaId ?? 0),
    questionText: String(data.questionText ?? ""),
    defaultAnswer: typeof data.defaultAnswer === "string" ? data.defaultAnswer : null,
    applicableTradeLookupIds: tradeIds,
    sortOrder: typeof so === "number" && Number.isFinite(so) ? so : null,
    active: data.active !== false,
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isAreasQuestionsMetaDocument(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = getAdminFirestore();
    const ref = db.collection("areasquestions").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ areaQuestion: docToPublic(id, snap.data()!) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load area question";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isAreasQuestionsMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot modify collection metadata" }, { status: 403 });
    }
    const raw = await req.json();
    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const db = getAdminFirestore();
    const ref = db.collection("areasquestions").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v !== undefined) update[k] = v;
    }
    await ref.update(update);
    const next = await ref.get();
    return NextResponse.json({ areaQuestion: docToPublic(id, next.data()!) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update area question";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isAreasQuestionsMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot delete collection metadata" }, { status: 403 });
    }
    const db = getAdminFirestore();
    const ref = db.collection("areasquestions").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete area question";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

