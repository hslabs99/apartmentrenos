/** Client-side parse of Quote Objects import workbook (Data sheet, headers row 9, data from row 10). */

export type QuoteObjectImportRow = {
  rowNumber: number;
  objectname: string;
  product: string;
  objecttype: string;
  category: string;
  areaTags: string;
  uom: string;
  inheritAreaM2: boolean;
  runWidth: number | null;
  defaultAreaM2: number | null;
  measurement: number | null;
  generalHours: number | null;
  projectManagerHours: number | null;
  paintingHours: number | null;
  plasteringHours: number | null;
  notes1: string;
  notes2: string;
  tooltip: string;
  priceLevelRows: Array<{
    pricelevelid: number;
    uomprice?: number | null;
    totalprice?: number | null;
    spec1?: string;
    spec2?: string;
    spec3?: string;
  }>;
};

export type QuoteObjectImportTriage = {
  ok: boolean;
  error?: string;
  sheetName?: string;
  dataRowCount?: number;
  priceLevelIds?: number[];
  warnings?: string[];
  rows?: QuoteObjectImportRow[];
};

function normalizeCellString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function parseNumberOrNull(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseBoolLoose(v: unknown): boolean {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1";
}

type PlField = "UOMPrice" | "TotalPrice" | "Spec1" | "Spec2" | "Spec3";

/**
 * Parse xlsx ArrayBuffer. Returns triage + rows, or ok: false with error message.
 */
export async function triageAndParseQuoteObjectsImport(
  buf: ArrayBuffer,
): Promise<QuoteObjectImportTriage> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.Sheets["Data"] ? "Data" : wb.SheetNames[0];
  const ws = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!ws) {
    return { ok: false, error: "No worksheet found in file." };
  }

  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as unknown[][];
  const headerRowIdx = 8;
  const dataStartIdx = 9;
  const headers = (aoa[headerRowIdx] ?? []).map((h) => normalizeCellString(h));
  if (headers.length === 0) {
    return { ok: false, error: "Header row (row 9) was empty." };
  }

  const idx = new Map<string, number>();
  headers.forEach((h, i) => {
    if (h) idx.set(h, i);
  });

  if (!idx.has("ObjectName")) {
    return {
      ok: false,
      error: "Missing required header 'ObjectName' on row 9.",
    };
  }

  const warnings: string[] = [];
  if (sheetName !== "Data") {
    warnings.push(`Using first sheet "${sheetName}" (no "Data" tab found).`);
  }

  const plCols: Array<{ pricelevelid: number; field: PlField; col: number }> = [];
  const re = /^PL#(\d+)\s+.+\s+(UOMPrice|TotalPrice|Spec1|Spec2|Spec3)$/;
  for (let c = 0; c < headers.length; c++) {
    const h = headers[c];
    const m = h.match(re);
    if (!m) continue;
    const pricelevelid = Number(m[1]);
    const field = m[2] as PlField;
    if (Number.isFinite(pricelevelid)) plCols.push({ pricelevelid, field, col: c });
  }

  const plIds = [...new Set(plCols.map((p) => p.pricelevelid))].sort((a, b) => a - b);
  if (plIds.length === 0) {
    warnings.push("No price-level columns found (expected headers like PL#1 Name UOMPrice).");
  }

  const rows: QuoteObjectImportRow[] = [];
  for (let r = dataStartIdx; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    const objectname = normalizeCellString(row[idx.get("ObjectName")!]);
    if (!objectname) break;

    const objecttypeRaw = normalizeCellString(row[idx.get("ObjectType") ?? -1]);
    const objecttype = objecttypeRaw === "'" || !objecttypeRaw ? "Unit" : "Unit";

    const priceLevelRowsMap = new Map<
      number,
      {
        pricelevelid: number;
        spec1: string;
        spec2: string;
        spec3: string;
        uomprice?: number | null;
        totalprice?: number | null;
      }
    >();
    for (const pc of plCols) {
      const cur = priceLevelRowsMap.get(pc.pricelevelid) ?? {
        pricelevelid: pc.pricelevelid,
        spec1: "",
        spec2: "",
        spec3: "",
      };
      const v = row[pc.col];
      if (pc.field === "UOMPrice") cur.uomprice = parseNumberOrNull(v);
      else if (pc.field === "TotalPrice") cur.totalprice = parseNumberOrNull(v);
      else cur[pc.field.toLowerCase() as "spec1" | "spec2" | "spec3"] = normalizeCellString(v);
      priceLevelRowsMap.set(pc.pricelevelid, cur);
    }
    const priceLevelRows = [...priceLevelRowsMap.values()].sort(
      (a, b) => a.pricelevelid - b.pricelevelid,
    );

    rows.push({
      rowNumber: r + 1,
      objectname,
      product: normalizeCellString(
        row[idx.get("Product") ?? idx.get("Description") ?? -1],
      ),
      objecttype,
      category: normalizeCellString(row[idx.get("Category") ?? -1]),
      areaTags: normalizeCellString(row[idx.get("AreaTags") ?? -1]),
      uom: normalizeCellString(row[idx.get("UOM") ?? -1]),
      inheritAreaM2: parseBoolLoose(row[idx.get("InheritAreaM2") ?? -1]),
      runWidth: parseNumberOrNull(row[idx.get("RunWidth") ?? -1]),
      defaultAreaM2: parseNumberOrNull(row[idx.get("DefaultAreaM2") ?? -1]),
      measurement: parseNumberOrNull(row[idx.get("Measurement") ?? -1]),
      generalHours: parseNumberOrNull(
        row[idx.get("GeneralHours") ?? idx.get("GeneralLoad") ?? -1],
      ),
      projectManagerHours: parseNumberOrNull(
        row[idx.get("ProjectManagerHours") ?? idx.get("PMLoad") ?? -1],
      ),
      paintingHours: parseNumberOrNull(row[idx.get("PaintingHours") ?? -1]),
      plasteringHours: parseNumberOrNull(row[idx.get("PlasteringHours") ?? -1]),
      notes1: normalizeCellString(row[idx.get("Notes1") ?? -1]),
      notes2: normalizeCellString(row[idx.get("Notes2") ?? -1]),
      tooltip: normalizeCellString(row[idx.get("Tooltip") ?? -1]),
      priceLevelRows,
    });
  }

  if (rows.length === 0) {
    return {
      ok: false,
      error: "No data rows found starting at row 10 (first ObjectName is blank).",
    };
  }

  return {
    ok: true,
    sheetName,
    dataRowCount: rows.length,
    priceLevelIds: plIds,
    warnings,
    rows,
  };
}
