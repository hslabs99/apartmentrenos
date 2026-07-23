// =============================================================================
// CHECKLIST PANEL — tablet landscape + desktop
// =============================================================================
// Cursor integration notes:
//
// 1. Move to: src/app/(app)/checklist/[id]/page.tsx
//
// 2. Pure content panel — no TopNav, no AppShell. Wrap externally.
//
// 3. Replace MOCK_CHECKLIST_PROJECT with fetch("/api/projects/:id/checklist")
//    in the useEffect below.
//
// 4. The FloatingInfoBar tracks the currently visible area. Wire activeAreaId
//    to an IntersectionObserver on each <section id="area-{id}"> to update
//    it as the user scrolls.
// =============================================================================

"use client"

import { useState, useEffect } from "react"
import { TopNav } from "@/components/workbench/top-nav"
import { ChecklistProjectPanel } from "@/components/checklist/checklist-project-panel"
import { ChecklistAreaHeader } from "@/components/checklist/checklist-area-header"
import { ChecklistLineItems } from "@/components/checklist/checklist-line-items"
import { FloatingInfoBar } from "@/components/checklist/floating-info-bar"
import { MOCK_CHECKLIST_PROJECT } from "@/lib/mock-data"
import type { ChecklistProject } from "@/types"

function fmt(n: number) {
  return "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Cursor: receive projectId from route params
export default function ChecklistPanel() {
  const [project, setProject] = useState<ChecklistProject>(MOCK_CHECKLIST_PROJECT)
  const [activeAreaId, setActiveAreaId] = useState<number>(MOCK_CHECKLIST_PROJECT.areas[0]?.id ?? 0)

  // -------------------------------------------------------------------------
  // Cursor: replace with real fetch, e.g.:
  //
  // useEffect(() => {
  //   fetch(`/api/projects/${projectId}/checklist`)
  //     .then(r => r.json())
  //     .then(data => {
  //       setProject(data)
  //       setActiveAreaId(data.areas[0]?.id ?? 0)
  //     })
  // }, [projectId])
  //
  // Cursor: wire IntersectionObserver for floating bar, e.g.:
  //
  // useEffect(() => {
  //   const observer = new IntersectionObserver(
  //     (entries) => {
  //       const visible = entries.find(e => e.isIntersecting)
  //       if (visible) setActiveAreaId(Number(visible.target.id.replace("area-", "")))
  //     },
  //     { threshold: 0.3 }
  //   )
  //   document.querySelectorAll("[id^='area-']").forEach(el => observer.observe(el))
  //   return () => observer.disconnect()
  // }, [project])
  // -------------------------------------------------------------------------

  const activeArea = project.areas.find(a => a.id === activeAreaId) ?? project.areas[0]

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F7FA]">
      <TopNav />
      <ChecklistProjectPanel project={project} />

      {project.areas.map((area) => (
        <section key={area.id} id={`area-${area.id}`}>
          <ChecklistAreaHeader area={area} />
          <ChecklistLineItems items={area.lineItems} />
        </section>
      ))}

      <div className="h-24" />

      {activeArea && (
        <FloatingInfoBar
          areaName={activeArea.name}
          areaTotal={fmt(activeArea.totalPrice)}
          projectTotal={fmt(project.totalPrice)}
        />
      )}
    </div>
  )
}
