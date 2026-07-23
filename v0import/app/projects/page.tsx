// =============================================================================
// ALL PROJECTS PANEL
// =============================================================================
// Cursor integration notes:
//
// 1. Move to: src/app/(app)/projects/page.tsx
//
// 2. Pure content panel — no AppShell. Your existing AppShell wraps this.
//    Delete the AppShell import + wrapper below once moved.
//    The inner <ProjectsList> is the only thing Cursor needs.
//
// 3. Load: GET /api/projects → setProjects
//
// 4. Project card links (Details / Check List / Workbench) point to:
//      /project/[id]    /checklist/[id]    /workbench/[id]
//    Update the href construction in ProjectsList to match your route tree.
// =============================================================================

"use client"

import { useState, useEffect } from "react"
import { AppShell } from "@/components/app-shell/app-shell"
import { ProjectsList } from "@/components/app-shell/projects-list"
import { MOCK_PROJECTS } from "@/lib/mock-data"
import type { ProjectSummary } from "@/types"

export default function ProjectsPanel() {
  const [projects, setProjects] = useState<ProjectSummary[]>(MOCK_PROJECTS)

  // -------------------------------------------------------------------------
  // Cursor: replace with real fetch, e.g.:
  //
  // useEffect(() => {
  //   fetch("/api/projects")
  //     .then(r => r.json())
  //     .then(setProjects)
  // }, [])
  // -------------------------------------------------------------------------

  return (
    <AppShell>
      <ProjectsList projects={projects} />
    </AppShell>
  )
}
