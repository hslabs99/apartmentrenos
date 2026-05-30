import { FieldValue, type DocumentData, Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isProjectAreaAnswersMetaDocument } from "@/lib/firestore/projectareaanswers-collection";
import type { ProjectAreaAnswerPublic, TradeSnapshot } from "@/types/project-area-answer";

export const runtime = "nodejs";

const updateSchema = z.object({
  answer: z.string().optional(),
});

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

function readTradeSnapshots(v: unknown): TradeSnapshot[] {
  if (!Array.isArray(v)) return [];
  const out: TradeSnapshot[] = [];
  for (const item of v) {
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const lookupid =
        typeof obj.lookupid === "number" && Number.isInteger(obj.lookupid) ? obj.lookupid : null;
      const lookupvalue = typeof obj.lookupvalue === "string" ? obj.lookupvalue : null;
      if (lookupid != null && lookupvalue != null) out.push({ lookupid, lookupvalue });
    }
  }
  return out;
}

function docToPublic(id: string, data: DocumentData): ProjectAreaAnswerPublic {
  const projectAreaDocId =
    typeof data.projectAreaDocId === "string" && data.projectAreaDocId.trim()
      ? data.projectAreaDocId.trim()
      : "";
  const so = data.sortOrder;
  return {
    id,
    projectid: Number(data.projectid ?? 0),
    projectAreaDocId,
    areaid: Number(data.areaid ?? 0),
    areaQuestionId: Number(data.areaQuestionId ?? 0),
    questionTextSnapshot: String(data.questionTextSnapshot ?? ""),
    applicableTradesSnapshot: readTradeSnapshots(data.applicableTradesSnapshot),
    answer: String(data.answer ?? ""),
    sortOrder: typeof so === "number" && Number.isFinite(so) ? so : null,
    active: typeof data.active === "boolean" ? data.active : null,
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isProjectAreaAnswersMetaDocument(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = getAdminFirestore();
    const ref = db.collection("projectareaanswers").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ projectAreaAnswer: docToPublic(id, snap.data()!) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load project area answer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isProjectAreaAnswersMetaDocument(id)) {
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
    const ref = db.collection("projectareaanswers").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v !== undefined) update[k] = v;
    }
    await ref.update(update);
    const next = await ref.get();
    return NextResponse.json({ projectAreaAnswer: docToPublic(id, next.data()!) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update project area answer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

