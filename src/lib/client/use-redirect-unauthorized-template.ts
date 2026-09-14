"use client";

import { isProjectArchivedFlag } from "@/lib/project-archived";
import { isProjectTemplateFlag } from "@/lib/project-template";
import { useViewMode } from "@/lib/view-mode";
import type { ProjectPublic } from "@/types/project";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Sales users cannot open templates; archived jobs cannot be opened until restored. */
export function useRedirectUnauthorizedTemplate(
  project: ProjectPublic | null,
  loaded: boolean,
) {
  const { canManageProjectTemplates } = useViewMode();
  const router = useRouter();

  useEffect(() => {
    if (!loaded || !project) return;
    if (isProjectArchivedFlag(project.archived)) {
      router.replace("/archives");
      return;
    }
    if (isProjectTemplateFlag(project.template) && !canManageProjectTemplates) {
      router.replace("/projects");
    }
  }, [loaded, project, canManageProjectTemplates, router]);
}
