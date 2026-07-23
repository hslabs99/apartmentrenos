// =============================================================================
// ProjectNotes — Project Notes page
// =============================================================================
// Props:
//   initialNotes  — ProjectNote[] from DB, used as initial React state
//   areas         — string[] for the area filter dropdown
//   objects       — string[] for the object filter dropdown
//
// Cursor: wire Save and Add actions to real PATCH/POST server actions.
// Wire Delete to DELETE /api/notes/:id. Filter dropdowns should stay
// client-side unless you want server-side filtering via router.push.
// =============================================================================

"use client"

import { useState } from "react"
import { Printer, Trash2, Save } from "lucide-react"
import type { ProjectNote, NoteType, TradeTag } from "@/types"

// ---------------------------------------------------------------------------
// Constants (Cursor: can also drive these from DB enums)
// ---------------------------------------------------------------------------

const ALL_TYPES: NoteType[] = ["Escalation", "General", "Other", "Style"]
const ALL_TRADES: TradeTag[] = ["Building", "Plumbing", "Electrical", "Demolition", "Cleaning", "Lead Contractor"]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TradeChip({ trade, active, onClick, variant = "filter" }: {
  trade: TradeTag; active: boolean; onClick: () => void; variant?: "filter" | "edit"
}) {
  const base = "px-3 py-1 rounded-full text-xs font-medium border transition-colors"
  if (variant === "edit") {
    return (
      <button onClick={onClick} className={`${base} ${active ? "bg-[#1D9E75] text-white border-[#1D9E75]" : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#1D9E75] hover:text-[#1D9E75]"}`}>
        {trade}
      </button>
    )
  }
  return (
    <button onClick={onClick} className={`${base} ${active ? "bg-[#1A3C5E] text-white border-[#1A3C5E]" : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#1A3C5E] hover:text-[#1A3C5E]"}`}>
      {trade}
    </button>
  )
}

