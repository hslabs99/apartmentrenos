import {
  buildProductKey,
  formatSkuId,
  isProductKeyComplete,
  missingProductKeyLabels,
  type ProductKeyFields,
} from "@/lib/sku/product-key";
import {
  formatParsedProductKey,
  formatWorkbookRowRef,
  type ProductKeyLogContext,
} from "@/lib/sku/format-product-key-log";
import {
  isValidSupplierOption,
  MAX_SUPPLIER_OPTION,
  MIN_SUPPLIER_OPTION,
} from "@/lib/sku/supplier-option";
import type { ParsedSheetRow } from "@/lib/google/parsed-sheet-row";
import type { DataSku } from "@/types/data-sku";
import type { DataSkuSupplier } from "@/types/data-sku-supplier";
import type { ImportLogDataError, ImportLogRowSample } from "@/types/import-log-types";

const PRODUCT_MERGE_TEXT = [
  "uom",
  "append1Type",
  "append1Spec",
  "append2Type",
  "append2Spec",
  "append3Type",
  "append3Spec",
  "stockAvailable",
  "leadTime",
  "location",
  "comments",
] as const satisfies readonly (keyof DataSku)[];

function mergeTextField(current: string, incoming: string): string {
  const cur = current.trim();
  const inc = incoming.trim();
  if (!cur && inc) return inc;
  return current;
}

/** True when cols G–M contain a supplier option and/or supplier identity (not orphan prices). */
function hasSupplierData(row: ParsedSheetRow): boolean {
  if (isValidSupplierOption(row.supplierOption)) return true;
  return (
    !!row.supplier.trim() ||
    !!row.model.trim() ||
    !!row.supplierSku.trim() ||
    !!row.link.trim()
  );
}

function isSupplierRowEmpty(row: ParsedSheetRow): boolean {
  return !hasSupplierData(row);
}

export type BuildSkuImportResult = {
  products: DataSku[];
  suppliers: DataSkuSupplier[];
  dataErrors: ImportLogDataError[];
  skippedInvalidRows: number;
  skippedRowSamples: ImportLogRowSample[];
};

function keySnapshot(fields: ProductKeyFields): ImportLogDataError["productKey"] {
  return {
    category: fields.category.trim(),
    productType: fields.productType.trim(),
    product: fields.product.trim(),
    elevateLevel: fields.elevateLevel.trim(),
    style: fields.style.trim(),
    colourOptions: fields.colourOptions.trim(),
  };
}

/**
 * Build products/suppliers from parsed sheet rows.
 * Row order in the workbook does not matter: products are merged by product key (cols A–F).
 * Existing SKUs are matched later by the same key in `resolveSkuImportIds`.
 */
