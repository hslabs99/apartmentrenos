"use client";

import { sfTabStripClass, sfUnderlineTabClass } from "@/lib/sf-tabs";
import { useViewMode } from "@/lib/view-mode";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function projectQuerySuffix(searchParams: Pick<URLSearchParams, "get">, keys: string[]) {
  const p = new URLSearchParams();
  for (const k of keys) {
    const v = searchParams.get(k);
    if (v) p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

function ProjectsTabsInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canViewProjectWorkbench } = useViewMode();
  const onProjectChecklist = pathname.startsWith("/projects/project/checklist");
  const onProjectWorkbench = pathname.startsWith("/projects/project/workbench");
  const onProjectEditor =
    pathname.startsWith("/projects/project") &&
    !onProjectChecklist &&
    !onProjectWorkbench;

  const projectHref = `/projects/project${projectQuerySuffix(searchParams, ["id"])}`;
  const checklistHref = `/projects/project/checklist${projectQuerySuffix(searchParams, ["id"])}`;
  const workbenchHref = `/projects/project/workbench${projectQuerySuffix(searchParams, ["id"])}`;

  return (
    <div
      className={sfTabStripClass}
      role="tablist"
      aria-label="Project sections"
    >
      <Link href={projectHref} className={sfUnderlineTabClass(onProjectEditor)} role="tab" aria-selected={onProjectEditor}>
        Project
      </Link>
      <Link href={checklistHref} className={sfUnderlineTabClass(onProjectChecklist)} role="tab" aria-selected={onProjectChecklist}>
        Check List
      </Link>
      {canViewProjectWorkbench ? (
        <Link href={workbenchHref} className={sfUnderlineTabClass(onProjectWorkbench)} role="tab" aria-selected={onProjectWorkbench}>
          Workbench
        </Link>
      ) : null}
    </div>
  );
}

export function ProjectsTabs() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-wrap justify-start gap-2 border-b border-sf-border pb-px dark:border-zinc-700">
          <div className="h-10 min-w-[88px] animate-pulse rounded-t bg-sf-border/60 dark:bg-zinc-700 md:h-11" />
          <div className="h-10 min-w-[100px] animate-pulse rounded-t bg-sf-border/60 dark:bg-zinc-700 md:h-11" />
          <div className="h-10 min-w-[72px] animate-pulse rounded-t bg-sf-border/60 dark:bg-zinc-700 md:h-11" />
          <div className="h-10 min-w-[92px] animate-pulse rounded-t bg-sf-border/60 dark:bg-zinc-700 md:h-11" />
        </div>
      }
    >
      <ProjectsTabsInner />
    </Suspense>
  );
}
