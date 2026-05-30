import { SetupPanel } from "@/components/setup-panel";
import { Suspense } from "react";

export default function SetupPage() {
  return (
    <Suspense fallback={<p className="p-4 text-sf-text-secondary dark:text-zinc-400">Loading…</p>}>
      <SetupPanel />
    </Suspense>
  );
}
