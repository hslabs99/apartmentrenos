import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  IMPORTLOG_COLLECTION,
  isImportlogMetaDocument,
} from "@/lib/firestore/importlog-collection";
import { importLogDocToPublic } from "@/lib/server/save-import-log";

export const runtime = "nodejs";

/**
 * GET — latest data_skus import logs from Firestore `importlog`.
 * Query: ?limit=10&importRunId=uuid (optional single log)
 */
export async function GET(req: NextRequest) {
  try {
    const db = getAdminFirestore();
    const importRunId = req.nextUrl.searchParams.get("importRunId")?.trim();

    if (importRunId) {
      const snap = await db.collection(IMPORTLOG_COLLECTION).doc(importRunId).get();
      if (!snap.exists || isImportlogMetaDocument(snap.id)) {
        return NextResponse.json({ log: null });
      }
      return NextResponse.json({
        log: importLogDocToPublic(snap.id, snap.data() ?? {}),
      });
    }

    const limitRaw = req.nextUrl.searchParams.get("limit");
    const limit = Math.min(Math.max(Number(limitRaw) || 5, 1), 20);

    const snap = await db.collection(IMPORTLOG_COLLECTION).get();

    const logs = snap.docs
      .filter((d) => !isImportlogMetaDocument(d.id))
      .map((d) => importLogDocToPublic(d.id, d.data()))
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      .slice(0, limit);

    return NextResponse.json({ logs });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load import logs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
