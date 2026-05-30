import {
  BLIND_WIDTH_MM_VALUES,
  blindWidthFieldName,
  emptyBlindWidthPrices,
  isSupportedBlindWidthMm,
} from "@/lib/google/blinds-width-columns";
import type { BlindWidthField } from "@/lib/google/blinds-width-columns";
import { blindsTypeSlug } from "@/lib/google/blinds-type-slug";
import type { DataBlindFooter } from "@/types/data-blind-footer";
import type { DataBlindType } from "@/types/data-blind-type";

function cellString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).trim();
}

function normalizeLabel(raw: unknown): string {
  return cellString(raw).toLowerCase().replace(/\s+/g, " ");
}

function isRowEmpty(row: unknown[]): boolean {
  return row.every((c) => cellString(c) === "");
}

function parseNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = cellString(v).replace(/[$,]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseWidthHeaderMm(v: unknown): number | null {
  const n = parseNumber(v);
  if (n == null) return null;
  const mm = Math.round(n);
  return isSupportedBlindWidthMm(mm) ? mm : null;
}

function isDropHeaderLabel(raw: unknown): boolean {
  const label = normalizeLabel(raw);
  return label === "drop" || label.startsWith("drop ") || label.includes("drop ↓");
}

function isMinChainDropHeader(raw: unknown): boolean {
  const label = normalizeLabel(raw);
  return label.includes("minima") && label.includes("chain");
}

function isFooterNoteRow(row: unknown[]): boolean {
  const a = normalizeLabel(row[0]);
  return a.startsWith("footer note") || a === "footer";
}

/** First percentage in text, e.g. "Add 5% SW4300" → 5. */
export function extractFooterImpactPct(noteText: string): number | null {
  const match = noteText.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function parsePriceSheetDate(rows: unknown[][], beforeHeader: number): string | null {
  for (let i = 0; i < beforeHeader && i < 8; i++) {
    const raw = cellString((rows[i] ?? [])[0]);
    if (!raw) continue;
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(raw)) return raw;
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;
  }
  return null;
}

function parsePreamble(
  rows: unknown[][],
  headerIndex: number,
): Pick<
  DataBlindType,
  "priceSheetDate" | "productLabel" | "colourMaterial" | "priceMultiplier" | "gstInclusive"
> {
  let productLabel = "";
  let colourMaterial = "";
  let priceMultiplier: number | null = null;
  let gstInclusive = false;

  for (let i = 0; i < headerIndex; i++) {
    const row = rows[i] ?? [];
    const line = row.map(cellString).filter(Boolean).join(" ");
    const norm = normalizeLabel(line);

    if (norm.includes("retail price")) {
      productLabel = line;
      continue;
    }

    if (norm.includes("colour/material") || norm.startsWith("colour:")) {
      const afterColon = line.split(/:/).slice(1).join(":").trim();
      colourMaterial = afterColon || cellString(row[1]) || cellString(row[0]);
      if (colourMaterial.toLowerCase().includes("colour/material")) {
        colourMaterial = cellString(rows[i + 1]?.[0]) || cellString(rows[i + 1]?.[1]);
      }
      continue;
    }

    const multMatch = line.match(/\bx\s*\.?\s*(\d+(?:\.\d+)?)\b/i);
    if (multMatch) {
      const n = Number(multMatch[1]);
      priceMultiplier = Number.isFinite(n) ? (n > 1 ? n / 10 : n) : null;
      continue;
    }

    if (norm.includes("g.s.t") && norm.includes("inclusive")) {
      gstInclusive = true;
    }
  }

  return {
    priceSheetDate: parsePriceSheetDate(rows, headerIndex),
    productLabel,
    colourMaterial,
    priceMultiplier,
    gstInclusive,
  };
}

export type ParsedBlindPriceRow = {
  dropMm: number;
  prices: Partial<Record<BlindWidthField, number>>;
  minChainDropMm: number | null;
  sheetRow: number;
};

export type ParseBlindsMatrixResult = {
  isMatrix: boolean;
  headerRow1Based: number;
  dataStartRow1Based: number;
  typeMeta: Omit<
    DataBlindType,
    "typeName" | "typeSlug" | "sheetGid" | "headerRow1Based" | "dataStartRow1Based"
  > | null;
  priceRows: ParsedBlindPriceRow[];
  footers: Omit<DataBlindFooter, "type" | "typeSlug">[];
  errors: string[];
  warnings: string[];
};

function findMatrixHeaderIndex(values: unknown[][]): number {
  for (let i = 0; i < values.length; i++) {
    const row = values[i] ?? [];
    if (!isDropHeaderLabel(row[0])) continue;
    let widthCount = 0;
    for (let c = 1; c < row.length; c++) {
      if (parseWidthHeaderMm(row[c]) != null) widthCount++;
    }
    if (widthCount >= 2) return i;
  }
  return -1;
}

/**
 * Parse one worksheet tab as a blind retail price matrix.
 * Returns isMatrix=false when the tab does not match the expected layout.
 */
export function parseBlindsMatrixTab(
  values: unknown[][],
  rangeStartRow1Based = 1,
): ParseBlindsMatrixResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const headerIndex = findMatrixHeaderIndex(values);
  if (headerIndex < 0) {
    return {
      isMatrix: false,
      headerRow1Based: 0,
      dataStartRow1Based: 0,
      typeMeta: null,
      priceRows: [],
      footers: [],
      errors: [],
      warnings: [],
    };
  }

  const headerRow = values[headerIndex] ?? [];
  const headerRow1Based = rangeStartRow1Based + headerIndex;

  const widthColByMm = new Map<number, number>();
  let minChainCol = -1;

  for (let c = 1; c < headerRow.length; c++) {
    if (isMinChainDropHeader(headerRow[c])) {
      minChainCol = c;
      continue;
    }
    const mm = parseWidthHeaderMm(headerRow[c]);
    if (mm != null) widthColByMm.set(mm, c);
  }

  if (widthColByMm.size < 2) {
    return {
      isMatrix: false,
      headerRow1Based: 0,
      dataStartRow1Based: 0,
      typeMeta: null,
      priceRows: [],
      footers: [],
      errors: ["Header row has fewer than two width columns."],
      warnings: [],
    };
  }

  const widthMms = [...widthColByMm.keys()].sort((a, b) => a - b);
  const preamble = parsePreamble(values, headerIndex);
  const dataStartIndex = headerIndex + 1;
  const dataStartRow1Based = rangeStartRow1Based + dataStartIndex;

  const priceRows: ParsedBlindPriceRow[] = [];
  const footers: Omit<DataBlindFooter, "type" | "typeSlug">[] = [];
  let footerSort = 0;

  for (let i = dataStartIndex; i < values.length; i++) {
    const sheetRow = rangeStartRow1Based + i;
    const row = values[i] ?? [];

    if (isRowEmpty(row)) continue;

    if (isFooterNoteRow(row)) {
      const noteText = row.map(cellString).filter(Boolean).join(" ").trim();
      const cleaned = noteText.replace(/^footer\s*note\s*/i, "").trim() || noteText;
      footers.push({
        sortOrder: footerSort++,
        noteText: cleaned,
        impactPct: extractFooterImpactPct(cleaned),
        sourceSheetRow: sheetRow,
      });
      continue;
    }

    const dropRaw = parseNumber(row[0]);
    if (dropRaw == null) continue;

    const dropMm = Math.round(dropRaw);
    if (dropMm < 100 || dropMm > 10000) {
      warnings.push(`Row ${sheetRow}: ignored drop ${dropRaw}.`);
      continue;
    }

    const prices: Partial<Record<BlindWidthField, number>> = {};
    let priceCount = 0;

    for (const mm of widthMms) {
      const col = widthColByMm.get(mm)!;
      const price = parseNumber(row[col]);
      if (price == null) continue;
      if (price < 10 || price > 100_000) {
        warnings.push(`Row ${sheetRow} w${mm}: unusual price ${price}.`);
      }
      prices[blindWidthFieldName(mm)] = price;
      priceCount++;
    }

    if (priceCount === 0) continue;

    const minChainDropMm =
      minChainCol >= 0 ? parseNumber(row[minChainCol]) : null;

    priceRows.push({
      dropMm,
      prices,
      minChainDropMm: minChainDropMm != null ? Math.round(minChainDropMm) : null,
      sheetRow,
    });
  }

  if (priceRows.length === 0) {
    errors.push("No price rows found below header.");
  }

  return {
    isMatrix: true,
    headerRow1Based,
    dataStartRow1Based,
    typeMeta: {
      ...preamble,
      widthMinMm: widthMms[0] ?? null,
      widthMaxMm: widthMms[widthMms.length - 1] ?? null,
      hasMinChainDropColumn: minChainCol >= 0,
    },
    priceRows,
    footers,
    errors,
    warnings,
  };
}

