// =============================================================================
// WorkbenchTable — Workbench
// =============================================================================
// Props: items (LineItem[])
// Cursor: pass the array returned by getLineItems(areaId) from the page.
// Wire each row's checkbox, measure input, selects to PATCH /api/line-items/:id.
// =============================================================================

"use client"

import { FileText, MoreHorizontal, Plus } from "lucide-react"
import type { LineItem } from "@/types"

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TradePair({ top, bottom }: { top: string; bottom: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <span className="text-[11px] font-semibold text-[#374151]">{top}</span>
      <span className="text-[10px] text-[#6B7280]">{bottom}</span>
    </div>
  )
}

function fmt(n: number) {
  return n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function tradePairValues(units: number, dollars: number) {
  return {
    top: units === 0 ? "—" : String(units),
    bottom: dollars === 0 ? "—" : `$${fmt(dollars)}`,
  }
}

function SkuCell({ item }: { item: LineItem }) {
  if (!item.skuCode) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-[#6B7280] italic">No matching SKU</span>
        {/* Cursor: wire onClick to open Add Manual Row modal/form */}
        <button className="text-[10px] text-[#1D9E75] font-semibold hover:underline flex items-center gap-0.5">
          <Plus className="h-3 w-3" />
          Add Manual Row
        </button>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-1.5 min-w-0">
      {item.skuCount > 0 && (
        <span className="shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full bg-[#1A3C5E] text-white text-[9px] font-bold">
          {item.skuCount}
        </span>
      )}
      <span className="text-[11px] text-[#374151] truncate leading-tight">
        {item.skuCode} · {item.skuDescription}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Column headers
// ---------------------------------------------------------------------------

const COL_HEADERS = [
  "INCL.", "DESCRIPTION", "SOURCE", "ELEVATE", "STYLE", "COLOUR",
  "PRODUCT / SKU", "MEASURE", "UOM", "UNIT PRICE", "LINE TOTAL",
  "CA", "LC", "ELEC", "PLUMB", "FINAL PRICE", "SUPPLIER", "NOTES / ACTIONS",
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WorkbenchTableProps {
  items: LineItem[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkbenchTable({ items }: WorkbenchTableProps) {
  return (
    <div className="overflow-x-auto bg-white">
      <table className="w-full border-collapse text-xs min-w-[1600px]">
        <thead>
          <tr className="bg-[#1A3C5E] text-white">
            {COL_HEADERS.map((h) => (
              <th key={h} className="px-2 py-2.5 text-left text-[10px] font-semibold tracking-wider uppercase whitespace-nowrap border-r border-white/10 last:border-r-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const isDemolition = item.description === "Demolition"
            const isBundle = item.source === "Bundled"
            const isEven = idx % 2 === 0
            const rowBg = isDemolition ? "bg-amber-50" : isBundle ? "bg-[#f0f4f8]" : isEven ? "bg-white" : "bg-[#F9FAFB]"

            const ca    = tradePairValues(item.trades.ca,    item.trades.ca    * item.unitPrice)
            const lc    = tradePairValues(item.trades.lc,    item.trades.lc    * item.unitPrice)
            const elec  = tradePairValues(item.trades.elec,  item.trades.elec  * item.unitPrice)
            const plumb = tradePairValues(item.trades.plumb, item.trades.plumb * item.unitPrice)

            return (
              <tr key={item.id} className={`${rowBg} border-b border-[#E5E7EB] hover:bg-[#e6f7f2]/40 transition-colors`}>

                {/* INCL. */}
                {/* Cursor: wire onChange to PATCH item.included */}
                <td className="px-2 py-2 border-r border-[#E5E7EB]">
                  <input type="checkbox" defaultChecked={item.included} className="h-3.5 w-3.5 accent-[#1D9E75] cursor-pointer" />
                </td>

                {/* DESCRIPTION */}
                <td className="px-2 py-2 border-r border-[#E5E7EB] min-w-[110px]">
                  <span className={`font-semibold ${isBundle ? "text-[#6B7280] pl-3" : "text-[#1A3C5E]"}`}>
                    {item.description}
                  </span>
                </td>

                {/* SOURCE */}
                <td className="px-2 py-2 border-r border-[#E5E7EB] whitespace-nowrap">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    isBundle ? "bg-purple-50 text-purple-700" : "bg-[#e6f7f2] text-[#1D9E75]"
                  }`}>
                    {item.source}
                  </span>
                </td>

                {/* ELEVATE */}
                {/* Cursor: wire onChange to PATCH item.elevate */}
                <td className="px-2 py-2 border-r border-[#E5E7EB] min-w-[100px]">
                  <select defaultValue={item.elevate} className="w-full h-6 px-1.5 text-[11px] text-[#374151] bg-transparent border border-transparent hover:border-[#E5E7EB] rounded focus:outline-none focus:ring-1 focus:ring-[#1D9E75]/50 focus:bg-white focus:border-[#1D9E75]/40 transition-all appearance-none cursor-pointer">
                    <option>{item.elevate}</option>
                  </select>
                </td>

                {/* STYLE */}
                {/* Cursor: wire onChange to PATCH item.style */}
                <td className="px-2 py-2 border-r border-[#E5E7EB] min-w-[160px]">
                  <select defaultValue={item.style} className="w-full h-6 px-1.5 text-[11px] text-[#374151] bg-transparent border border-transparent hover:border-[#E5E7EB] rounded focus:outline-none focus:ring-1 focus:ring-[#1D9E75]/50 focus:bg-white focus:border-[#1D9E75]/40 transition-all appearance-none cursor-pointer">
                    <option>{item.style}</option>
                  </select>
                </td>

                {/* COLOUR */}
                {/* Cursor: wire onChange to PATCH item.colour */}
                <td className="px-2 py-2 border-r border-[#E5E7EB] min-w-[170px]">
                  <select defaultValue={item.colour} className="w-full h-6 px-1.5 text-[11px] text-[#374151] bg-transparent border border-transparent hover:border-[#E5E7EB] rounded focus:outline-none focus:ring-1 focus:ring-[#1D9E75]/50 focus:bg-white focus:border-[#1D9E75]/40 transition-all appearance-none cursor-pointer">
                    <option>{item.colour}</option>
                  </select>
                </td>

                {/* PRODUCT / SKU */}
                <td className="px-2 py-2 border-r border-[#E5E7EB] min-w-[220px] max-w-[250px]">
                  <SkuCell item={item} />
                </td>

                {/* MEASURE */}
                {/* Cursor: wire onChange to PATCH item.measure */}
                <td className="px-2 py-2 border-r border-[#E5E7EB] text-center">
                  <input type="number" defaultValue={item.measure} className="w-12 h-6 text-center text-[11px] font-medium text-[#374151] bg-[#F5F7FA] border border-[#E5E7EB] rounded focus:outline-none focus:ring-1 focus:ring-[#1D9E75]/50 focus:bg-white" />
                </td>

                {/* UOM */}
                <td className="px-2 py-2 border-r border-[#E5E7EB] whitespace-nowrap text-center">
                  <span className="text-[11px] font-medium text-[#6B7280]">{item.uom}</span>
                </td>

                {/* UNIT PRICE */}
                <td className="px-2 py-2 border-r border-[#E5E7EB] text-right whitespace-nowrap">
                  <span className="text-[11px] font-medium text-[#374151] tabular-nums">{fmt(item.unitPrice)}</span>
                </td>

                {/* LINE TOTAL */}
                <td className="px-2 py-2 border-r border-[#E5E7EB] text-right whitespace-nowrap">
                  <span className="text-[11px] font-bold text-[#1A3C5E] tabular-nums">${fmt(item.lineTotal)}</span>
                </td>

                {/* CA */}
                <td className="px-2 py-2 border-r border-[#E5E7EB] text-center">
                  <TradePair top={ca.top} bottom={ca.bottom} />
                </td>

                {/* LC */}
                <td className="px-2 py-2 border-r border-[#E5E7EB] text-center">
                  <TradePair top={lc.top} bottom={lc.bottom} />
                </td>

                {/* ELEC */}
                <td className="px-2 py-2 border-r border-[#E5E7EB] text-center">
                  <TradePair top={elec.top} bottom={elec.bottom} />
                </td>

                {/* PLUMB */}
                <td className="px-2 py-2 border-r border-[#E5E7EB] text-center">
                  <TradePair top={plumb.top} bottom={plumb.bottom} />
                </td>

                {/* FINAL PRICE */}
                <td className="px-2 py-2 border-r border-[#E5E7EB] text-right whitespace-nowrap">
                  <span className="text-[11px] font-bold text-[#1D9E75] tabular-nums">${fmt(item.finalPrice)}</span>
                </td>

                {/* SUPPLIER */}
                <td className="px-2 py-2 border-r border-[#E5E7EB] whitespace-nowrap">
                  <span className="text-[11px] text-[#374151]">{item.supplier ?? "—"}</span>
                </td>

                {/* NOTES / ACTIONS */}
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1">
                    {/* Cursor: wire onClick to open notes panel for this line item */}
                    <button className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
                      item.hasNotes ? "text-[#1D9E75] bg-[#e6f7f2]" : "text-[#6B7280] hover:text-[#374151] hover:bg-[#F5F7FA]"
                    }`}>
                      <FileText className="h-3.5 w-3.5" />
                    </button>
                    {/* Cursor: wire onClick to context menu for this line item */}
                    <button className="h-6 w-6 flex items-center justify-center rounded text-[#6B7280] hover:text-[#374151] hover:bg-[#F5F7FA] transition-colors">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
