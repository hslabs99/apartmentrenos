// =============================================================================
// FloatingInfoBar — Checklist tab
// =============================================================================
// Props: areaName, areaTotal, projectTotal (all pre-formatted currency strings)
// Cursor: derive these from the active area + project totals in state.
// =============================================================================

"use client"

export interface FloatingInfoBarProps {
  areaName: string
  areaTotal: string
  projectTotal: string
}

export function FloatingInfoBar({ areaName, areaTotal, projectTotal }: FloatingInfoBarProps) {
  return (
    <div className="fixed bottom-5 left-5 z-50 rounded-xl bg-white/90 backdrop-blur-sm border border-[#E5E7EB] shadow-lg shadow-black/10 overflow-hidden min-w-[168px]">
      {/* Area section */}
      <div className="px-4 pt-3 pb-2 border-b border-[#E5E7EB]/70">
        <span className="text-[9px] font-bold tracking-widest uppercase text-[#9CA3AF] block mb-0.5">Area</span>
        <span className="text-sm font-bold text-[#1A3C5E] block leading-tight">{areaName}</span>
        <span className="text-[9px] font-semibold tracking-wider uppercase text-[#9CA3AF] block mt-1.5">Area Total</span>
        <span className="text-base font-bold text-[#1D9E75] tabular-nums block">{areaTotal}</span>
      </div>
      {/* Project total section */}
      <div className="px-4 pt-2 pb-3">
        <span className="text-[9px] font-bold tracking-widest uppercase text-[#9CA3AF] block mb-0.5">Project Total</span>
        <span className="text-base font-bold text-[#1A3C5E] tabular-nums block">{projectTotal}</span>
      </div>
      <div className="h-0.5 bg-[#1D9E75]" />
    </div>
  )
}
