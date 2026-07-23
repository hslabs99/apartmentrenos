// =============================================================================
// PROJECT NOTES PANEL — tablet landscape + desktop
// =============================================================================
// Cursor integration notes:
//
// 1. Move to: src/app/(app)/project/[id]/notes/page.tsx (or your existing path)
//
// 2. Pure content panel — no TopNav, no AppShell. Wrap externally.
//
// 3. Load:   GET  /api/projects/:id/notes          → setNotes
//            GET  /api/projects/:id/notes/areas     → setAreas
//            GET  /api/projects/:id/notes/objects   → setObjects
//    Save:   PATCH /api/notes/:noteId
//    Delete: DELETE /api/notes/:noteId
//    Create: POST  /api/projects/:id/notes
//
// 4. ProjectNotes calls onSave(note), onDelete(id), onAdd(newNote) — wire those.
// =============================================================================

"use client"

import { useState, useEffect } from "react"
import { TopNav } from "@/components/workbench/top-nav"
import { ProjectNotes } from "@/components/project-notes/project-notes"
import { MOCK_NOTES, MOCK_NOTE_AREAS, MOCK_NOTE_OBJECTS } from "@/lib/mock-data"
import type { ProjectNote } from "@/types"

// Cursor: receive projectId from route params
export default function ProjectNotesPanel() {
  const [notes, setNotes]     = useState<ProjectNote[]>(MOCK_NOTES)
  const [areas, setAreas]     = useState<string[]>(MOCK_NOTE_AREAS)
  const [objects, setObjects] = useState<string[]>(MOCK_NOTE_OBJECTS)

  // -------------------------------------------------------------------------
  // Cursor: replace with real fetches, e.g.:
  //
  // useEffect(() => {
  //   Promise.all([
  //     fetch(`/api/projects/${projectId}/notes`).then(r => r.json()),
  //     fetch(`/api/projects/${projectId}/notes/areas`).then(r => r.json()),
  //     fetch(`/api/projects/${projectId}/notes/objects`).then(r => r.json()),
  //   ]).then(([notes, areas, objects]) => {
  //     setNotes(notes)
  //     setAreas(areas)
  //     setObjects(objects)
  //   })
  // }, [projectId])
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F5F7FA]">
      <TopNav />
      <ProjectNotes
        initialNotes={notes}
        areas={areas}
        objects={objects}
      />
    </div>
  )
}
