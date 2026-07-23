// =============================================================================
// ChecklistLineItems — Checklist tab
// =============================================================================
// Props: items (ChecklistLineItem[])
// Cursor: pass area.lineItems from the page.
// Wire each input onChange to PATCH /api/checklist-items/:id.
// =============================================================================

"use client"

import { Calculator, FileText, MoreHorizontal } from "lucide-react"
import type { ChecklistLineItem } from "@/types"

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LabeledCell({ label, children, className = "" }: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <span className="text-[9px] font-bold tracking-wider uppercase text-[#9CA3AF]">{label}</span>
      {children}
    </div>
  )
}

function LineItemRow({ item }: { item: ChecklistLineItem }) {
  const fmt = (n: number) =>
    n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const rowBg = item.isNonStd
    ? "bg-amber-50 hover:bg-amber-100/60"
    : "bg-white hover:bg-[#e6f7f2]/30"

  return (
    <div className={`${rowBg} border-b border-[#E5E7EB] transition-colors px-4 py-2`}>
      <div className="flex items-end gap-2">

        {/* Checkbox */}
        {/* Cursor: wire onChange to PATCH item.included */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] invisible select-none">_</span>
          <div className="h-8 flex items-center">
            <input type="checkbox" className="h-4 w-4 rounded accent-[#1D9E75] cursor-pointer" />
          </div>
        </div>

        {/* SKU / description */}
        {/* Cursor: make this a read-only SKU badge + description text, not editable */}
        <LabeledCell label="SKU" className="flex-1 min-w-0">
          <input type="text" defaultValue={`${item.skuCode} · ${item.skuDescription}`}
            className="h-8 w-full px-2.5 text-sm text-[#374151] bg-white border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/40 transition-all" />
        </LabeledCell>

        {/* Measure */}
        {/* Cursor: wire onChange to PATCH item.measure */}
        <LabeledCell label="Measure">
          <input type="number" defaultValue={item.measure}
            className="h-8 w-16 text-center text-sm font-medium text-[#374151] bg-white border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/40 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
        </LabeledCell>

        {/* UOM */}
        <LabeledCell label="UOM">
          <div className="h-8 w-14 flex items-center justify-center bg-[#F5F7FA] border border-[#E5E7EB] rounded-lg">
            <span className="text-xs font-medium text-[#6B7280]">{item.uom}</span>
          </div>
        </LabeledCell>

        {/* Non Std toggle */}
        {/* Cursor: wire onClick to PATCH item.isNonStd */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] invisible select-none">_</span>
          <button className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
            item.isNonStd
              ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
              : "bg-[#F5F7FA] border-[#E5E7EB] text-[#9CA3AF] hover:border-[#D1D5DB] hover:text-[#6B7280]"
          }`}>
            Non Std
          </button>
        </div>

        {/* Total price */}
        <LabeledCell label="Total Price" className="w-20 items-end">
          <div className="h-8 flex items-center justify-end">
            <span className={`text-sm font-bold tabular-nums ${
              item.isNonStd ? "text-[#9CA3AF]" : "text-[#1D9E75]"
            }`}>
              {item.totalPrice === 0 ? "0.00" : fmt(item.totalPrice)}
            </span>
          </div>
        </LabeledCell>

        {/* Action icons */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] invisible select-none">_</span>
          <div className="flex items-center gap-1 h-8">
            {/* Cursor: wire onClick to open notes panel for this line item */}
            <button title="Notes" className={`h-7 w-7 flex items-center justify-center rounded-md border transition-colors ${
              item.hasNotes
                ? "bg-[#e6f7f2] border-[#1D9E75]/30 text-[#1D9E75]"
                : "bg-white border-[#E5E7EB] text-[#9CA3AF] hover:text-[#6B7280] hover:border-[#D1D5DB]"
            }`}>
              <FileText className="h-3.5 w-3.5" />
            </button>
            {/* Cursor: wire onClick to open calculator for this item */}
            <button title="Calculator" className="h-7 w-7 flex items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#9CA3AF] hover:text-[#6B7280] hover:border-[#D1D5DB] transition-colors">
              <Calculator className="h-3.5 w-3.5" />
            </button>
            {/* Cursor: wire onClick to context menu for this item */}
            <button title="More options" className="h-7 w-7 flex items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#9CA3AF] hover:text-[#6B7280] hover:border-[#D1D5DB] transition-colors">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChecklistLineItemsProps {
  items: ChecklistLineItem[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChecklistLineItems({ items }: ChecklistLineItemsProps) {
  return (
    <div className="bg-white">
      {items.map((item) => (
        <LineItemRow key={item.id} item={item} />
      ))}
    </div>
  )
}
