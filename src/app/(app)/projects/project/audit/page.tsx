import { ProjectAuditPanel } from "@/components/project-audit-panel";
import { Suspense } from "react";

export default function ProjectAuditPage() {
  return (
    <Suspense fallback={<p className="text-sf-text-secondary dark:text-zinc-400">Loading…</p>}>
      <ProjectAuditPanel />
    </Suspense>
  );
}
