// =============================================================================
// DEVFEASIBLE — MOCK / DEFAULT DATA
// =============================================================================
// These are plain synchronous constants used as useState() defaults so the UI
// renders immediately in the mock. When wiring to your backend, replace the
// value of each constant with the result of your fetch("/api/...") call inside
// a useEffect, keeping the same shape.
//
// All types are defined in src/types/index.ts — import from there.
// =============================================================================

import type {
  Project,
  ProjectFinancials,
  Area,
  LineItem,
  ChecklistProject,
  ProjectNote,
  ProjectSummary,
} from "@/types"

// ---------------------------------------------------------------------------
// All Projects list
// ---------------------------------------------------------------------------

export const MOCK_PROJECTS: ProjectSummary[] = [
  {
    id: 14,
    name: "404-85 Beach Rd",
    description: "Test of high end look Executive fit out in a 40m2 1 bedroom apartment",
    status: "Live",
    workbenchItemCount: 7,
  },
  {
    id: 15,
    name: "Small Test",
    description: "",
    status: "Draft",
    workbenchItemCount: 4,
  },
  {
    id: 16,
    name: "Test Apartment Mike Dev",
    description: "",
    status: "Draft",
    workbenchItemCount: 3,
  },
]

// ---------------------------------------------------------------------------
// Project detail
// ---------------------------------------------------------------------------

export const MOCK_PROJECT: Project = {
  id: 14,
  name: "404-85 Beach Rd",
  description: "Test of high end look Executive fit out in a 40m2 1 bedroom apartment",
  status: "Live",
  finishLevel: "Executive",
  style: "Kensington",
  colour: "GM-H",
  m2Total: 39,
  m2HardFloor: 32,
  m2SoftFloor: null,
  ceilingHeight: 2400,
  address: "404/85 Beach Road (The Beach)",
  contact: "Ephraim Smith",
  phone: "0275514911",
  email: "ephraim@eeq.co.nz",
  brief: "",
  targetStart: "",
  spec2: "",
  spec3: "",
  notes: "",
  quotedBy: "",
  quotedOn: "",
}

// ---------------------------------------------------------------------------
// Workbench — project financials
// ---------------------------------------------------------------------------

export const MOCK_PROJECT_FINANCIALS: ProjectFinancials = {
  tradeTotals: { painting: 1500, ca: 341.25, lc: 1824.75, elec: 4768.5, plumb: 285 },
  lineSubTotal: 29961.8,
  tradeTotal: 8719.5,
  total: 38681.32,
  marginPct: 25,
  margin: 9670.37,
  grandTotal: 48351.69,
}

// ---------------------------------------------------------------------------
// Workbench — areas
// ---------------------------------------------------------------------------

export const MOCK_AREAS: Area[] = [
  {
    id: 1,
    name: "Kitchen",
    m2: null,
    ceilingM: 2400,
    status: "Live",
    elevate: "Executive",
    styleOverride: "Default (project)",
    colourOverride: "Default (project · GM-H)",
    demolitionM2: 3250,
    demolitionDescription: "FULL KITCHEN CABINETS & BENCH · NEW · L...",
    financials: {
      tradeTotals: { ca: 131.25, lc: 519.75, elec: 1963.5, plumb: 190 },
      lineSubTotal: 11762.28,
      tradeTotal: 2804.5,
      total: 14566.79,
      margin: 3641.71,
      final: 18208.5,
    },
  },
]

// ---------------------------------------------------------------------------
// Workbench — line items (for first area)
// ---------------------------------------------------------------------------

