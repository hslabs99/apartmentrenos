import type { ParsedSheetRow } from "@/lib/google/parsed-sheet-row";

export type SkuSheetFieldKey = keyof Omit<
  ParsedSheetRow,
  "sheetRowNumber" | "productKeySourceRowNumber"
>;

const DIRECT_ALIASES: Record<string, SkuSheetFieldKey> = {
  category: "category",
  "product type": "productType",
  product: "product",
  specification: "product",
  description: "product",
  "product description": "product",
  "product name": "product",
  "elevate level": "elevateLevel",
  style: "style",
  "colour options": "colourOptions",
  "color options": "colourOptions",
  priority: "supplierOption",
  supplier: "supplier",
  model: "model",
  sku: "supplierSku",
  link: "link",
  $: "priceIncGst",
  "price inc gst": "priceIncGst",
  "price (inc gst)": "priceIncGst",
  "$ exc gst": "priceExcGst",
  "price exc gst": "priceExcGst",
  "price (exc gst)": "priceExcGst",
  uom: "uom",
  apend1type: "append1Type",
  append1type: "append1Type",
  "apend1 type": "append1Type",
  "append1 type": "append1Type",
  apend1spec: "append1Spec",
  append1spec: "append1Spec",
  "apend1 spec": "append1Spec",
  "append1 spec": "append1Spec",
  apend2type: "append2Type",
  append2type: "append2Type",
  "apend2 type": "append2Type",
  "append2 type": "append2Type",
  apend2spec: "append2Spec",
  append2spec: "append2Spec",
  "apend2 spec": "append2Spec",
  "append2 spec": "append2Spec",
  apend3type: "append3Type",
  append3type: "append3Type",
  "apend3 type": "append3Type",
  "append3 type": "append3Type",
  apend3spec: "append3Spec",
  append3spec: "append3Spec",
  "apend3 spec": "append3Spec",
  "append3 spec": "append3Spec",
  "sheet width": "sheetWidth",
  "stock available": "stockAvailable",
  "lead time": "leadTime",
  location: "location",
  comments: "comments",
};

function appendField(slot: 1 | 2 | 3, kind: "type" | "spec"): SkuSheetFieldKey {
  const cap = kind === "type" ? "Type" : "Spec";
  return `append${slot}${cap}` as SkuSheetFieldKey;
}

/** Normalise a workbook header label for SKU column matching. */
export function normalizeSkuSheetHeaderLabel(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .replace(/[_\-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Map a normalised header label to a SKU import field (append slots support several layouts). */
export function resolveSkuSheetHeaderField(normalizedLabel: string): SkuSheetFieldKey | undefined {
  const direct = DIRECT_ALIASES[normalizedLabel];
  if (direct) return direct;

  const slotFirst =
    /^ap+p+end\s*(\d)\s*(type|spec)$/.exec(normalizedLabel) ??
    /^ap+p+end(\d)(type|spec)$/.exec(normalizedLabel);
  if (slotFirst) {
    const slot = Number(slotFirst[1]);
    if (slot >= 1 && slot <= 3) {
      return appendField(slot as 1 | 2 | 3, slotFirst[2] as "type" | "spec");
    }
  }

  const kindFirst =
    /^ap+p+end\s*(type|spec)\s*(\d)$/.exec(normalizedLabel) ??
    /^ap+p+end(type|spec)(\d)$/.exec(normalizedLabel);
  if (kindFirst) {
    const slot = Number(kindFirst[2]);
    if (slot >= 1 && slot <= 3) {
      return appendField(slot as 1 | 2 | 3, kindFirst[1] as "type" | "spec");
    }
  }

  return undefined;
}

export const SKU_APPEND_FIELD_KEYS: SkuSheetFieldKey[] = [
  "append1Type",
  "append1Spec",
  "append2Type",
  "append2Spec",
  "append3Type",
  "append3Spec",
];
