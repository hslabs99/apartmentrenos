// =============================================================================
// DEVFEASIBLE — SHARED TYPE DEFINITIONS
// =============================================================================
// Cursor: replace demo data in lib/mock-data.ts with real API/DB fetches.
// These interfaces define the shape every component expects as props.
// Keep interface names and field names stable — only replace the data source.
// =============================================================================

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export type ElevateLevel = "Executive" | "Premium" | "Standard"
export type AreaStatus = "Live" | "Draft" | "On Hold" | "Complete"
export type ProjectStatus = "Live" | "Draft" | "On Hold" | "Complete" | "Archived"
export type NoteType = "General" | "Escalation" | "Style" | "Other" | "Demolition"
export type TradeTag = "Building" | "Plumbing" | "Electrical" | "Demolition" | "Cleaning" | "Lead Contractor"

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export interface Project {
  id: number
  name: string
  description: string
  status: ProjectStatus
  finishLevel: ElevateLevel
  style: string
  colour: string
  m2Total: number
  m2HardFloor: number
  m2SoftFloor: number | null
  ceilingHeight: number
  address: string
  contact: string
  phone: string
  email: string
  brief: string
  targetStart: string
  spec2: string
  spec3: string
  notes: string
  quotedBy: string
  quotedOn: string
}

// ---------------------------------------------------------------------------
// Workbench — Project header financials
// ---------------------------------------------------------------------------

export interface ProjectTradeTotals {
  painting: number
  ca: number
  lc: number
  elec: number
  plumb: number
}

export interface ProjectFinancials {
  tradeTotals: ProjectTradeTotals
  lineSubTotal: number
  tradeTotal: number
  total: number
  marginPct: number
  margin: number
  grandTotal: number
}

// ---------------------------------------------------------------------------
// Workbench — Area
// ---------------------------------------------------------------------------

export interface AreaTradeTotals {
  ca: number
  lc: number
  elec: number
  plumb: number
}

export interface AreaFinancials {
  tradeTotals: AreaTradeTotals
  lineSubTotal: number
  tradeTotal: number
  total: number
  margin: number
  final: number
}

export interface Area {
  id: number
  name: string
  m2: number | null
  ceilingM: number
  status: AreaStatus
  elevate: ElevateLevel
  styleOverride: string
  colourOverride: string
  demolitionM2: number | null
  demolitionDescription: string
  financials: AreaFinancials
}

// ---------------------------------------------------------------------------
// Workbench — Line items
// ---------------------------------------------------------------------------

export interface LineItemTrades {
  ca: number
  lc: number
  elec: number
  plumb: number
}

export interface LineItem {
  id: number
  included: boolean
  description: string
  source: "Scope" | "Bundled" | "Manual"
  elevate: ElevateLevel
  style: string
  colour: string
  skuCode: string | null
  skuCount: number
  skuDescription: string
  measure: number
  uom: string
  unitPrice: number
  lineTotal: number
  trades: LineItemTrades
  finalPrice: number
  supplier: string | null
  hasNotes: boolean
}

// ---------------------------------------------------------------------------
// Checklist — Scope question + line item
// ---------------------------------------------------------------------------

export interface ScopeQuestion {
  id: number
  text: string
  answer: boolean | null
}

export interface ChecklistLineItem {
  id: number
  skuCode: string
  skuDescription: string
  measure: number
  uom: string
  isNonStd: boolean
  totalPrice: number
  hasNotes: boolean
}

export interface ChecklistArea {
  id: number
  name: string
  nickname: string
  m2: number | null
  ceilingM: number
  status: AreaStatus
  totalPrice: number
  scopeQuestions: ScopeQuestion[]
  lineItems: ChecklistLineItem[]
}

export interface ChecklistProject {
  id: number
  name: string
  m2Total: number
  m2HardFloor: number
  m2SoftFloor: number | null
  ceilingHeight: number
  elevate: ElevateLevel
  style: string
  colour: string
  totalPrice: number
  areas: ChecklistArea[]
}

// ---------------------------------------------------------------------------
// Project Notes
// ---------------------------------------------------------------------------

export interface ProjectNote {
  id: number
  areaName: string
  objectName: string
  type: NoteType
  trades: TradeTag[]
  author: string
  date: string
  text: string
}

// ---------------------------------------------------------------------------
// All Projects list
// ---------------------------------------------------------------------------

export interface ProjectSummary {
  id: number
  name: string
  description: string
  status: ProjectStatus
  workbenchItemCount: number
}