export const MOCK_LINE_ITEMS: LineItem[] = [
  {
    id: 1,
    included: true,
    description: "Hob",
    source: "Scope",
    elevate: "Executive",
    style: "Area default · Kensington",
    colour: "Default (project · GM-H)",
    skuCode: "SK00414",
    skuCount: 2,
    skuDescription: "Ceramic Touch No Brand 4 Burner · $955.65 (Noel...)",
    measure: 1,
    uom: "Unit",
    unitPrice: 955.65,
    lineTotal: 955.65,
    trades: { ca: 17.5, lc: 0, elec: 170, plumb: 0 },
    finalPrice: 1428.94,
    supplier: "Noel Leeming (P1)",
    hasNotes: true,
  },
  {
    id: 2,
    included: true,
    description: "Oven",
    source: "Scope",
    elevate: "Executive",
    style: "Area default · Kensington",
    colour: "Default (project · GM-H)",
    skuCode: "SK00420",
    skuCount: 2,
    skuDescription: "Standard Branded Digital 600mm Oven · $781.74 (...)",
    measure: 1,
    uom: "Unit",
    unitPrice: 781.74,
    lineTotal: 781.74,
    trades: { ca: 17.5, lc: 0, elec: 170, plumb: 0 },
    finalPrice: 1211.55,
    supplier: "Noel Leeming (P1)",
    hasNotes: false,
  },
  {
    id: 3,
    included: true,
    description: "Dishwasher",
    source: "Scope",
    elevate: "Executive",
    style: "Area default · Kensington",
    colour: "Default (project · GM-H)",
    skuCode: "SK01119",
    skuCount: 1,
    skuDescription: "Free Standing Std Black 600 · $703.48 (Trade Depot)",
    measure: 1,
    uom: "Unit",
    unitPrice: 703.48,
    lineTotal: 703.48,
    trades: { ca: 17.5, lc: 80, elec: 85, plumb: 85 },
    finalPrice: 1238.72,
    supplier: "Trade Depot (P1)",
    hasNotes: false,
  },
  {
    id: 4,
    included: true,
    description: "Fridge Freezer",
    source: "Scope",
    elevate: "Executive",
    style: "Area default · Kensington",
    colour: "Default (project · GM-H)",
    skuCode: "SK00979",
    skuCount: 4,
    skuDescription: "Small Black SS 250-350L 1645-1700H · $1,129.57...",
    measure: 1,
    uom: "Unit",
    unitPrice: 1129.57,
    lineTotal: 1129.57,
    trades: { ca: 35, lc: 45, elec: 85, plumb: 0 },
    finalPrice: 1618.21,
    supplier: "Noel Leeming (P1)",
    hasNotes: false,
  },
  {
    id: 5,
    included: true,
    description: "Rangehood",
    source: "Scope",
    elevate: "Executive",
    style: "Area default · Kensington",
    colour: "Default (project · GM-H)",
    skuCode: "SK00441",
    skuCount: 1,
    skuDescription: "Integrated SS 52cm · $233.91 (Trade Depot)",
    measure: 1,
    uom: "Unit",
    unitPrice: 233.91,
    lineTotal: 233.91,
    trades: { ca: 17.5, lc: 45, elec: 170, plumb: 0 },
    finalPrice: 583.01,
    supplier: "Trade Depot (P1)",
    hasNotes: false,
  },
  {
    id: 6,
    included: true,
    description: "Demolition",
    source: "Scope",
    elevate: "Executive",
    style: "Area default · Kensington",
    colour: "Default (project · GM-H)",
    skuCode: null,
    skuCount: 0,
    skuDescription: "",
    measure: 6,
    uom: "M2",
    unitPrice: 25.25,
    lineTotal: 151.5,
    trades: { ca: 0, lc: 0, elec: 0, plumb: 0 },
    finalPrice: 189.38,
    supplier: null,
    hasNotes: false,
  },
]

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export const MOCK_CHECKLIST_PROJECT: ChecklistProject = {
  id: 14,
  name: "404-85 Beach Rd",
  m2Total: 39,
  m2HardFloor: 32,
  m2SoftFloor: null,
  ceilingHeight: 2400,
  elevate: "Executive",
  style: "Kensington",
  colour: "GM-H",
  totalPrice: 45214.83,
  areas: [
    {
      id: 1,
      name: "Kitchen",
      nickname: "",
      m2: null,
      ceilingM: 2400,
      status: "Live",
      totalPrice: 16905.86,
      scopeQuestions: [],
      lineItems: [
        { id: 1, skuCode: "SK01300", skuDescription: "Demolition Other Floor",           measure: 0, uom: "M2", isNonStd: true,  totalPrice: 0, hasNotes: false },
        { id: 2, skuCode: "SK01297", skuDescription: "Demolition Tile Wall",             measure: 0, uom: "M2", isNonStd: true,  totalPrice: 0, hasNotes: false },
        { id: 3, skuCode: "SK01299", skuDescription: "Demolition Laminate Timber Floors",measure: 0, uom: "M2", isNonStd: false, totalPrice: 0, hasNotes: false },
        { id: 4, skuCode: "SK01295", skuDescription: "Demolition Cabinet",               measure: 0, uom: "LM", isNonStd: false, totalPrice: 0, hasNotes: false },
        { id: 5, skuCode: "SK01294", skuDescription: "Wall removal any height ALL",      measure: 0, uom: "LM", isNonStd: false, totalPrice: 0, hasNotes: false },
        { id: 6, skuCode: "SK01296", skuDescription: "Demolition Tile Floor",            measure: 0, uom: "M2", isNonStd: false, totalPrice: 0, hasNotes: false },
        { id: 7, skuCode: "SK01298", skuDescription: "Demolition Soft Floors",           measure: 0, uom: "M2", isNonStd: false, totalPrice: 0, hasNotes: false },
      ],
    },
    { id: 2, name: "Living and Dining", nickname: "", m2: null, ceilingM: 2400, status: "Live", totalPrice: 8200,  scopeQuestions: [], lineItems: [] },
    { id: 3, name: "Hallway",           nickname: "", m2: null, ceilingM: 2400, status: "Live", totalPrice: 2100,  scopeQuestions: [], lineItems: [] },
    { id: 4, name: "Bedroom",           nickname: "", m2: null, ceilingM: 2400, status: "Live", totalPrice: 9400,  scopeQuestions: [], lineItems: [] },
    { id: 5, name: "Bathroom",          nickname: "", m2: null, ceilingM: 2400, status: "Live", totalPrice: 5800,  scopeQuestions: [], lineItems: [] },
    { id: 6, name: "General",           nickname: "", m2: null, ceilingM: 2400, status: "Live", totalPrice: 2808,  scopeQuestions: [], lineItems: [] },
  ],
}

