// =============================================================================
// ChecklistProjectPanel — Checklist tab
// =============================================================================
// Props: project (ChecklistProject)
// Cursor: wire each input/select onChange to PATCH /api/projects/:id.
// Jump-to-area anchors link to #area-{id} set in ChecklistAreaHeader.
// =============================================================================

"use client"

import { FileText, MoreHorizontal } from "lucide-react"
import type { ChecklistProject } from "@/types"

export interface ChecklistProjectPanelProps {
  project: ChecklistProject
}

export function ChecklistProjectPanel({ project }: ChecklistProjectPanelProps) {
  const fmt = (n: number) =>
    n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="bg-white border-b border-[#E5E7EB]">

      {/* 1. Project identity + total price */}
      <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div>
            <span className="text-[10px] font-semibold tracking-wider uppercase text-[#6B7280] block mb-0.5">Project</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-[#1A3C5E]">{project.name}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#e6f7f2] text-[#1D9E75] text-[11px] font-semibold border border-[#1D9E75]/20">
                ID {project.id}
              </span>
              <div className="flex items-center gap-0.5">
                {/* Cursor: wire onClick to open project notes panel */}
                <button title="Notes" className="h-6 w-6 flex items-center justify-center rounded text-[#6B7280] hover:text-[#1A3C5E] hover:bg-[#F5F7FA] transition-colors">
                  <FileText className="h-3.5 w-3.5" />
                </button>
                {/* Cursor: wire onClick to project context menu */}
                <button title="More options" className="h-6 w-6 flex items-center justify-center rounded text-[#6B7280] hover:text-[#1A3C5E] hover:bg-[#F5F7FA] transition-colors">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-[#6B7280]">Total Price</span>
          <span className="text-2xl font-bold text-[#1D9E75] tabular-nums">${fmt(project.totalPrice)}</span>
        </div>
      </div>

      {/* 2. Metrics: M² fields + dropdowns + helper */}
      <div className="px-5 pt-4 pb-4 border-b border-[#E5E7EB]">
        {/* Cursor: wire each input onChange to PATCH project m2/ceiling fields */}
        <div className="flex items-end gap-4 flex-wrap mb-4">
          {[
            { label: "M² (Total)",         value: String(project.m2Total),        placeholder: "" },
            { label: "M² (Hard Floor)",    value: String(project.m2HardFloor),    placeholder: "" },
            { label: "M² (Soft Floor)",    value: project.m2SoftFloor != null ? String(project.m2SoftFloor) : "", placeholder: "Optional" },
            { label: "Ceiling Height (m)", value: String(project.ceilingHeight),  placeholder: "" },
          ].map((f) => (
            <div key={f.label} className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold tracking-wider uppercase text-[#6B7280]">{f.label}</label>
              <input type="text" defaultValue={f.value} placeholder={f.placeholder}
                className="h-8 w-24 px-2.5 text-sm font-medium text-[#374151] bg-[#F5F7FA] border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/40 focus:bg-white transition-all" />
            </div>
          ))}
        </div>

        {/* Cursor: wire each select onChange to PATCH project elevate/style/colour */}
        <div className="flex items-end gap-4 flex-wrap mb-3">
          {[
            { label: "Default Elevate", value: project.elevate },
            { label: "Style",           value: project.style },
            { label: "Colour",          value: project.colour },
          ].map((d) => (
            <div key={d.label} className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold tracking-wider uppercase text-[#6B7280]">{d.label}</label>
              <select defaultValue={d.value} className="h-8 px-2.5 pr-7 text-sm font-medium text-[#374151] bg-[#F5F7FA] border border-[#E5E7EB] rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/40 focus:bg-white transition-all">
                <option>{d.value}</option>
              </select>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
          Style and colour options come from Cascades (Import). Used for SKU matching on scope lines unless an area overrides them.
        </p>
      </div>

      {/* 3. Jump to area */}
      <div className="px-5 py-2 flex items-center gap-1 overflow-x-auto scrollbar-none">
        <span className="text-[10px] font-bold tracking-wider uppercase text-[#9CA3AF] whitespace-nowrap mr-1">
          Jump to Area
        </span>
        {project.areas.map((area, i) => (
          <span key={area.id} className="flex items-center gap-1">
            {/* Cursor: these anchor to #area-{area.id} set in ChecklistAreaHeader */}
            <a href={`#area-${area.id}`} className="text-sm font-medium text-[#1A3C5E] hover:text-[#1D9E75] hover:underline whitespace-nowrap transition-colors px-1 py-0.5 rounded">
              {area.name}
            </a>
            {i < project.areas.length - 1 && <span className="text-[#D1D5DB] text-sm select-none">·</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
