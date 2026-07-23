// =============================================================================
// ProjectForm — Project Detail page
// =============================================================================
// Props: project (Project)
// Cursor: initialise each useState from props. Wire handleSave to your
// PATCH /api/projects/:id server action or API route.
// =============================================================================

"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, LayoutDashboard } from "lucide-react"
import type { Project, ProjectStatus, ElevateLevel } from "@/types"

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] mb-1.5">
      {children}
    </label>
  )
}

function Input({ id, value, onChange, placeholder, readOnly, type = "text" }: {
  id?: string; value: string; onChange?: (v: string) => void
  placeholder?: string; readOnly?: boolean; type?: string
}) {
  return (
    <input id={id} type={type} value={value} readOnly={readOnly} placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      className={`w-full h-10 px-3 text-sm text-[#374151] bg-white border border-[#E5E7EB] rounded-lg
        focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]
        transition-colors placeholder:text-[#9CA3AF]
        ${readOnly ? "bg-[#F9FAFB] text-[#9CA3AF] cursor-default" : ""}`} />
  )
}

function Select({ id, value, onChange, options }: {
  id?: string; value: string; onChange?: (v: string) => void; options: string[]
}) {
  return (
    <select id={id} value={value} onChange={(e) => onChange?.(e.target.value)}
      className="w-full h-10 px-3 text-sm text-[#374151] bg-white border border-[#E5E7EB] rounded-lg
        focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]
        transition-colors appearance-none cursor-pointer
        bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236B7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')]
        bg-no-repeat bg-[right_10px_center] bg-[length:18px_18px] pr-9">
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function Textarea({ id, value, onChange, placeholder, rows = 3 }: {
  id?: string; value: string; onChange?: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <textarea id={id} value={value} rows={rows} placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      className="w-full px-3 py-2.5 text-sm text-[#374151] bg-white border border-[#E5E7EB] rounded-lg
        focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]
        transition-colors placeholder:text-[#9CA3AF] resize-none leading-relaxed" />
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2 pb-1">
      <span className="text-xs font-semibold uppercase tracking-widest text-[#1A3C5E]/50">{children}</span>
      <div className="flex-1 h-px bg-[#E5E7EB]" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProjectFormProps {
  project: Project
  onSave?: (updated: Project) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectForm({ project }: ProjectFormProps) {
  // Cursor: replace these with a useForm hook or server action; each maps 1:1
  // to a field in the Project type. Wire handleSave to your PATCH endpoint.
  const [finishLevel, setFinishLevel] = useState<ElevateLevel>(project.finishLevel)
  const [style,       setStyle]       = useState(project.style)
  const [colour,      setColour]      = useState(project.colour)
  const [name,        setName]        = useState(project.name)
  const [status,      setStatus]      = useState<ProjectStatus>(project.status)
  const [description, setDescription] = useState(project.description)
  const [m2Total,     setM2Total]     = useState(String(project.m2Total))
  const [m2Hard,      setM2Hard]      = useState(String(project.m2HardFloor))
  const [m2Soft,      setM2Soft]      = useState(project.m2SoftFloor != null ? String(project.m2SoftFloor) : "")
  const [ceiling,     setCeiling]     = useState(String(project.ceilingHeight))
  const [address,     setAddress]     = useState(project.address)
  const [contact,     setContact]     = useState(project.contact)
  const [phone,       setPhone]       = useState(project.phone)
  const [email,       setEmail]       = useState(project.email)
  const [brief,       setBrief]       = useState(project.brief)
  const [targetStart, setTargetStart] = useState(project.targetStart)
  const [spec2,       setSpec2]       = useState(project.spec2)
  const [spec3,       setSpec3]       = useState(project.spec3)
  const [notes,       setNotes]       = useState(project.notes)
  const [quotedBy,    setQuotedBy]    = useState(project.quotedBy)
  const [quotedOn,    setQuotedOn]    = useState(project.quotedOn)
  const [saved,       setSaved]       = useState(false)

  // Cursor: replace with your actual PATCH server action
  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Sub-header */}
      <div className="bg-white border-b border-[#E5E7EB] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6B7280]">Editing project details</span>
          <span className="text-[#D1D5DB]">·</span>
          <span className="text-xs font-medium text-[#1A3C5E]">{project.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/projects" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] hover:border-[#D1D5DB] transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            All projects
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#1A3C5E] rounded-lg hover:bg-[#1e4a73] transition-colors">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Workbench
          </Link>
        </div>
      </div>

      {/* Form card */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">

          {/* Card header */}
          <div className="px-8 py-5 border-b border-[#E5E7EB] bg-[#F8FAFC]">
            <h2 className="text-base font-semibold text-[#1A3C5E]">Project Details</h2>
            <p className="text-xs text-[#6B7280] mt-0.5">Configure project-wide settings, defaults, and contact information.</p>
          </div>

          <div className="px-8 py-6 space-y-6">

            <SectionTitle>Configuration</SectionTitle>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <Label htmlFor="finish-level">Finish Level</Label>
                <Select id="finish-level" value={finishLevel} onChange={(v) => setFinishLevel(v as ElevateLevel)} options={["Executive", "Premium", "Standard"]} />
              </div>
              <div>
                <Label htmlFor="style">Style</Label>
                <Select id="style" value={style} onChange={setStyle} options={["Kensington", "Harbour", "Pacific"]} />
              </div>
              <div>
                <Label htmlFor="colour">Colour</Label>
                <Input id="colour" value={colour} onChange={setColour} />
              </div>
              <div>
                <Label htmlFor="project-id">Project ID</Label>
                <Input id="project-id" value={String(project.id)} readOnly />
              </div>
            </div>

            <SectionTitle>Identity</SectionTitle>
            <div className="space-y-5">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={setName} />
              </div>
              <div className="grid grid-cols-2 gap-x-6">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select id="status" value={status} onChange={(v) => setStatus(v as ProjectStatus)} options={["Live", "Draft", "Complete", "On Hold"]} />
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={description} onChange={setDescription} rows={3} />
              </div>
            </div>

            <SectionTitle>Dimensions</SectionTitle>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <Label htmlFor="m2-total">m² (Total)</Label>
                <Input id="m2-total" value={m2Total} onChange={setM2Total} />
              </div>
              <div>
                <Label htmlFor="m2-hard">M2 (Hard Floor)</Label>
                <Input id="m2-hard" value={m2Hard} onChange={setM2Hard} />
              </div>
              <div>
                <Label htmlFor="m2-soft">M2 (Soft Floor)</Label>
                <Input id="m2-soft" value={m2Soft} onChange={setM2Soft} placeholder="Optional" />
              </div>
              <div>
                <Label htmlFor="ceiling">Ceiling Height (m)</Label>
                <Input id="ceiling" value={ceiling} onChange={setCeiling} />
              </div>
            </div>

            <SectionTitle>Contact</SectionTitle>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={address} onChange={setAddress} />
              </div>
              <div>
                <Label htmlFor="contact">Contact</Label>
                <Input id="contact" value={contact} onChange={setContact} />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={setPhone} type="tel" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={email} onChange={setEmail} type="email" />
              </div>
            </div>

            <SectionTitle>Brief &amp; Specifications</SectionTitle>
            <div className="space-y-5">
              <div>
                <Label htmlFor="brief">Brief</Label>
                <Textarea id="brief" value={brief} onChange={setBrief} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <div>
                  <Label htmlFor="target-start">Target Start</Label>
                  <Input id="target-start" value={targetStart} onChange={setTargetStart} type="date" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <div>
                  <Label htmlFor="spec2">Spec 2</Label>
                  <Input id="spec2" value={spec2} onChange={setSpec2} placeholder="Optional" />
                </div>
                <div>
                  <Label htmlFor="spec3">Spec 3</Label>
                  <Input id="spec3" value={spec3} onChange={setSpec3} placeholder="Optional" />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={notes} onChange={setNotes} rows={2} placeholder="Internal notes…" />
              </div>
            </div>

            <SectionTitle>Quoting</SectionTitle>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <Label htmlFor="quoted-by">Quoted By</Label>
                <Select id="quoted-by" value={quotedBy} onChange={setQuotedBy} options={["", "Select sales staff", "Mike", "Sarah", "James"]} />
              </div>
              <div>
                <Label htmlFor="quoted-on">Quoted On</Label>
                <Input id="quoted-on" value={quotedOn} onChange={setQuotedOn} type="date" />
              </div>
            </div>
          </div>

          {/* Card footer */}
          <div className="px-8 py-5 bg-[#F8FAFC] border-t border-[#E5E7EB] flex items-center justify-between">
            <p className="text-xs text-[#9CA3AF]">Changes are saved to the project immediately.</p>
            {/* Cursor: wire onClick to your PATCH server action */}
            <button onClick={handleSave} className={`inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              saved ? "bg-[#1D9E75] text-white" : "bg-[#1A3C5E] text-white hover:bg-[#1e4a73]"
            }`}>
              {saved ? "Saved!" : "Save Project"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