// ---------------------------------------------------------------------------
// Project Notes
// ---------------------------------------------------------------------------

export const MOCK_NOTES: ProjectNote[] = [
  {
    id: 1,
    areaName: "Kitchen",
    objectName: "Hob",
    type: "General",
    trades: ["Lead Contractor"],
    author: "mike",
    date: "Jul 22, 2026, 7:54 PM",
    text: "dfgdfgsdfgsdf",
  },
  {
    id: 2,
    areaName: "Kitchen",
    objectName: "Hob",
    type: "Style",
    trades: [],
    author: "mike",
    date: "Jul 22, 2026, 7:50 PM",
    text: "client hat....",
  },
  {
    id: 3,
    areaName: "Kitchen",
    objectName: "Rangehood",
    type: "Demolition",
    trades: ["Plumbing"],
    author: "mike",
    date: "Jul 22, 2026, 7:48 PM",
    text: "pipes ertc",
  },
  {
    id: 4,
    areaName: "Kitchen",
    objectName: "Oven",
    type: "Demolition",
    trades: ["Demolition", "Plumbing"],
    author: "mike",
    date: "Jul 22, 2026, 7:45 PM",
    text: "sdjklhaksk....",
  },
]

export const MOCK_NOTE_AREAS: string[] = [
  "All areas", "Kitchen", "Living and Dining", "Hallway", "Bedroom", "Bathroom", "General",
]

export const MOCK_NOTE_OBJECTS: string[] = [
  "All objects", "Hob", "Oven", "Dishwasher", "Fridge Freezer", "Microwave", "Rangehood",
]
