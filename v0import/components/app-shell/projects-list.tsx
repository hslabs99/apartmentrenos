// =============================================================================
// ProjectsList — All Projects page
// =============================================================================
// Props: projects (ProjectSummary[])
// Cursor: wire the "Add project" button to your project creation form/modal.
// Wire the context menu Edit/Delete to your PATCH and DELETE endpoints.
// Links use static paths — update to dynamic routes when you have real IDs
// e.g. /project?id={project.id}, /checklist?id={project.id}, etc.
// =============================================================================

"use client"

import Link from "next/link"
import { useState } from "react"
import { Plus, MoreHorizontal, FileText, ListChecks, LayoutDashboard } from "lucide-react"
import type { ProjectSummary } from "@/types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  Live:      "bg-[#ECFDF5] text-[#059669]",
  Draft:     "bg-[#F3F4F6] text-[#6B7280]",
  Complete:  "bg-[#EFF6FF] text-[#2563EB]",
  "On Hold": "bg-[#FFFBEB] text-[#D97706]",
  Archived:  "bg-[#F3F4F6] text-[#9CA3AF]",
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProjectsListProps {
  projects: ProjectSummary[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectsList({ projects }: ProjectsListProps) {
  const [menuOpen, setMenuOpen] = useState<number | null>(null)

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A3C5E] tracking-tight">Projects</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>
        </div>
        {/* Cursor: wire onClick to your project creation form / modal */}
        <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1D9E75] text-white text-sm font-semibold rounded-lg hover:bg-[#18896a] transition-colors shadow-sm">
          <Plus className="h-4 w-4" />
          Add project
        </button>
      </div>

      {/* Cards grid — max 2 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl">
        {projects.map((project) => (
          <div key={project.id} className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm flex flex-col hover:shadow-md hover:border-[#D1D5DB] transition-all duration-150">

            {/* Card header */}
            <div className="p-4 pb-3 flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold text-[#1A3C5E] truncate">{project.name}</h2>
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLES[project.status] ?? "bg-[#F3F4F6] text-[#6B7280]"}`}>
                    {project.status}
                  </span>
                </div>
                <p className="text-xs text-[#9CA3AF] mt-0.5">ID {project.id}</p>
              </div>
              <div className="relative shrink-0">
                <button
                  onClick={() => setMenuOpen(menuOpen === project.id ? null : project.id)}
                  className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors"
                  aria-label="Project options"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menuOpen === project.id && (
                  <div className="absolute right-0 top-8 z-20 w-36 bg-white rounded-lg border border-[#E5E7EB] shadow-lg py-1">
                    {/* Cursor: wire to navigate to /project?id={project.id} or similar */}
                    <button className="w-full text-left px-3 py-1.5 text-xs text-[#374151] hover:bg-[#F9FAFB]">Edit</button>
                    {/* Cursor: wire to DELETE /api/projects/:id + optimistic remove from list */}
                    <button className="w-full text-left px-3 py-1.5 text-xs text-[#DC2626] hover:bg-[#FEF2F2]">Delete</button>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="px-4 pb-4 flex-1">
              {project.description
                ? <p className="text-xs text-[#6B7280] leading-relaxed line-clamp-2">{project.description}</p>
                : <p className="text-xs text-[#D1D5DB] italic">No description</p>
              }
            </div>

            <div className="border-t border-[#F3F4F6]" />

            {/* Action buttons — equal width via flex-1 */}
            {/* Cursor: update hrefs to include real project ID, e.g. /project?id={project.id} */}
            <div className="p-3 flex items-center gap-2">
              <Link href="/project" className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-[#374151] bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#D1D5DB] transition-colors whitespace-nowrap">
                <FileText className="h-3.5 w-3.5 shrink-0 text-[#6B7280]" />
                Details
              </Link>
              <Link href="/checklist" className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-[#374151] bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#D1D5DB] transition-colors whitespace-nowrap">
                <ListChecks className="h-3.5 w-3.5 shrink-0 text-[#6B7280]" />
                Check List
              </Link>
              <Link href="/" className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-[#374151] bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#D1D5DB] transition-colors whitespace-nowrap">
                <LayoutDashboard className="h-3.5 w-3.5 shrink-0 text-[#6B7280]" />
                Workbench
                {project.workbenchItemCount > 0 && (
                  <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-[#F3F4F6] text-[10px] font-bold text-[#6B7280]">
                    {project.workbenchItemCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
