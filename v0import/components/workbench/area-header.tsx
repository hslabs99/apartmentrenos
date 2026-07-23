// =============================================================================
// AreaHeader — Workbench
// =============================================================================
// Props: area (identity + controls) with embedded financials
// Cursor: wire each select/input onChange to PATCH /api/areas/:id or equivalent.
// =============================================================================

"use client"

import { Edit2, FileText, MoreHorizontal } from "lucide-react"
import type { Area } from "@/types"

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AreaStatBadge({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 px-3 py-2 rounded-md border ${
      accent ? "bg-[#1D9E75] border-[#1D9E75] text-white" : "bg-[#F5F7FA] border-[#E5E7EB]"
    }`}>
      <span className={`text-[9px] font-semibold tracking-wider uppercase ${accent ? "text-white/70" : "text-[#6B7280]"}`}>{label}</span>
      <span className={`text-xs font-bold tabular-nums ${accent ? "text-white" : "text-[#1A3C5E]"}`}>{value}</span>
    </div>
  )
}

function AreaTradeDraftTag({ label, value }: { label: string; value: string }) {
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

export interface AreaHeaderProps {
  area: Area
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AreaHeader({ area }: AreaHeaderProps) {
  const { financials } = area

  const areaTrades = [
    { label: "CA",    value: fmt(financials.tradeTotals.ca) },
    { label: "LC",    value: fmt(financials.tradeTotals.lc) },
    { label: "ELEC",  value: fmt(financials.tradeTotals.elec) },
    { label: "PLUMB", value: fmt(financials.tradeTotals.plumb) },
  ]

  const areaSummary = [
    { label: "LINE SUB TOTAL", value: fmt(financials.lineSubTotal), accent: false },
    { label: "TRADE TOTAL",    value: fmt(financials.tradeTotal),   accent: false },
    { label: "TOTAL",          value: fmt(financials.total),        accent: false },
    { label: "MARGIN",         value: fmt(financials.margin),       accent: false },
    { label: "FINAL",          value: fmt(financials.final),        accent: true  },
  ]

  return (
    <section className="bg-[#f0f4f8] border-b border-[#E5E7EB]">
      <div className="flex items-start justify-between px-5 pt-3 pb-3">
        {/* Left: area controls */}
        <div className="flex flex-col gap-3">

          {/* Row 1: name + inline controls — all bottom-aligned */}
          <div className="flex items-end gap-3">

            {/* Area name */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold tracking-widest uppercase text-[#6B7280]">Area</span>
              <div className="flex items-center gap-1.5 h-7">
                <span className="text-lg font-bold text-[#1A3C5E] leading-none">{area.name}</span>
                <button className="text-[#6B7280] hover:text-[#1A3C5E] transition-colors">
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="w-px h-7 bg-[#E5E7EB]" />

            {/* Area M² */}
            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] font-semibold tracking-wider uppercase text-[#6B7280]">Area m²</label>
              {/* Cursor: wire value + onChange to area.m2 PATCH */}
              <input type="text" placeholder="—" defaultValue={area.m2 ?? ""} className="h-7 w-16 px-2 text-xs font-medium text-[#374151] bg-white border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/40 text-center" />
            </div>

            {/* Ceiling (M) */}
            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] font-semibold tracking-wider uppercase text-[#6B7280]">Ceiling (m)</label>
              {/* Cursor: wire value + onChange to area.ceilingM PATCH */}
              <input type="text" defaultValue={area.ceilingM} className="h-7 w-16 px-2 text-xs font-medium text-[#374151] bg-white border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/40 text-center" />
            </div>

            {/* Area Status + notes + three-dot — all bottom-aligned */}
            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] font-semibold tracking-wider uppercase text-[#6B7280]">Area Status</label>
              <div className="flex items-center gap-1">
                {/* Cursor: wire value + onChange to area.status PATCH */}
                <select defaultValue={area.status} className="h-7 px-2 pr-6 text-xs font-medium text-[#374151] bg-white border border-[#E5E7EB] rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/40">
                  <option value="">— —</option>
                  <option value="Live">Live</option>
                  <option value="Draft">Draft</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Complete">Complete</option>
                </select>
                <button title="Notes" className="h-7 w-7 flex items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#1A3C5E] hover:border-[#1A3C5E]/30 transition-colors">
                  <FileText className="h-3.5 w-3.5" />
                </button>
                <button title="More options" className="h-7 w-7 flex items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#1A3C5E] hover:border-[#1A3C5E]/30 transition-colors">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: override selectors */}
          {/* Cursor: wire each select onChange to area PATCH */}
          <div className="flex items-center gap-5">
            {[
              { label: "Elevate",          value: area.elevate },
              { label: "Style Override",   value: area.styleOverride },
              { label: "Colour Override",  value: area.colourOverride },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <label className="text-[9px] font-semibold tracking-wider uppercase text-[#6B7280]">{label}</label>
                <select defaultValue={value} className="h-7 px-2 pr-6 text-xs font-medium text-[#374151] bg-white border border-[#E5E7EB] rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/40">
                  <option>{value}</option>
                </select>
              </div>
            ))}
          </div>

          {/* Row 3: demolition */}
          {/* Cursor: wire onChange to area demolitionM2 + demolitionDescription PATCH */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] font-semibold tracking-wider uppercase text-[#6B7280]">Demolition — Area to Remove (m²)</label>
              <input type="text" defaultValue={area.demolitionM2 ?? ""} className="h-7 w-24 px-2 text-xs font-medium text-[#374151] bg-white border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/40" />
            </div>
            <div className="flex flex-col gap-0.5 flex-1">
              <label className="text-[9px] font-semibold tracking-wider uppercase text-[#6B7280]">Full Kitchen Cabinets &amp; Bench — New</label>
              <input type="text" defaultValue={area.demolitionDescription} className="h-7 w-48 px-2 text-xs font-medium text-[#374151] bg-white border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/40" />
            </div>
          </div>
        </div>

        {/* Right: area financial summary */}
        <div className="flex items-stretch gap-2 mt-1 self-start">
          <div className="flex items-end gap-1 mr-1">
            {areaTrades.map((t) => <AreaTradeDraftTag key={t.label} label={t.label} value={t.value} />)}
          </div>
          <div className="w-px bg-[#E5E7EB] self-stretch" />
          <div className="flex items-stretch gap-1.5 ml-1">
            {areaSummary.map((s) => <AreaStatBadge key={s.label} label={s.label} value={s.value} accent={s.accent} />)}
          </div>
        </div>
      </div>
    </section>
  )
}
