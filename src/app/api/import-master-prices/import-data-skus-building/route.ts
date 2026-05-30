import type { NextRequest } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  runDataSkusImport,
  type ImportDataSkusProgress,
} from "@/lib/server/import-data-skus";
import { readDataSkusImportOptions } from "@/lib/server/parse-data-skus-import-request";

export const runtime = "nodejs";
export const maxDuration = 300;

function ndjsonLine(event: ImportDataSkusProgress): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

/**
 * POST — upsert products from `Products_Building` tab (same layout as Products_SKU_ALL).
 * Does not mark the full catalog not-current; only rows on this sheet are updated.
 */
export async function POST(req: NextRequest) {
  const options = await readDataSkusImportOptions(req);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (event: ImportDataSkusProgress) => {
        controller.enqueue(ndjsonLine(event));
      };

      try {
        const db = getAdminFirestore();
        await runDataSkusImport(db, push, "building", options);
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
    },
  });
}
