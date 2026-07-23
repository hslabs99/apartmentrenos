// =============================================================================
// ChecklistAreaHeader — Checklist tab
// =============================================================================
// Props: area (ChecklistArea)
// The id attribute on the wrapper div is used by jump-to-area anchor links.
// Cursor: wire each input/select onChange to PATCH /api/areas/:id.
// =============================================================================

"use client"

import { Calculator, FileText, MoreHorizontal } from "lucide-react"
import type { ChecklistArea } from "@/types"

export interface ChecklistAreaHeaderProps {
  area: ChecklistArea
}

export function ChecklistAreaHeader({ area }: ChecklistAreaHeaderProps) {
  const fmt = (n: number) =>
    n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div id={`area-${area.id}`} className="bg-[#3D5166] border-b border-[#2d3d4f] sticky top-0 z-20">
      <div className="px-5 py-3 flex items-end gap-3 flex-wrap">

        {/* Area name */}
        <span className="text-xl font-bold text-white tracking-tight pb-0.5">{area.name}</span>

        <div className="self-stretch w-px bg-white/20 mx-1" />

        {/* Nickname */}
        {/* Cursor: wire onChange to PATCH area.nickname */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold tracking-wider uppercase text-white/50">Nickname</label>
          <input type="text" placeholder="e.g. Master, En-suite…" defaultValue={area.nickname}
            className="h-8 w-36 px-2.5 text-xs text-white bg-white/10 border border-white/20 rounded-md placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/60 focus:bg-white/15 transition-all" />
        </div>

        {/* Area M² */}
        {/* Cursor: wire onChange to PATCH area.m2 */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold tracking-wider uppercase text-white/50">Area m²</label>
          <input type="text" placeholder="—" defaultValue={area.m2 ?? ""}
            className="h-8 w-14 px-2 text-xs font-medium text-white bg-white/10 border border-white/20 rounded-md text-center placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/60 transition-all" />
        </div>

        {/* Ceiling */}
        {/* Cursor: wire onChange to PATCH area.ceilingM */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold tracking-wider uppercase text-white/50">Ceiling (m)</label>
          <input type="text" defaultValue={area.ceilingM}
            className="h-8 w-14 px-2 text-xs font-medium text-white bg-white/10 border border-white/20 rounded-md text-center focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/60 transition-all" />
        </div>

        {/* Calculator */}
        {/* Cursor: wire onClick to open calculator for this area */}
        <button title="Calculator" className="h-8 w-8 flex items-center justify-center rounded-md bg-white/10 border border-white/20 text-white/70 hover:text-white hover:bg-white/20 transition-colors">
          <Calculator className="h-4 w-4" />
        </button>

        {/* Non Std toggle */}
        {/* Cursor: wire onClick to toggle nonStdVisible state for this area */}
        <button className="h-8 px-3 rounded-md bg-[#1D9E75]/80 border border-[#1D9E75] text-white text-xs font-semibold hover:bg-[#1D9E75] transition-colors whitespace-nowrap">
          Non Std · on
        </button>

        {/* Notes + three-dot */}
        <div className="flex items-center gap-1">
          {/* Cursor: wire onClick to open notes panel for this area */}
          <button title="Notes" className="h-8 w-8 flex items-center justify-center rounded-md bg-white/10 border border-white/20 text-white/70 hover:text-white hover:bg-white/20 transition-colors">
            <FileText className="h-3.5 w-3.5" />
          </button>
          {/* Cursor: wire onClick to area context menu */}
          <button title="More options" className="h-8 w-8 flex items-center justify-center rounded-md bg-white/10 border border-white/20 text-white/70 hover:text-white hover:bg-white/20 transition-colors">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Area Status */}
        {/* Cursor: wire onChange to PATCH area.status */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold tracking-wider uppercase text-white/50">Area Status</label>
          <select defaultValue={area.status} className="h-8 px-2 pr-6 text-xs font-medium text-white bg-white/10 border border-white/20 rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/60 transition-all">
            <option value="">—</option>
            <option value="Live">Live</option>
            <option value="Draft">Draft</option>
            <option value="On Hold">On Hold</option>
            <option value="Complete">Complete</option>
          </select>
        </div>

        <div className="flex-1" />

        {/* Total price */}
        <div className="flex flex-col items-end">
          <span className="text-[9px] font-semibold tracking-wider uppercase text-white/50">Total Price</span>
          <span className="text-lg font-bold text-[#4ECFA0] tabular-nums">${fmt(area.totalPrice)}</span>
        </div>
      </div>

      {/* Scope Questions label */}
      <div className="px-5 py-2 bg-[#F5F7FA] border-t border-[#E5E7EB]">
        <span className="text-xs font-bold text-[#374151] tracking-wide uppercase">Scope Questions</span>
      </div>
    </div>
  )
}
