import { getAdminFirestore } from "@/lib/firebase/admin";
import { runHealthCheckDeep } from "@/lib/server/health-check-scan";
import type { HealthCheckDeepProgress } from "@/types/health-check";

export const runtime = "nodejs";
export const maxDuration = 300;

function ndjsonLine(event: HealthCheckDeepProgress): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export async function POST() {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (event: HealthCheckDeepProgress) => {
        controller.enqueue(ndjsonLine(event));
      };
      try {
        const db = getAdminFirestore();
        await runHealthCheckDeep(db, push);
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
