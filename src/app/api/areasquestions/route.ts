import { FieldValue, type DocumentData, Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { allocateNextSequence } from "@/lib/firestore/sequences";
import { isAreasQuestionsMetaDocument } from "@/lib/firestore/areasquestions-collection";
import type { AreaQuestionPublic } from "@/types/area-question";

export const runtime = "nodejs";

const createSchema = z.object({
  areaId: z.number().int(),
  questionText: z.string().min(1).max(2000),
  defaultAnswer: z.string().optional().nullable(),
  applicableTradeLookupIds: z.array(z.number().int()).optional().default([]),
  sortOrder: z.union([z.number(), z.null()]).optional(),
  active: z.boolean().optional().default(true),
});

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

function numOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
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

export async function GET(req: NextRequest) {
  try {
    const db = getAdminFirestore();
    const areaIdParam = req.nextUrl.searchParams.get("areaId");
    if (!areaIdParam) {
      return NextResponse.json({ error: "areaId is required" }, { status: 400 });
    }
    const areaId = Number(areaIdParam);
    if (!Number.isInteger(areaId)) {
      return NextResponse.json({ error: "areaId must be an integer" }, { status: 400 });
    }

    const snap = await db.collection("areasquestions").where("areaId", "==", areaId).get();
    const rows: AreaQuestionPublic[] = snap.docs
      .filter((d) => !isAreasQuestionsMetaDocument(d.id))
      .map((d) => docToPublic(d.id, d.data()))
      .sort((a, b) => {
        const aso = a.sortOrder ?? Number.POSITIVE_INFINITY;
        const bso = b.sortOrder ?? Number.POSITIVE_INFINITY;
        if (aso !== bso) return aso - bso;
        return (a.questionText || "").localeCompare(b.questionText || "", undefined, {
          sensitivity: "base",
        });
      });

    return NextResponse.json({ areaQuestions: rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list area questions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const db = getAdminFirestore();
    const questionId = await allocateNextSequence(db, "questionId");

    const ref = await db.collection("areasquestions").add({
      questionId,
      areaId: parsed.data.areaId,
      questionText: parsed.data.questionText,
      defaultAnswer: parsed.data.defaultAnswer ?? "",
      applicableTradeLookupIds: parsed.data.applicableTradeLookupIds,
      sortOrder: parsed.data.sortOrder ?? null,
      active: parsed.data.active,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id, questionId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create area question";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

