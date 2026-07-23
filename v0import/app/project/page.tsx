// =============================================================================
// PROJECT DETAIL PANEL — desktop + tablet
// =============================================================================
// Cursor integration notes:
//
// 1. Move to: src/app/(app)/project/[id]/page.tsx
//
// 2. Pure content panel — no TopNav, no AppShell. Wrap externally.
//
// 3. Load: fetch("/api/projects/:id") → setProject
//    Save: PATCH "/api/projects/:id" with form state on Save button click.
//    The ProjectForm component calls onSave(formData) — wire that prop.
//
// 4. The "All projects" link → your existing projects list route.
//    The "Workbench" link → your existing workbench route for this project.
// =============================================================================

"use client"

import { useState, useEffect } from "react"
import { TopNav } from "@/components/workbench/top-nav"
import { ProjectForm } from "@/components/project/project-form"
import { MOCK_PROJECT } from "@/lib/mock-data"
import type { Project } from "@/types"

// Cursor: receive projectId from route params
export default function ProjectDetailPanel() {
  const [project, setProject] = useState<Project>(MOCK_PROJECT)

  // -------------------------------------------------------------------------
  // Cursor: replace with real fetch, e.g.:
  //
  // useEffect(() => {
  //   fetch(`/api/projects/${projectId}`)
  //     .then(r => r.json())
  //     .then(setProject)
  // }, [projectId])
  // -------------------------------------------------------------------------

  function handleSave(updated: Project) {
    // Cursor: replace with real PATCH, e.g.:
    // fetch(`/api/projects/${project.id}`, {
    //   method: "PATCH",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(updated),
    // }).then(() => setProject(updated))
    setProject(updated)
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <TopNav />
      <ProjectForm project={project} onSave={handleSave} />
    </div>
  )
}