export function buildSkuImportFromSheetRows(
  sheetRows: ParsedSheetRow[],
  maxSamples = 150,
  logContext?: ProductKeyLogContext,
): BuildSkuImportResult {
  const productsByKey = new Map<string, DataSku>();
  const suppliers: DataSkuSupplier[] = [];
  const supplierSlotKeys = new Set<string>();
  const dataErrors: ImportLogDataError[] = [];
  const skippedRowSamples: ImportLogRowSample[] = [];
  let nextSkuSequence = 1;
  let skippedInvalidRows = 0;

  const rowRef = (sheetRowNumber: number) =>
    logContext ? formatWorkbookRowRef(sheetRowNumber, logContext) : `Row ${sheetRowNumber}`;

  const pushError = (error: ImportLogDataError) => {
    dataErrors.push(error);
    if (skippedRowSamples.length < maxSamples) {
      skippedRowSamples.push({
        sheetRowNumber: error.sheetRowNumber,
        status: "skipped_invalid",
        reason: error.message,
        sku: null,
        category: error.category,
        product: error.product,
      });
    }
  };

  for (const row of sheetRows) {
    const keyFields: ProductKeyFields = {
      category: row.category,
      productType: row.productType,
      product: row.product,
      elevateLevel: row.elevateLevel,
      style: row.style,
      colourOptions: row.colourOptions,
    };
    const productKeyComplete = isProductKeyComplete(keyFields);
    const supplierEmpty = isSupplierRowEmpty(row);

    if (!productKeyComplete && supplierEmpty) {
      skippedInvalidRows += 1;
      pushError({
        sheetRowNumber: row.sheetRowNumber,
        code: "incomplete_row",
        message: `${rowRef(row.sheetRowNumber)}: non-blank row missing product key and supplier data. Parsed key: ${formatParsedProductKey(keyFields)}.`,
        category: row.category || null,
        product: row.product || null,
        productKey: keySnapshot(keyFields),
      });
      continue;
    }

    if (!productKeyComplete && !supplierEmpty) {
      skippedInvalidRows += 1;
      const missing = missingProductKeyLabels(keyFields).join(", ");
      pushError({
        sheetRowNumber: row.sheetRowNumber,
        code: "supplier_without_product_key",
        message:
          `${rowRef(row.sheetRowNumber)}: supplier data present but product key incomplete (need ${missing}). ` +
          `Parsed key: ${formatParsedProductKey(keyFields)}. ` +
          describeSupplierPresence(row),
        category: row.category || null,
        product: row.product || null,
        productKey: keySnapshot(keyFields),
      });
      continue;
    }

    const productKey = buildProductKey(keyFields);
    let product = productsByKey.get(productKey);
    if (!product) {
      product = {
        skuId: formatSkuId(nextSkuSequence),
        category: row.category.trim(),
        productType: row.productType.trim(),
        product: row.product.trim(),
        elevateLevel: row.elevateLevel.trim(),
        style: row.style.trim(),
        colourOptions: row.colourOptions.trim(),
        uom: row.uom.trim(),
        append1Type: row.append1Type.trim(),
        append1Spec: row.append1Spec.trim(),
        append2Type: row.append2Type.trim(),
        append2Spec: row.append2Spec.trim(),
        append3Type: row.append3Type.trim(),
        append3Spec: row.append3Spec.trim(),
        sheetWidth: "",
        stockAvailable: row.stockAvailable.trim(),
        leadTime: row.leadTime.trim(),
        location: row.location.trim(),
        comments: row.comments.trim(),
        sourceSheetRows: [],
        isCurrent: true,
      };
      nextSkuSequence += 1;
      productsByKey.set(productKey, product);
    } else {
      for (const field of PRODUCT_MERGE_TEXT) {
        product[field] = mergeTextField(product[field], row[field]);
      }
    }

    // Last row seen for this product key wins (easy to find in the sheet after import).
    product.sourceSheetRows = [row.sheetRowNumber];

    if (supplierEmpty) {
      continue;
    }

    if (!isValidSupplierOption(row.supplierOption)) {
      skippedInvalidRows += 1;
      pushError({
        sheetRowNumber: row.sheetRowNumber,
        code: "invalid_supplier_option",
        message:
          `${rowRef(row.sheetRowNumber)}: supplier option must be ${MIN_SUPPLIER_OPTION}–${MAX_SUPPLIER_OPTION} (got ${formatSupplierOptionDisplay(row.supplierOption)}). ` +
          `Parsed key: ${formatParsedProductKey(keyFields)}.`,
        category: row.category || null,
        product: row.product || null,
        productKey: keySnapshot(keyFields),
      });
      continue;
    }

    const slotKey = `${product.skuId}::${row.supplierOption}`;
    if (supplierSlotKeys.has(slotKey)) {
      skippedInvalidRows += 1;
      pushError({
        sheetRowNumber: row.sheetRowNumber,
        code: "duplicate_supplier_option",
        message:
          `${rowRef(row.sheetRowNumber)}: duplicate supplier option ${row.supplierOption} for product ${product.skuId}. ` +
          `Parsed key: ${formatParsedProductKey(keyFields)}.`,
        category: row.category || null,
        product: row.product || null,
        productKey: keySnapshot(keyFields),
      });
      continue;
    }

    supplierSlotKeys.add(slotKey);
    suppliers.push({
      skuId: product.skuId,
      supplierOption: row.supplierOption,
      supplier: row.supplier.trim(),
      model: row.model.trim(),
      supplierSku: row.supplierSku.trim(),
      link: row.link.trim(),
      priceIncGst: row.priceIncGst,
      priceExcGst: row.priceExcGst,
      sourceSheetRows: [row.sheetRowNumber],
    });
  }

  const products = [...productsByKey.values()].sort((a, b) =>
    a.skuId.localeCompare(b.skuId, undefined, { sensitivity: "base" }),
  );

  return {
    products,
    suppliers,
    dataErrors,
    skippedInvalidRows,
    skippedRowSamples,
  };
}

function formatSupplierOptionDisplay(n: number | null): string {
  if (n == null) return "blank";
  return String(n);
}

function describeSupplierPresence(row: ParsedSheetRow): string {
  const parts: string[] = [];
  if (row.supplierOption != null) parts.push(`priority=${row.supplierOption}`);
  if (row.supplier.trim()) parts.push("supplier");
  if (row.model.trim()) parts.push("model");
  if (row.supplierSku.trim()) parts.push("supplierSku");
  if (row.link.trim()) parts.push("link");
  return parts.length ? `Present: ${parts.join(", ")}.` : "";
}
