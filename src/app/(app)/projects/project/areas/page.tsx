"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

/**
 * Legacy “Project areas” tab — archived May 2026.
 * Redirects to Workbench (or Projects list if no project id).
 * UI source: src/components/archived/project-areas-panel.tsx
 */
function ProjectAreasRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      router.replace(`/projects/project/workbench?id=${encodeURIComponent(id)}`);
    } else {
      router.replace("/projects");
    }
  }, [router, searchParams]);

  return (
    <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
      Project areas moved to Workbench. Redirecting…
    </p>
  );
}

export default function ProjectAreasPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-sf-text-secondary dark:text-zinc-400">Loading…</p>
      }
    >
      <ProjectAreasRedirectInner />
    </Suspense>
  );
}
