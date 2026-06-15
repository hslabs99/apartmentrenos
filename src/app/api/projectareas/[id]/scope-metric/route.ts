import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isProjectAreasMetaDocument } from "@/lib/firestore/projectareas-collection";
import { projectAreaDocToPublic } from "@/lib/server/project-area-to-public";
import {
  loadScopeMetricsFromScopeDoc,
  repriceScopeInstanceLines,
  upsertScopeMetricValue,
  parseScopeMetricValuesFromFirestore,
} from "@/lib/server/scope-metric-values";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

const bodySchema = z.object({
  scopeDocId: z.string().min(1),
  metricid: z.string().uuid(),
  value: z.union([z.number(), z.null()]),
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
    const paRef = db.collection("projectareas").doc(id);
    const paSnap = await paRef.get();
    if (!paSnap.exists) {
      return NextResponse.json({ error: "Project area not found" }, { status: 404 });
    }
    const paData = paSnap.data()!;

    const scopeSnap = await db.collection("scopes").doc(parsed.data.scopeDocId.trim()).get();
    if (!scopeSnap.exists) {
      return NextResponse.json({ error: "Scope not found" }, { status: 404 });
    }
    const scopeMetrics = loadScopeMetricsFromScopeDoc(scopeSnap.data()!);
    const metric = scopeMetrics.find((m) => m.metricid === parsed.data.metricid);
    if (!metric) {
      return NextResponse.json({ error: "Unknown scope metric" }, { status: 400 });
    }

    const current = parseScopeMetricValuesFromFirestore(paData.scopeMetricValues);
    const nextValues = upsertScopeMetricValue(current, {
      scopeDocId: parsed.data.scopeDocId.trim(),
      scopeInstanceId: parsed.data.scopeInstanceId ?? null,
      metricid: parsed.data.metricid,
      value: parsed.data.value,
    });

    await paRef.update({
      scopeMetricValues: nextValues,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await repriceScopeInstanceLines(
      db,
      id,
      parsed.data.scopeDocId,
      parsed.data.scopeInstanceId ?? null,
      scopeMetrics,
      nextValues,
    );

    const updatedSnap = await paRef.get();
    return NextResponse.json({
      projectArea: projectAreaDocToPublic(id, updatedSnap.data()!),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save scope metric";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
