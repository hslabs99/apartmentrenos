import { compareProjectAreasDisplayOrder } from "@/lib/project-area-display-order";
import { projectAreaHeading } from "@/lib/project-area-display-name";
import {
  lineExtendedTotalExcGst,
  lineFinalPrice,
} from "@/lib/client/line-final-price";
import { marginPercentFromSettings } from "@/lib/settings-margin";
import type { AreaPublic } from "@/types/area";
import type { DataLabourRatePublic } from "@/types/data-labour-rate-public";
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

/** Material + labour (pre-margin) for included lines — matches workbench line total base. */
function includedLineTotal(
  row: ProjectAreaObjectPublic,
  contractLabourRates: DataLabourRatePublic[],
): number {
  if (row.included === false) return 0;
  return (
    lineExtendedTotalExcGst(row, undefined, undefined, undefined, contractLabourRates) ?? 0
  );
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
 * Final price = (material + labour) × margin — same retail formula as checklist Total price.
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
    labourRatesRes,
  ] = await Promise.all([
    fetch(`/api/projects/${encodeURIComponent(projectDocId)}`),
    fetch(`/api/projectareas?projectDocId=${encodeURIComponent(projectDocId)}`),
    fetch(`/api/projectareaobjects?projectDocId=${encodeURIComponent(projectDocId)}`),
    fetch("/api/areas"),
    fetch("/api/quote-objects"),
    fetch("/api/settings"),
    fetch("/api/labour-rates"),
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

  const labourRatesData = await readApiJson<{ items?: DataLabourRatePublic[] }>(labourRatesRes);
  const contractLabourRates = labourRatesRes.ok ? (labourRatesData.items ?? []) : [];

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

  const grandTotal = allObjects.reduce(
    (sum, row) => sum + includedLineTotal(row, contractLabourRates),
    0,
  );
  const grandFinalTotal = allObjects.reduce((sum, row) => {
    const f = lineFinalPrice(
      row,
      marginPct,
      undefined,
      undefined,
      undefined,
      contractLabourRates,
    );
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
      const areaSubtotal = lineRows.reduce(
        (sum, row) => sum + includedLineTotal(row, contractLabourRates),
        0,
      );
      const areaFinalSubtotal = lineRows.reduce((sum, row) => {
        const f = lineFinalPrice(
          row,
          marginPct,
          undefined,
          undefined,
          undefined,
          contractLabourRates,
        );
        return sum + (f ?? 0);
      }, 0);
      const hasIncludedMoney = lineRows.some(
        (r) => includedLineTotal(r, contractLabourRates) > 0,
      );
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
          const lineTotal =
            lineExtendedTotalExcGst(
              row,
              undefined,
              undefined,
              undefined,
              contractLabourRates,
            ) ?? row.totalprice ?? "";
          const lf = lineFinalPrice(
            row,
            marginPct,
            undefined,
            undefined,
            undefined,
            contractLabourRates,
          );
          const notes = [row.notes1, row.notes2].filter(Boolean).join("\n");
          rows.push([
            row.included !== false,
            objectLabel(row, quoteObjects),
            "",
            "",
            row.custommeasure ?? "",
            row.customuom ?? "",
            row.customumprice ?? "",
            lineTotal,
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