function TypeChip({ type, active, onClick }: { type: NoteType; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
      active ? "bg-[#1A3C5E] text-white border-[#1A3C5E]" : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#1A3C5E] hover:text-[#1A3C5E]"
    }`}>
      {type}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProjectNotesProps {
  initialNotes: ProjectNote[]
  areas: string[]
  objects: string[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectNotes({ initialNotes, areas, objects }: ProjectNotesProps) {
  const [notes, setNotes] = useState<ProjectNote[]>(initialNotes)
  const [selectedId, setSelectedId] = useState<number>(initialNotes[0]?.id ?? 0)

  // Filter state
  const [filterArea,   setFilterArea]   = useState("All areas")
  const [filterObject, setFilterObject] = useState("All objects")
  const [activeTypes,  setActiveTypes]  = useState<NoteType[]>([])
  const [activeTrades, setActiveTrades] = useState<TradeTag[]>([])

  // New note state
  const [newType,   setNewType]   = useState<NoteType>("General")
  const [newTrades, setNewTrades] = useState<TradeTag[]>([])
  const [newText,   setNewText]   = useState("")

  const selectedNote = notes.find((n) => n.id === selectedId) ?? notes[0]

  // Filtering
  const filteredNotes = notes.filter((n) => {
    if (filterArea   !== "All areas"   && n.areaName   !== filterArea)   return false
    if (filterObject !== "All objects" && n.objectName !== filterObject) return false
    if (activeTypes.length  > 0 && !activeTypes.includes(n.type))                       return false
    if (activeTrades.length > 0 && !activeTrades.some((t) => n.trades.includes(t)))     return false
    return true
  })

  const toggleType  = (t: NoteType)  => setActiveTypes( (p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t])
  const toggleTrade = (t: TradeTag)  => setActiveTrades((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t])

  // Selected note editing
  const updateSelected = (patch: Partial<ProjectNote>) =>
    setNotes((prev) => prev.map((n) => n.id === selectedNote.id ? { ...n, ...patch } : n))

  const toggleSelectedTrade = (t: TradeTag) => {
    const next = selectedNote.trades.includes(t)
      ? selectedNote.trades.filter((x) => x !== t)
      : [...selectedNote.trades, t]
    updateSelected({ trades: next })
  }

  // Cursor: wire to DELETE /api/notes/:id server action
  const deleteSelected = () => {
    const remaining = notes.filter((n) => n.id !== selectedNote.id)
    setNotes(remaining)
    if (remaining.length > 0) setSelectedId(remaining[0].id)
  }

  // Cursor: wire to POST /api/notes server action
  const addNote = () => {
    if (!newText.trim()) return
    const note: ProjectNote = {
      id: Date.now(),
      areaName:   filterArea   === "All areas"   ? "General" : filterArea,
      objectName: filterObject === "All objects" ? "—"       : filterObject,
      type:       newType,
      trades:     newTrades,
      author:     "mike",
      date:       new Date().toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" }),
      text:       newText,
    }
    setNotes((prev) => [note, ...prev])
    setSelectedId(note.id)
    setNewText("")
    setNewTrades([])
    setNewType("General")
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 88px)" }}>

      {/* Sub-header: filters */}
      <div className="bg-white border-b border-[#E5E7EB] px-4 lg:px-6 py-3 space-y-2.5 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          {/* Area filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#6B7280] uppercase tracking-wide whitespace-nowrap">Area</label>
            {/* Cursor: wire onChange to update URL param if server-side filtering is needed */}
            <select value={filterArea} onChange={(e) => { setFilterArea(e.target.value); setFilterObject("All objects") }}
              className="text-sm border border-[#E5E7EB] rounded-md px-2.5 py-1.5 bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/20 focus:border-[#1A3C5E]">
              {areas.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
          {/* Object filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#6B7280] uppercase tracking-wide whitespace-nowrap">Object</label>
            <select value={filterObject} onChange={(e) => setFilterObject(e.target.value)}
              className="text-sm border border-[#E5E7EB] rounded-md px-2.5 py-1.5 bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/20 focus:border-[#1A3C5E]">
              {objects.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <span className="text-xs text-[#9CA3AF] ml-1">{filteredNotes.length} note{filteredNotes.length !== 1 ? "s" : ""}</span>
          <div className="ml-auto">
            {/* Cursor: wire onClick to your print/export function */}
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#E5E7EB] rounded-md text-[#374151] bg-white hover:bg-[#F5F7FA] transition-colors">
              <Printer className="h-3.5 w-3.5" />
              Print report
            </button>
          </div>
        </div>

        {/* Type chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mr-1">Type</span>
          {ALL_TYPES.map((t) => <TypeChip key={t} type={t} active={activeTypes.includes(t)} onClick={() => toggleType(t)} />)}
        </div>

        {/* Trade chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mr-1">Trades</span>
          {ALL_TRADES.map((t) => <TradeChip key={t} trade={t} active={activeTrades.includes(t)} onClick={() => toggleTrade(t)} />)}
        </div>
      </div>

      {/* Main body: split panels */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Notes list */}
        <div className="w-full lg:w-80 xl:w-96 border-r border-[#E5E7EB] bg-white flex flex-col shrink-0 overflow-hidden">
          <div className="px-4 pt-3 pb-1.5 shrink-0">
            <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-widest">Notes</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredNotes.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[#9CA3AF]">No notes match the current filters.</div>
            ) : (
              filteredNotes.map((note) => {
                const isSelected = note.id === selectedNote?.id
                return (
                  <button key={note.id} onClick={() => setSelectedId(note.id)}
                    className={`w-full text-left px-4 py-3 border-b border-[#F3F4F6] transition-colors ${isSelected ? "bg-[#E6F7F2]" : "hover:bg-[#F9FAFB]"}`}>
                    <p className={`text-sm font-semibold truncate ${isSelected ? "text-[#1A3C5E]" : "text-[#111827]"}`}>
                      {note.text.slice(0, 24)}{note.text.length > 24 ? "…" : ""}
                    </p>
                    <p className="text-xs text-[#9CA3AF] mt-0.5 truncate">
                      {note.type}{note.trades.length > 0 ? ` · ${note.trades.join(", ")}` : " · —"}
                    </p>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* RIGHT: selected note + add note */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Selected note panel */}
          {selectedNote && (
            <div className="flex-1 overflow-y-auto bg-white px-5 lg:px-8 py-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest">Selected note</h2>
                <div className="flex items-center gap-2">
                  {/* Cursor: wire onClick to PATCH /api/notes/:id server action */}
                  <button onClick={() => updateSelected({})} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#1D9E75] text-white rounded-md hover:bg-[#18896a] transition-colors">
                    <Save className="h-3 w-3" />
                    Save
                  </button>
                  {/* Cursor: wire onClick to DELETE /api/notes/:id server action */}
                  <button onClick={deleteSelected} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#E5E7EB] text-[#DC2626] rounded-md hover:bg-red-50 transition-colors">
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-[120px_1fr] gap-y-4 gap-x-4 items-start max-w-2xl">
                <span className="text-sm text-[#6B7280] pt-0.5">Area</span>
                <span className="text-sm font-medium text-[#111827]">{selectedNote.areaName}</span>

                <span className="text-sm text-[#6B7280] pt-0.5">Object</span>
                <span className="text-sm font-medium text-[#111827]">{selectedNote.objectName}</span>

                <span className="text-sm text-[#6B7280] pt-0.5">Type</span>
                <select value={selectedNote.type} onChange={(e) => updateSelected({ type: e.target.value as NoteType })}
                  className="text-sm border border-[#E5E7EB] rounded-md px-2.5 py-1.5 bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/20 focus:border-[#1A3C5E] w-40">
                  {ALL_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>

                <span className="text-sm text-[#6B7280] pt-1.5">
                  Trades
                  <span className="block text-xs text-[#9CA3AF] font-normal">(optional)</span>
                </span>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {ALL_TRADES.map((t) => (
                    <TradeChip key={t} trade={t} active={selectedNote.trades.includes(t)} onClick={() => toggleSelectedTrade(t)} variant="edit" />
                  ))}
                </div>

                <span className="text-sm text-[#6B7280] pt-0.5">Author</span>
                <span className="text-sm font-medium text-[#111827]">{selectedNote.author}</span>

                <span className="text-sm text-[#6B7280] pt-0.5">Date</span>
                <span className="text-sm text-[#374151]">{selectedNote.date}</span>

                <span className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest pt-2">Note</span>
                <textarea value={selectedNote.text} onChange={(e) => updateSelected({ text: e.target.value })} rows={5}
                  className="w-full text-sm border border-[#E5E7EB] rounded-md px-3 py-2.5 text-[#374151] resize-none focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/20 focus:border-[#1A3C5E] leading-relaxed" />
              </div>
            </div>
          )}

          <div className="h-px bg-[#E5E7EB] shrink-0" />

          {/* Add new note panel */}
          <div className="bg-[#FFFBEB] border-t border-[#FDE68A] px-5 lg:px-8 py-5 shrink-0">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-[#111827]">Add new note</h2>
              <p className="text-xs text-[#1D9E75] mt-0.5">Saves to Project</p>
            </div>
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-3">
                <label className="text-sm text-[#6B7280] w-12 shrink-0">Type</label>
                <select value={newType} onChange={(e) => setNewType(e.target.value as NoteType)}
                  className="text-sm border border-[#E5E7EB] rounded-md px-2.5 py-1.5 bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#D97706]/20 focus:border-[#D97706] flex-1">
                  {ALL_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm text-[#6B7280] w-12 shrink-0 pt-1">
                  Trades
                  <span className="block text-xs text-[#9CA3AF]">(optional)</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {ALL_TRADES.map((t) => (
                    <TradeChip key={t} trade={t} active={newTrades.includes(t)}
                      onClick={() => setNewTrades((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t])}
                      variant="edit" />
                  ))}
                </div>
              </div>
              <textarea value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="Note text..." rows={3}
                className="w-full text-sm border border-[#E5E7EB] rounded-md px-3 py-2.5 text-[#374151] placeholder:text-[#9CA3AF] resize-none bg-white focus:outline-none focus:ring-2 focus:ring-[#D97706]/20 focus:border-[#D97706] leading-relaxed" />
              {/* Cursor: wire onClick to POST /api/notes server action */}
              <button onClick={addNote} disabled={!newText.trim()}
                className="px-5 py-2 text-sm font-semibold bg-[#1D9E75] text-white rounded-md hover:bg-[#18896a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Add note
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
