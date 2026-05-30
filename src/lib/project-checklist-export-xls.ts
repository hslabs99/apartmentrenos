import { compareProjectAreasDisplayOrder } from "@/lib/project-area-display-order";
import { projectAreaHeading } from "@/lib/project-area-display-name";
import { marginPercentFromSettings } from "@/lib/settings-margin";
import type { AreaPublic } from "@/types/area";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { SettingPublic } from "@/types/setting";

async function readApiJson<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  const text = await res.text();
  throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
}

function objectLabel(row: ProjectAreaObjectPublic, quoteObjects: QuoteObjectPublic[]): string {
  const q = quoteObjects.find((o) => o.objectid === row.objectid);
  return q?.objectname?.trim() ? q.objectname : `Object #${row.objectid}`;
}

function includedLineTotal(row: ProjectAreaObjectPublic): number {
  if (row.included === false) return 0;
  const t = row.totalprice;
  return typeof t === "number" && Number.isFinite(t) ? t : 0;
}

function lineFinalPrice(
  row: ProjectAreaObjectPublic,
  marginPct: number,
): number | null {
  if (row.included === false) return null;
  const t = row.totalprice;
  if (t == null || !Number.isFinite(t)) return null;
  return t * (1 + marginPct / 100);
}

function safeFileBase(name: string): string {
  const t = name.trim().replace(/[^\w\s-]+/g, "").replace(/\s+/g, "-");
  return t.slice(0, 80) || "project";
}

const HEADER = [
  "Included",
  "Description",
  "Area m²",
  "Finish",
  "Measure",
  "UOM",
  "Unit price",
  "Line total",
  "Final price",
  "CA hours",
  "LC hours",
  "Elec hours",
  "Plumb hours",
  "Gen hours",
  "PM hours",
  "Paint hours",
  "Plast hours",
  "Notes",
] as const;

/**
 * Fetches checklist-related data and downloads a binary .xls workbook (Excel-compatible).
 */
