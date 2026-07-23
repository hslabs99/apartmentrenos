// =============================================================================
// WORKBENCH PANEL — desktop only
// =============================================================================
// Cursor integration notes:
//
// 1. Move this file to: src/app/(app)/workbench/[id]/page.tsx
//    (or wherever your existing route tree places project-level pages)
//
// 2. This exports a pure content panel — no TopNav, no AppShell.
//    Wrap it with your existing AuthGuard + AppShell in the layout.
//
// 3. Data fetching pattern: replace the mock constants below with
//    fetch("/api/projects/:id") etc. inside the useEffect calls.
//
// 4. Token mapping — this panel uses the v0 design tokens. Map to your
//    existing sf-* tokens in the component files, or add these aliases
//    to your tailwind config / globals.css:
//      sf-brand      → #1A3C5E  (navy)
//      sf-accent     → #1D9E75  (teal)
//      sf-surface    → #FFFFFF
//      sf-bg         → #F5F7FA
//      sf-border     → #E5E7EB
//      sf-text       → #374151
//      sf-text-muted → #6B7280
// =============================================================================

"use client"

import { useState, useEffect } from "react"
import { TopNav } from "@/components/workbench/top-nav"
import { ProjectHeader } from "@/components/workbench/project-header"
import { AreaHeader } from "@/components/workbench/area-header"
import { WorkbenchTable } from "@/components/workbench/workbench-table"
import {
  MOCK_PROJECT,
  MOCK_PROJECT_FINANCIALS,
  MOCK_AREAS,
  MOCK_LINE_ITEMS,
} from "@/lib/mock-data"
import type { Project, ProjectFinancials, Area, LineItem } from "@/types"

// ---------------------------------------------------------------------------
// Cursor: receive projectId as a prop from your dynamic route params,
// e.g. export default function WorkbenchPanel({ params }: { params: { id: string } })
// ---------------------------------------------------------------------------
export default function WorkbenchPanel() {
  const [project, setProject]         = useState<Project>(MOCK_PROJECT)
  const [financials, setFinancials]   = useState<ProjectFinancials>(MOCK_PROJECT_FINANCIALS)
  const [areas, setAreas]             = useState<Area[]>(MOCK_AREAS)
  const [lineItems, setLineItems]     = useState<LineItem[]>(MOCK_LINE_ITEMS)

  // -------------------------------------------------------------------------
  // Cursor: replace these useEffects with real fetch calls, e.g.:
  //
  // useEffect(() => {
  //   fetch(`/api/projects/${projectId}`)
  //     .then(r => r.json())
  //     .then(data => {
  //       setProject(data.project)
  //       setFinancials(data.financials)
  //     })
  // }, [projectId])
  //
  // useEffect(() => {
  //   fetch(`/api/projects/${projectId}/areas`)
  //     .then(r => r.json())
  //     .then(setAreas)
  // }, [projectId])
  //
  // useEffect(() => {
  //   if (!areas[0]) return
  //   fetch(`/api/areas/${areas[0].id}/items`)
  //     .then(r => r.json())
  //     .then(setLineItems)
  // }, [areas])
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F7FA]">
      <TopNav />
      <ProjectHeader project={project} financials={financials} />
      {areas.map((area) => (
        <section key={area.id}>
          <AreaHeader area={area} />
          {/* Cursor: pass the correct lineItems for each area */}
          <WorkbenchTable items={lineItems} />
        </section>
      ))}
    </div>
  )
}
