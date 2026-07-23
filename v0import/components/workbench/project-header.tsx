// =============================================================================
// ProjectHeader — Workbench
// =============================================================================
// Props: project (identity + selectors) + financials (all totals + margin)
// Cursor: wire `project` and `financials` from your DB/API fetch in the page.
// The marginPct field is UI-only state for now; wire its onChange to your
// PATCH /api/projects/:id endpoint or equivalent server action.
// =============================================================================

"use client"

import { useState } from "react"
import { ChevronUp, ChevronDown, MoreHorizontal, FileText, LayoutList, AlignJustify } from "lucide-react"
import type { Project, ProjectFinancials } from "@/types"

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 px-4 py-2.5 rounded-lg border min-w-[130px] ${
      accent ? "bg-[#1A3C5E] border-[#1A3C5E] text-white" : "bg-white border-[#E5E7EB] text-[#374151]"
    }`}>
      <span className={`text-[10px] font-semibold tracking-wider uppercase ${accent ? "text-white/60" : "text-[#6B7280]"}`}>
        {label}
      </span>
      <span className={`text-sm font-bold tabular-nums ${accent ? "text-white" : "text-[#1A3C5E]"}`}>
        {value}
      </span>
    </div>
  )
}

function TradeDraftTag({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-start gap-0 px-2 py-1.5 bg-[#F9FAFB] border border-[#E5E7EB]/70 rounded">
      <span className="text-[8px] font-medium tracking-wider uppercase text-[#9CA3AF]">{label}</span>
      <span className="text-[10px] font-medium tabular-nums text-[#9CA3AF]">{value}</span>
    </div>
  )
}

function fmt(n: number) {
  return n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProjectHeaderProps {
  project: Pick<Project, "id" | "name" | "finishLevel" | "style" | "colour">
  financials: ProjectFinancials
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectHeader({ project, financials }: ProjectHeaderProps) {
  const [view, setView] = useState<"detail" | "summary">("detail")
  const [marginPct, setMarginPct] = useState(financials.marginPct)

  const tradeRows = [
    { label: "PAINTING", value: fmt(financials.tradeTotals.painting) },
    { label: "CA",       value: fmt(financials.tradeTotals.ca) },
    { label: "LC",       value: fmt(financials.tradeTotals.lc) },
    { label: "ELEC",     value: fmt(financials.tradeTotals.elec) },
    { label: "PLUMB",    value: fmt(financials.tradeTotals.plumb) },
  ]

  const summaryRows = [
    { label: "LINE SUB TOTAL", value: fmt(financials.lineSubTotal), accent: false },
    { label: "TRADE TOTAL",    value: fmt(financials.tradeTotal),   accent: false },
    { label: "TOTAL",          value: fmt(financials.total),        accent: false },
    { label: "MARGIN",         value: fmt(financials.margin),       accent: true  },
    { label: "GRAND TOTAL",    value: fmt(financials.grandTotal),   accent: true  },
  ]

  return (
    <section className="bg-white border-b border-[#E5E7EB] shadow-sm">
      <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-[#E5E7EB]">
        {/* Left: project identity */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-[#6B7280]">Project</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-[#1A3C5E] leading-tight">{project.name}</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e6f7f2] text-[#1D9E75] text-[11px] font-semibold border border-[#1D9E75]/20">
                ID {project.id}
              </span>
              <div className="flex items-center gap-0.5">
                <button title="Notes" className="h-6 w-6 flex items-center justify-center rounded text-[#6B7280] hover:text-[#1A3C5E] hover:bg-[#F5F7FA] transition-colors">
                  <FileText className="h-3.5 w-3.5" />
                </button>
                <button title="More options" className="h-6 w-6 flex items-center justify-center rounded text-[#6B7280] hover:text-[#1A3C5E] hover:bg-[#F5F7FA] transition-colors">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Project-level selectors */}
          {/* Cursor: wire onChange to PATCH project finishLevel/style/colour */}
          <div className="flex items-center gap-5 mt-1">
            {[
              { label: "Default Elevate", value: project.finishLevel },
              { label: "Style",           value: project.style },
              { label: "Colour",          value: project.colour },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <label className="text-[10px] font-semibold tracking-wider uppercase text-[#6B7280]">{label}</label>
                <select defaultValue={value} className="h-7 px-2 pr-6 text-xs font-medium text-[#374151] bg-[#F5F7FA] border border-[#E5E7EB] rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/40">
                  <option>{value}</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Right: view toggle + trade breakdown + summary */}
        <div className="flex flex-col items-end gap-3">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-[#E5E7EB] bg-[#F5F7FA] p-0.5 gap-0.5">
            {(["detail", "summary"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
                  view === v ? "bg-white shadow-sm text-[#1A3C5E] border border-[#E5E7EB]" : "text-[#6B7280] hover:text-[#374151]"
                }`}
              >
                {v === "detail" ? <AlignJustify className="h-3 w-3" /> : <LayoutList className="h-3 w-3" />}
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {/* Financials row */}
          <div className="flex items-stretch gap-2">
            <div className="flex items-end gap-1 mr-2">
              {tradeRows.map((t) => <TradeDraftTag key={t.label} label={t.label} value={t.value} />)}
            </div>
            <div className="w-px bg-[#E5E7EB] self-stretch mx-1" />
            <div className="flex items-stretch gap-1.5">
              {summaryRows.map((s) => <StatCard key={s.label} label={s.label} value={s.value} accent={s.accent} />)}

              {/* Margin % spinner */}
              {/* Cursor: wire onChange + onBlur to PATCH project marginPct */}
              <div className="flex flex-col gap-0.5 px-3 py-2 bg-white border border-[#E5E7EB] rounded-lg self-stretch justify-center">
                <span className="text-[9px] font-semibold tracking-wider uppercase text-[#6B7280]">Margin %</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={marginPct}
                    onChange={(e) => setMarginPct(Number(e.target.value))}
                    className="w-10 h-6 px-1 text-xs font-bold text-[#1A3C5E] bg-[#F5F7FA] border border-[#E5E7EB] rounded text-center focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <div className="flex flex-col">
                    <button onClick={() => setMarginPct((v) => v + 1)} className="h-3 w-4 flex items-center justify-center rounded-t border border-[#E5E7EB] bg-[#F5F7FA] text-[#6B7280] hover:bg-[#1A3C5E] hover:text-white hover:border-[#1A3C5E] transition-colors">
                      <ChevronUp className="h-2.5 w-2.5" />
                    </button>
                    <button onClick={() => setMarginPct((v) => Math.max(0, v - 1))} className="h-3 w-4 flex items-center justify-center rounded-b border-x border-b border-[#E5E7EB] bg-[#F5F7FA] text-[#6B7280] hover:bg-[#1A3C5E] hover:text-white hover:border-[#1A3C5E] transition-colors">
                      <ChevronDown className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <span className="text-xs text-[#6B7280] font-medium">%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
