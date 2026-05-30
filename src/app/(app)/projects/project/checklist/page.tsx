import { ProjectChecklistPanel } from "@/components/project-checklist-panel";
import { Suspense } from "react";

export default function ProjectChecklistPage() {
  return (
    <Suspense fallback={<p className="text-sf-text-secondary dark:text-zinc-400">Loading…</p>}>
      <ProjectChecklistPanel />
    </Suspense>
  );
}
