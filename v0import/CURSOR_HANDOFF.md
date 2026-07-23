# DevFeasible Workbench — Cursor Handoff

## What This Is

A fully rendered, navigable visual design mock-up for the project management tool. Every page
renders correctly with hard-coded demo data. Your task is to integrate these panels into the
existing Next.js app by replacing demo data with real API calls, mapping tokens, and dropping
the content panels into your existing route/layout tree.

Read this document fully before touching any code.

---

## Stack Constraints (your existing app — do not change these)

| Constraint | Rule |
|---|---|
| Framework | Next.js 16 App Router + React 19 + TypeScript strict |
| Import alias | `@/*` → `./src/*` — move all files under `src/` when integrating |
| Data fetching | `"use client"` + `fetch("/api/...")` in `useEffect` → `useState` only |
| State libraries | None — plain `useState`/`useEffect`. No SWR, React Query, tRPC |
| Auth / shell | Use existing `AuthGuard` + `AppShell`. Do NOT use `TopNav` or `AppShell` from this mock — they are design references only |
| Styling | Map v0 tokens → your existing `sf-*` tokens (table below). Prefer existing Tailwind utilities |
| New dependencies | None unless unavoidable |
| New routes | Do not invent — fit under existing `src/app/(app)/...` paths |
| Panels vs pages | Every file in `app/` exports a **content panel only**. Cursor drops it inside your existing layout |

---

## Token Mapping

Replace v0 tokens with your existing `sf-*` token names in every component file.
Find-and-replace each value across `components/`.

| v0 Tailwind class / hex | Maps to your token | Usage |
|---|---|---|
| `bg-[#1A3C5E]` / `text-[#1A3C5E]` | `bg-sf-brand` / `text-sf-brand` | Nav bar, col headers, project name, headings |
| `bg-[#1e4a73]` | `bg-sf-brand/90` (hover) | Navy hover states |
| `text-[#1D9E75]` / `bg-[#1D9E75]` | `text-sf-accent` / `bg-sf-accent` | Teal: final prices, totals, CTA buttons, active states |
| `bg-[#e6f7f2]` | `bg-sf-accent/10` | Teal tint backgrounds |
| `bg-[#F5F7FA]` | `bg-sf-bg` | Page background |
| `bg-white` | `bg-sf-surface` | Cards, panels, inputs |
| `border-[#E5E7EB]` | `border-sf-border` | All borders |
| `text-[#374151]` | `text-sf-text` | Body text, input values |
| `text-[#6B7280]` | `text-sf-text-muted` | Labels, helper text |
| `bg-amber-50` / `text-amber-700` | Keep as-is (or map to sf-warning if defined) | Demolition rows |

Run a global find-and-replace across all files in `components/` once mappings are confirmed.

---

## File Structure (as downloaded)

```
types/
  index.ts              ← All TypeScript interfaces. Copy to src/types/index.ts

lib/
  mock-data.ts          ← Plain sync constants used as useState defaults.
                          Copy to src/lib/mock-data.ts.
                          Each constant is replaced by a fetch() call.

components/
  workbench/
    top-nav.tsx         ← DESIGN REFERENCE ONLY — do not use in app
    project-header.tsx  ← Copy to src/components/workbench/project-header.tsx
    area-header.tsx     ← Copy to src/components/workbench/area-header.tsx
    workbench-table.tsx ← Copy to src/components/workbench/workbench-table.tsx
  checklist/
    checklist-project-panel.tsx
    checklist-area-header.tsx
    checklist-line-items.tsx
    floating-info-bar.tsx
  project/
    project-form.tsx
  project-notes/
    project-notes.tsx
  app-shell/
    app-shell.tsx       ← DESIGN REFERENCE ONLY — do not use in app
    projects-list.tsx   ← Copy to src/components/app-shell/projects-list.tsx

app/                    ← Each file = content panel only. Copy body to your route.
  page.tsx              → Workbench panel
  checklist/page.tsx    → Checklist panel
  project/page.tsx      → Project detail panel
  project-notes/page.tsx→ Project notes panel
  projects/page.tsx     → All projects panel
```

---

## Integration Steps (in order)

### Step 1 — Copy files into src/

Copy everything under `components/`, `lib/`, and `types/` into your `src/` tree.
Skip `top-nav.tsx` and `app-shell.tsx` — these are design references only.

### Step 2 — Run token find-and-replace

Use the table above to replace all v0 hex tokens with your `sf-*` Tailwind tokens
across every file in `src/components/`.

