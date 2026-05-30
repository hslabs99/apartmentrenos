import { ProjectEditorPanel } from "@/components/project-editor-panel";
import { Suspense } from "react";

export default function ProjectEditorPage() {
  return (
    <Suspense fallback={<p className="text-sf-text-secondary dark:text-zinc-400">Loading…</p>}>
      <ProjectEditorPanel />
    </Suspense>
  );
}
