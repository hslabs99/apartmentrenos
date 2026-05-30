import { type DocumentData, Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureProjectNumericId } from "@/lib/server/resolve-ids";
import { isProjectAreaAnswersMetaDocument } from "@/lib/firestore/projectareaanswers-collection";
import type { ProjectAreaAnswerPublic, TradeSnapshot } from "@/types/project-area-answer";

export const runtime = "nodejs";

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

function numOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

function readTradeSnapshots(v: unknown): TradeSnapshot[] {
  if (!Array.isArray(v)) return [];
  const out: TradeSnapshot[] = [];
  for (const item of v) {
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const lookupid = typeof obj.lookupid === "number" && Number.isInteger(obj.lookupid) ? obj.lookupid : null;
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

export async function GET(req: NextRequest) {
  try {
    const db = getAdminFirestore();
    const projectDocId = req.nextUrl.searchParams.get("projectDocId");
    const projectidParam = req.nextUrl.searchParams.get("projectid");
    const projectAreaDocId = req.nextUrl.searchParams.get("projectAreaDocId");

    let projectid: number;
    if (projectDocId) {
      projectid = await ensureProjectNumericId(db, projectDocId);
    } else if (projectidParam) {
      projectid = Number(projectidParam);
      if (!Number.isInteger(projectid)) {
        return NextResponse.json({ error: "projectid must be an integer" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "projectDocId or projectid is required" }, { status: 400 });
    }

    let q = db.collection("projectareaanswers").where("projectid", "==", projectid);
    if (projectAreaDocId && projectAreaDocId.trim()) {
      q = q.where("projectAreaDocId", "==", projectAreaDocId.trim());
    }

    const snap = await q.get();
    const rows: ProjectAreaAnswerPublic[] = snap.docs
      .filter((d) => !isProjectAreaAnswersMetaDocument(d.id))
      .map((d) => docToPublic(d.id, d.data()))
      .filter((r) => r.projectAreaDocId)
      .sort((a, b) => {
        const aso = a.sortOrder ?? Number.POSITIVE_INFINITY;
        const bso = b.sortOrder ?? Number.POSITIVE_INFINITY;
        if (aso !== bso) return aso - bso;
        const ta = (a.questionTextSnapshot || "").localeCompare(b.questionTextSnapshot || "", undefined, {
          sensitivity: "base",
        });
        if (ta !== 0) return ta;
        return a.id.localeCompare(b.id);
      });

    return NextResponse.json({ projectAreaAnswers: rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list project area answers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