### Step 3 — Wire routes

For each panel below, copy the component returned from the panel's `app/` page file
into your existing route page file. Wrap it with your `AuthGuard` + `AppShell` as normal.
Remove the `TopNav` import — your layout already handles the shell.

| Panel | Target route | File to copy content from |
|---|---|---|
| All Projects | `src/app/(app)/projects/page.tsx` | `app/projects/page.tsx` |
| Project Detail | `src/app/(app)/project/[id]/page.tsx` | `app/project/page.tsx` |
| Checklist | `src/app/(app)/checklist/[id]/page.tsx` | `app/checklist/page.tsx` |
| Project Notes | `src/app/(app)/project/[id]/notes/page.tsx` | `app/project-notes/page.tsx` |
| Workbench | `src/app/(app)/workbench/[id]/page.tsx` | `app/page.tsx` |

### Step 4 — Add projectId from route params

Every panel has a `// Cursor: receive projectId from route params` comment.
Replace the implicit PROJECT_ID with the real param:
```tsx
// Next.js 16 — params must be awaited
export default async function WorkbenchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <WorkbenchPanel projectId={Number(id)} />
}
```
Add `projectId: number` to each panel's props and thread it into the `useEffect` deps.

### Step 5 — Replace mock data with fetch calls

In each panel, find the `// Cursor: replace with real fetch` comment block.
Replace the empty `useEffect` body with your real `fetch("/api/...")` call.
The `useState` default (from `lib/mock-data.ts`) renders immediately while
loading — you can add a loading spinner later.

Pattern for every panel:
```tsx
useEffect(() => {
  fetch(`/api/projects/${projectId}`)
    .then(r => r.json())
    .then(setProject)
}, [projectId])
```

### Step 6 — Wire mutations

| Panel | Mutation | Where to find the hook |
|---|---|---|
| Project Detail | `PATCH /api/projects/:id` | `handleSave` in `ProjectForm` |
| Project Notes | `POST`, `PATCH`, `DELETE /api/notes/...` | `onAdd`, `onSave`, `onDelete` in `ProjectNotes` |
| Checklist | Measure field changes → `PATCH /api/items/:id` | `onChange` on inputs in `ChecklistLineItems` |
| Workbench | Line item edits → `PATCH /api/items/:id` | `onChange` handlers in `WorkbenchTable` |

### Step 7 — Update card links in ProjectsList

In `projects-list.tsx`, update the three `href` values in each card to use the real `id`:
```tsx
// Find these three lines and add /[project.id]:
href={`/project/${project.id}`}
href={`/checklist/${project.id}`}
href={`/workbench/${project.id}`}
```

### Step 8 — Checklist floating bar scroll tracking

In `ChecklistPanel`, replace the empty IntersectionObserver comment with:
```tsx
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.find(e => e.isIntersecting)
      if (visible) setActiveAreaId(Number(visible.target.id.replace("area-", "")))
    },
    { threshold: 0.3 }
  )
  document.querySelectorAll("[id^='area-']").forEach(el => observer.observe(el))
  return () => observer.disconnect()
}, [project])
```

---

## Component Prop Interfaces

All types are in `src/types/index.ts`. Key interfaces:

```
Project             — project detail form fields
ProjectFinancials   — workbench project-level financial totals
Area                — workbench area record + financials
LineItem            — workbench line item row
ChecklistProject    — checklist project with nested areas + line items
ChecklistArea       — checklist area with scope questions + line items
ChecklistLineItem   — checklist item row
ProjectNote         — a single note
ProjectSummary      — compact project for the all-projects list card
```

---

## Hard Constraints — Do Not Change

- **Workbench is desktop-only** — no responsive breakpoints on workbench components
- **Checklist, Project, Project Notes are tablet-optimized** — min 1180×820px landscape; touch targets 28–32px min
- **Field order in workbench table rows is fixed** — do not reorder columns
- **Notes icon always before three-dot menu** — everywhere in the app
- **Trade draft tags** (PAINTING, CA, LC, ELEC, PLUMB) are intentionally small and muted — informational only, not primary totals
- **Margin % uses custom up/down chevron buttons** — do not replace with native `<input type="number">`
- **No new UI libraries** — use plain controlled inputs and Tailwind only

---

## Currency Formatting

All prices in the TypeScript interfaces are plain `number`. Format for display with:
```ts
export function fmt(n: number): string {
  return "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
```
Place this in `src/lib/utils.ts` alongside the existing `cn` utility.
