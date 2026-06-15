import { ProjectNotesPanel } from "@/components/project-notes-panel";
import { Suspense } from "react";

export default function ProjectNotesPage() {
  return (
    <Suspense fallback={<p className="text-sf-text-secondary dark:text-zinc-400">Loading…</p>}>
      <ProjectNotesPanel />
    </Suspense>
  );
}
