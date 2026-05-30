import type { DataSku } from "@/types/data-sku";

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

/** Non-empty append type + spec pairs on a catalog SKU (order 1 → 3). */
export function appendSlotsFromDataSku(sku: DataSkuAppendFields): DataSkuAppendSlotRef[] {
  const out: DataSkuAppendSlotRef[] = [];
  for (const { slot, typeKey, specKey } of SLOT_DEFS) {
    const productType = sku[typeKey].trim();
    const product = sku[specKey].trim();
    if (productType && product) {
      out.push({ slot, productType, product });
    }
  }
  return out;
}