export async function downloadProjectChecklistXls(
  projectDocId: string,
  projectDisplayName: string,
): Promise<void> {
  const [
    projectRes,
    paRes,
    objRes,
    areasRes,
    qoRes,
    settingsRes,
  ] = await Promise.all([
    fetch(`/api/projects/${encodeURIComponent(projectDocId)}`),
    fetch(`/api/projectareas?projectDocId=${encodeURIComponent(projectDocId)}`),
    fetch(`/api/projectareaobjects?projectDocId=${encodeURIComponent(projectDocId)}`),
    fetch("/api/areas"),
    fetch("/api/quote-objects"),
    fetch("/api/settings"),
  ]);

  const projectData = await readApiJson<{ project?: ProjectPublic; error?: string }>(projectRes);
  if (!projectRes.ok || !projectData.project) {
    throw new Error(projectData.error ?? "Failed to load project");
  }
  const project = projectData.project;
  const numericProjectId =
    typeof project.projectid === "number" && Number.isInteger(project.projectid)
      ? project.projectid
      : null;
  if (numericProjectId == null) {
    throw new Error(
      "This project needs a numeric ID before the checklist can be exported. Save the project once or run Assign missing numeric IDs.",
    );
  }

  const paData = await readApiJson<{ projectAreas?: ProjectAreaPublic[]; error?: string }>(paRes);
  if (!paRes.ok) throw new Error(paData.error ?? "Failed to load project areas");

  const objData = await readApiJson<{
    projectAreaObjects?: ProjectAreaObjectPublic[];
    error?: string;
  }>(objRes);
  if (!objRes.ok) throw new Error(objData.error ?? "Failed to load line items");

  const areasData = await readApiJson<{ areas?: AreaPublic[]; error?: string }>(areasRes);
  if (!areasRes.ok) throw new Error(areasData.error ?? "Failed to load areas");

  const qoData = await readApiJson<{ quoteObjects?: QuoteObjectPublic[]; error?: string }>(qoRes);
  if (!qoRes.ok) throw new Error(qoData.error ?? "Failed to load quote objects");

  const settingsData = await readApiJson<{ settings?: SettingPublic[]; error?: string }>(
    settingsRes,
  );
  const settings = settingsRes.ok ? (settingsData.settings ?? []) : [];
  const marginPct = marginPercentFromSettings(settings);

  const areas = areasData.areas ?? [];
  const quoteObjects = qoData.quoteObjects ?? [];
  const projectAreas = [...(paData.projectAreas ?? [])].sort(compareProjectAreasDisplayOrder);
  const allObjects = objData.projectAreaObjects ?? [];

  const objectsByProjectAreaDocId = new Map<string, ProjectAreaObjectPublic[]>();
  for (const row of allObjects) {
    let key = row.projectAreaDocId?.trim() ?? "";
    if (!key) {
      const sole = projectAreas.filter((pa) => pa.areaid === row.areaid);
      key = sole.length === 1 ? sole[0].id : `__orphan__${row.id}`;
    }
    const list = objectsByProjectAreaDocId.get(key) ?? [];
    list.push(row);
    objectsByProjectAreaDocId.set(key, list);
  }
  for (const [, list] of objectsByProjectAreaDocId) {
    list.sort((a, b) => a.objectid - b.objectid);
  }

  const rows: (string | number | boolean | null)[][] = [
    [`Checklist — ${project.projectname || projectDisplayName}`],
    [`Margin % (from settings): ${marginPct}`],
    [],
    [...HEADER],
  ];

  const grandTotal = allObjects.reduce((sum, row) => sum + includedLineTotal(row), 0);
  const grandFinalTotal = allObjects.reduce((sum, row) => {
    const f = lineFinalPrice(row, marginPct);
    return sum + (f != null ? f : 0);
  }, 0);
  const loadGrand = (pick: (r: ProjectAreaObjectPublic) => number | null) =>
    allObjects.reduce((sum, row) => {
      if (row.included === false) return sum;
      const v = pick(row);
      return sum + (typeof v === "number" && Number.isFinite(v) ? v : 0);
    }, 0);

  if (projectAreas.length === 0) {
    rows.push(["No areas on this project yet."]);
  } else {
    for (const pa of projectAreas) {
      const lineRows = objectsByProjectAreaDocId.get(pa.id) ?? [];
      const areaSubtotal = lineRows.reduce((sum, row) => sum + includedLineTotal(row), 0);
      const areaFinalSubtotal = areaSubtotal * (1 + marginPct / 100);
      const hasIncludedMoney = lineRows.some((r) => includedLineTotal(r) > 0);
      const areaNotes = [pa.areanotes1, pa.areanotes2].filter(Boolean).join(" · ");

      const areaLoadSum = (pick: (r: ProjectAreaObjectPublic) => number | null) =>
        lineRows.reduce((sum, r) => {
          if (r.included === false) return sum;
          const v = pick(r);
          return sum + (typeof v === "number" && Number.isFinite(v) ? v : 0);
        }, 0);

      rows.push([
        "",
        projectAreaHeading(pa, areas),
        pa.aream2 ?? "",
        pa.areafinish?.trim() ?? "",
        "Area subtotal (included)",
        "",
        "",
        hasIncludedMoney ? areaSubtotal : "",
        hasIncludedMoney ? areaFinalSubtotal : "",
        areaLoadSum((r) => r.constructionAssistantHours),
        areaLoadSum((r) => r.leadContractorHours),
        areaLoadSum((r) => r.electricianHours),
        areaLoadSum((r) => r.plumberHours),
        areaLoadSum((r) => r.generalHours),
        areaLoadSum((r) => r.projectManagerHours),
        areaLoadSum((r) => r.paintingHours),
        areaLoadSum((r) => r.plasteringHours),
        areaNotes || "",
      ]);

      if (lineRows.length === 0) {
        rows.push([
          "",
          "No objects in this area yet.",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ]);
      } else {
        for (const row of lineRows) {
          const lf = lineFinalPrice(row, marginPct);
          const notes = [row.notes1, row.notes2].filter(Boolean).join("\n");
          rows.push([
            row.included !== false,
            objectLabel(row, quoteObjects),
            "",
            "",
            row.custommeasure ?? "",
            row.customuom ?? "",
            row.customumprice ?? "",
            row.totalprice ?? "",
            lf ?? "",
            row.constructionAssistantHours ?? "",
            row.leadContractorHours ?? "",
            row.electricianHours ?? "",
            row.plumberHours ?? "",
            row.generalHours ?? "",
            row.projectManagerHours ?? "",
            row.paintingHours ?? "",
            row.plasteringHours ?? "",
            notes,
          ]);
        }
      }
    }

    rows.push([
      "Project total (included lines)",
      "",
      "",
      "",
      "",
      "",
      "",
      grandTotal,
      grandFinalTotal,
      loadGrand((r) => r.constructionAssistantHours),
      loadGrand((r) => r.leadContractorHours),
      loadGrand((r) => r.electricianHours),
      loadGrand((r) => r.plumberHours),
      loadGrand((r) => r.generalHours),
      loadGrand((r) => r.projectManagerHours),
      loadGrand((r) => r.paintingHours),
      loadGrand((r) => r.plasteringHours),
      "",
    ]);
  }

  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Checklist");
  const base = safeFileBase(project.projectname || projectDisplayName);
  XLSX.writeFile(wb, `${base}-checklist.xls`, { bookType: "xls" });
}
