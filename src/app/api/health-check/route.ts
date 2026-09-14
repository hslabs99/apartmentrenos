import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { runHealthCheckFast } from "@/lib/server/health-check-scan";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getAdminFirestore();
    const report = await runHealthCheckFast(db);
    return NextResponse.json({ report });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Health check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
