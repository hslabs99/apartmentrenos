import {
  contractLabourRateBySiloProduct,
  labourSiloCostExcGst,
} from "@/lib/labour-rate-lookup";
import { formatLabourHours, LOOKUP_LABOUR_SILO_KEYS, WB_WORKBENCH_LABOUR_SILO_HEADERS } from "@/lib/labour-silo";
import type { DataLabourRatePublic } from "@/types/data-labour-rate-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

function lineMaterialExcGst(
  row: ProjectAreaObjectPublic,
  effectiveMeasure?: number | null,
  unitPriceFallback?: number | null,
  preferEffectiveMeasure?: boolean,
): number | null {
  const t = row.totalprice;
  if (t != null && Number.isFinite(t) && !preferEffectiveMeasure) {
    return t;
  }
  const price = row.customumprice ?? unitPriceFallback ?? null;
  const measure = preferEffectiveMeasure
    ? (effectiveMeasure ?? row.custommeasure ?? null)
    : (row.custommeasure ?? effectiveMeasure ?? null);
  if (price != null && measure != null && Number.isFinite(price) && Number.isFinite(measure)) {
    return measure * price;
  }
  if (t != null && Number.isFinite(t)) {
    return t;
  }
  return null;
}

export type LineFinalPriceLabourSilo = {
  label: string;
  hours: number;
  costExcGst: number;
};

export type LineFinalPriceBreakdown = {
  materialExcGst: number;
  labourExcGst: number;
  labourSilos: LineFinalPriceLabourSilo[];
  baseExcGst: number;
  marginPct: number;
  marginExcGst: number;
  finalExcGst: number;
};