/** Build full width fields for Firestore from partial parsed prices. */
export function blindPricesToFirestoreFields(
  prices: Partial<Record<BlindWidthField, number>>,
): Record<BlindWidthField, number | null> {
  const out = emptyBlindWidthPrices();
  for (const w of BLIND_WIDTH_MM_VALUES) {
    const key = blindWidthFieldName(w);
    if (prices[key] != null) out[key] = prices[key]!;
  }
  return out;
}

export function buildDataBlindType(
  typeName: string,
  sheetGid: number,
  parsed: ParseBlindsMatrixResult,
): DataBlindType {
  const meta = parsed.typeMeta!;
  return {
    typeName,
    typeSlug: blindsTypeSlug(typeName),
    priceSheetDate: meta.priceSheetDate,
    productLabel: meta.productLabel,
    colourMaterial: meta.colourMaterial,
    priceMultiplier: meta.priceMultiplier,
    gstInclusive: meta.gstInclusive,
    widthMinMm: meta.widthMinMm,
    widthMaxMm: meta.widthMaxMm,
    hasMinChainDropColumn: meta.hasMinChainDropColumn,
    sheetGid,
    headerRow1Based: parsed.headerRow1Based,
    dataStartRow1Based: parsed.dataStartRow1Based,
  };
}
