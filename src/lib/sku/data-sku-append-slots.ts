import type { DataSku } from "@/types/data-sku";
import {
  isValidSupplierOption,
  PREFERRED_SUPPLIER_OPTION,
} from "@/lib/sku/supplier-option";

export const MAX_APPEND_SPEC_LENGTH = 150;

export type DataSkuAppendSlotIndex = 1 | 2 | 3;

export type DataSkuAppendSlotRef = {
  slot: DataSkuAppendSlotIndex;
  productType: string;
  product: string;
};

export type DataSkuAppendFields = Pick<
  DataSku,
  | "append1Type"
  | "append1Spec"
  | "append2Type"
  | "append2Spec"
  | "append3Type"
  | "append3Spec"
>;

export const EMPTY_SKU_APPEND_FIELDS: DataSkuAppendFields = {
  append1Type: "",
  append1Spec: "",
  append2Type: "",
  append2Spec: "",
  append3Type: "",
  append3Spec: "",
};

function appendText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

export function skuAppendFieldsFromSource(row: DataSkuAppendFields): DataSkuAppendFields {
  return {
    append1Type: appendText(row.append1Type),
    append1Spec: appendText(row.append1Spec),
    append2Type: appendText(row.append2Type),
    append2Spec: appendText(row.append2Spec),
    append3Type: appendText(row.append3Type),
    append3Spec: appendText(row.append3Spec),
  };
}

const SLOT_DEFS: {
  slot: DataSkuAppendSlotIndex;
  typeKey: keyof DataSkuAppendFields;
  specKey: keyof DataSkuAppendFields;
}[] = [
  { slot: 1, typeKey: "append1Type", specKey: "append1Spec" },
  { slot: 2, typeKey: "append2Type", specKey: "append2Spec" },
  { slot: 3, typeKey: "append3Type", specKey: "append3Spec" },
];

/** Truncate specification pointer text for append columns. */
export function truncateAppendSpec(value: string): string {
  const t = value.trim();
  if (t.length <= MAX_APPEND_SPEC_LENGTH) return t;
  return t.slice(0, MAX_APPEND_SPEC_LENGTH);
}

/** Append slots on a catalog SKU (order 1 → 3). Type required; spec optional. Spec-only still counts. */
export function appendSlotsFromDataSku(sku: DataSkuAppendFields): DataSkuAppendSlotRef[] {
  const out: DataSkuAppendSlotRef[] = [];
  for (const { slot, typeKey, specKey } of SLOT_DEFS) {
    const productType = appendText(sku[typeKey]);
    const product = appendText(sku[specKey]);
    if (productType) {
      out.push({ slot, productType, product });
    } else if (product) {
      out.push({ slot, productType: product, product: "" });
    }
  }
  return out;
}

export function appendSpecForSlot(
  sku: DataSkuAppendFields,
  slot: DataSkuAppendSlotIndex,
): string {
  const def = SLOT_DEFS.find((d) => d.slot === slot);
  if (!def) return "";
  return appendText(sku[def.specKey]);
}

type SupplierAppendSource = DataSkuAppendFields & { supplierOption: number };

/**
 * Append slots for one supplier priority only — the sheet row for that P-number.
 * Never copies another priority’s appends (P3 trim kit must not fire on P1/P2).
 */
export function appendSlotsForSupplierOption(
  suppliers: SupplierAppendSource[],
  preferredOption: number | null,
): DataSkuAppendSlotRef[] {
  const valid = suppliers.filter((s) => isValidSupplierOption(s.supplierOption));
  if (!valid.length) return [];
  const selected =
    preferredOption != null && isValidSupplierOption(preferredOption)
      ? valid.find((s) => s.supplierOption === preferredOption)
      : (valid.find((s) => s.supplierOption === PREFERRED_SUPPLIER_OPTION) ??
        [...valid].sort((a, b) => a.supplierOption - b.supplierOption)[0]);
  if (!selected) return [];
  return appendSlotsFromDataSku(selected);
}

export function appendSpecForSupplierOption(
  suppliers: SupplierAppendSource[],
  preferredOption: number | null,
  slot: DataSkuAppendSlotIndex,
): string {
  const slots = appendSlotsForSupplierOption(suppliers, preferredOption);
  return slots.find((s) => s.slot === slot)?.product ?? "";
}

export function formatAppendSlotLabel(slot: DataSkuAppendSlotRef): string {
  const type = slot.productType.trim();
  const spec = slot.product.trim();
  if (type && spec) return `${type} · ${spec}`;
  return type || spec;
}

export function formatAppendSlotsSummary(slots: DataSkuAppendSlotRef[]): string {
  return slots
    .map(formatAppendSlotLabel)
    .filter(Boolean)
    .join("; ");
}
