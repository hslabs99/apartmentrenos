import type { NextRequest } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  parsePrepareDataObjectsOptions,
  runPrepareDataObjects,
  type PrepareDataObjectsProgress,
} from "@/lib/server/prepare-data-objects";

export const runtime = "nodejs";
export const maxDuration = 300;

function ndjsonLine(event: PrepareDataObjectsProgress): Uint8Array {
  const json = JSON.stringify(event);
  // Pad so each event crosses proxy/browser buffer thresholds and the UI updates immediately.
  const padded = json.length < 2048 ? json + " ".repeat(2048 - json.length) : json;
  return new TextEncoder().encode(`${padded}\n`);
}

/**
 * POST — merge data_objects and create/update quote_objects.
 * Streams NDJSON progress events (same pattern as SKU import).
 */
export async function POST(req: NextRequest) {
  let options = {};
  try {
    const body = await req.json();
    options = parsePrepareDataObjectsOptions(body);
  } catch {
    /* empty body */
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (event: PrepareDataObjectsProgress) => {
        controller.enqueue(ndjsonLine(event));
      };

      try {
        const db = getAdminFirestore();
        await runPrepareDataObjects(db, options, push);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        push({
          phase: "error",
          message,
          percent: 0,
          error: message,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