function lineLabourSilos(
  row: ProjectAreaObjectPublic,
  contractRates: DataLabourRatePublic[],
): LineFinalPriceLabourSilo[] {
  if (row.included === false) return [];
  const silos: LineFinalPriceLabourSilo[] = [];
  for (const { key, label } of WB_WORKBENCH_LABOUR_SILO_HEADERS) {
    const hours = row[key];
    if (typeof hours !== "number" || !Number.isFinite(hours) || hours <= 0) continue;
    const rate = contractLabourRateBySiloProduct(contractRates, key);
    const cost = labourSiloCostExcGst(hours, rate);
    if (cost == null || cost <= 0) continue;
    silos.push({ label, hours, costExcGst: cost });
  }
  return silos;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatBreakdownMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Material + labour + margin components for one workbench line. */
export function lineFinalPriceBreakdown(
  row: ProjectAreaObjectPublic,
  marginPct: number,
  effectiveMeasure?: number | null,
  unitPriceFallback?: number | null,
  /** When true (scope metric inherit), ignore stored custommeasure. */
  preferEffectiveMeasure?: boolean,
  contractLabourRates?: DataLabourRatePublic[],
): LineFinalPriceBreakdown | null {
  if (row.included === false) return null;
  const material = lineMaterialExcGst(
    row,
    effectiveMeasure,
    unitPriceFallback,
    preferEffectiveMeasure,
  );
  const labourSilos =
    contractLabourRates && contractLabourRates.length > 0
      ? lineLabourSilos(row, contractLabourRates)
      : [];
  const labourExcGst = roundMoney(
    labourSilos.reduce((sum, s) => sum + s.costExcGst, 0),
  );
  if (material == null && labourExcGst === 0) return null;
  const materialExcGst = material ?? 0;
  const baseExcGst = roundMoney(materialExcGst + labourExcGst);
  const finalExcGst = roundMoney(baseExcGst * (1 + marginPct / 100));
  const marginExcGst = roundMoney(finalExcGst - baseExcGst);
  return {
    materialExcGst,
    labourExcGst,
    labourSilos,
    baseExcGst,
    marginPct,
    marginExcGst,
    finalExcGst,
  };
}

/** Hover title for extended line total (material + labour, pre-margin). */
export function lineExtendedTotalBreakdownTitle(breakdown: LineFinalPriceBreakdown): string {
  const lines: string[] = [];
  lines.push(`Item: ${formatBreakdownMoney(breakdown.materialExcGst)}`);
  if (breakdown.labourSilos.length > 0) {
    const siloParts = breakdown.labourSilos.map(
      (s) => `${s.label} ${formatBreakdownMoney(s.costExcGst)} (${formatLabourHours(s.hours)} hrs)`,
    );
    lines.push(`Labour: ${formatBreakdownMoney(breakdown.labourExcGst)} — ${siloParts.join(" + ")}`);
  } else {
    lines.push(`Labour: ${formatBreakdownMoney(breakdown.labourExcGst)}`);
  }
  lines.push(`Line total: ${formatBreakdownMoney(breakdown.baseExcGst)}`);
  return lines.join("\n");
}

/** Hover title explaining item + labour + margin → final price. */
export function lineFinalPriceBreakdownTitle(breakdown: LineFinalPriceBreakdown): string {
  const lines: string[] = [];
  lines.push(`Item: ${formatBreakdownMoney(breakdown.materialExcGst)}`);
  if (breakdown.labourSilos.length > 0) {
    const siloParts = breakdown.labourSilos.map(
      (s) => `${s.label} ${formatBreakdownMoney(s.costExcGst)} (${formatLabourHours(s.hours)} hrs)`,
    );
    lines.push(`Labour: ${formatBreakdownMoney(breakdown.labourExcGst)} — ${siloParts.join(" + ")}`);
  } else {
    lines.push(`Labour: ${formatBreakdownMoney(breakdown.labourExcGst)}`);
  }
  lines.push(`Line total: ${formatBreakdownMoney(breakdown.baseExcGst)}`);
  lines.push(
    `Margin (${breakdown.marginPct}%): ${formatBreakdownMoney(breakdown.marginExcGst)}`,
  );
  lines.push(`Final: ${formatBreakdownMoney(breakdown.finalExcGst)}`);
  return lines.join("\n");
}

const CHECKLIST_TRADE_HOUR_LABELS: Record<
  (typeof LOOKUP_LABOUR_SILO_KEYS)[number],
  string
> = {
  constructionAssistantHours: "construction assistant",
  leadContractorHours: "lead contractor",
  electricianHours: "electrical",
  plumberHours: "plumbing",
};

/**
 * Checklist-only hover: trade hours included in the line total.
 * No SKU cost, labour $, or margin — client / sales facing.
 */
export function lineChecklistTradeHoursTitle(row: ProjectAreaObjectPublic): string | undefined {
  if (row.included === false) return undefined;
  const parts: string[] = [];
  for (const key of LOOKUP_LABOUR_SILO_KEYS) {
    const hours = row[key];
    if (typeof hours !== "number" || !Number.isFinite(hours) || hours <= 0) continue;
    const label = CHECKLIST_TRADE_HOUR_LABELS[key];
    const hrs = formatLabourHours(hours);
    parts.push(`${hrs} ${label} hour${hours === 1 ? "" : "s"}`);
  }
  if (parts.length === 0) return undefined;
  return `Includes ${parts.join(", ")}`;
}

/**
 * Workbench line total / subtotal contribution: material + lookup labour (ex GST, before margin).
 * Labour silo column headers remain informational — do not add them again into project subtotal.
 */
export function lineExtendedTotalExcGst(
  row: ProjectAreaObjectPublic,
  effectiveMeasure?: number | null,
  unitPriceFallback?: number | null,
  /** When true (scope metric inherit), ignore stored custommeasure. */
  preferEffectiveMeasure?: boolean,
  contractLabourRates?: DataLabourRatePublic[],
): number | null {
  return (
    lineFinalPriceBreakdown(
      row,
      0,
      effectiveMeasure,
      unitPriceFallback,
      preferEffectiveMeasure,
      contractLabourRates,
    )?.baseExcGst ?? null
  );
}

/** Client-facing final price ((material + labour) × project margin %). */
export function lineFinalPrice(
  row: ProjectAreaObjectPublic,
  marginPct: number,
  effectiveMeasure?: number | null,
  unitPriceFallback?: number | null,
  /** When true (scope metric inherit), ignore stored custommeasure. */
  preferEffectiveMeasure?: boolean,
  contractLabourRates?: DataLabourRatePublic[],
): number | null {
  return (
    lineFinalPriceBreakdown(
      row,
      marginPct,
      effectiveMeasure,
      unitPriceFallback,
      preferEffectiveMeasure,
      contractLabourRates,
    )?.finalExcGst ?? null
  );
}
