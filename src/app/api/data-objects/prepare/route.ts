import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  parsePrepareDataObjectsOptions,
  runPrepareDataObjects,
} from "@/lib/server/prepare-data-objects";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    let options = {};
    try {
      const body = await req.json();
      options = parsePrepareDataObjectsOptions(body);
    } catch {
      /* empty body */
    }
    const db = getAdminFirestore();
    const result = await runPrepareDataObjects(db, options);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to prepare data objects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
