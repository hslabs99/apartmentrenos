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

type SkuImportErrorCode = ImportLogDataError["code"];

/** Sheet row to open in Google Sheets — product-key origin for key errors, actual row for supplier-slot errors. */
function logSheetRowForError(row: ParsedSheetRow, code: SkuImportErrorCode): number {
  if (code === "supplier_without_product_key" || code === "incomplete_row") {
    return row.productKeySourceRowNumber;
  }
  return row.sheetRowNumber;
}

function formatErrorRowRef(row: ParsedSheetRow, code: SkuImportErrorCode): string {
  const logRow = logSheetRowForError(row, code);
  const base = formatWorkbookRowRef(logRow);
  if (logRow !== row.sheetRowNumber) {
    return `${base} (supplier option on row ${row.sheetRowNumber})`;
  }
  return base;
}

function buildDataError(
  row: ParsedSheetRow,
  code: SkuImportErrorCode,
  messageBody: string,
  keyFields: ProductKeyFields,
): ImportLogDataError {
  const logRow = logSheetRowForError(row, code);
  const triggerRow = row.sheetRowNumber;
  const triggerNote =
    logRow !== triggerRow ? ` Triggered on supplier row ${triggerRow}.` : "";
  return {
    sheetRowNumber: logRow,
    triggerSheetRowNumber: logRow !== triggerRow ? triggerRow : undefined,
    code,
    message: `${formatErrorRowRef(row, code)}: ${messageBody}${triggerNote}`,
    category: keyFields.category.trim() || null,
    product: keyFields.product.trim() || null,
    productKey: keySnapshot(keyFields),
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
  _logContext?: ProductKeyLogContext,
): BuildSkuImportResult {
  const productsByKey = new Map<string, DataSku>();
  const suppliers: DataSkuSupplier[] = [];
  const supplierSlotKeys = new Set<string>();
  const dataErrors: ImportLogDataError[] = [];
  const skippedRowSamples: ImportLogRowSample[] = [];
  let nextSkuSequence = 1;
  let skippedInvalidRows = 0;

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
      pushError(
        buildDataError(
          row,
          "incomplete_row",
          `non-blank row missing product key and supplier data. Parsed key: ${formatParsedProductKey(keyFields)}.`,
          keyFields,
        ),
      );
      continue;
    }

    if (!productKeyComplete && !supplierEmpty) {
      skippedInvalidRows += 1;
      const missing = missingProductKeyLabels(keyFields).join(", ");
      pushError(
        buildDataError(
          row,
          "supplier_without_product_key",
          `supplier data present but product key incomplete (need ${missing}). Parsed key: ${formatParsedProductKey(keyFields)}. ${describeSupplierPresence(row)}`,
          keyFields,
        ),
      );
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
        calcM2: false,
        calculatedM2: null,
      };
      nextSkuSequence += 1;
      productsByKey.set(productKey, product);
    } else {
      for (const field of PRODUCT_MERGE_TEXT) {
        product[field] = mergeTextField(product[field], row[field]);
      }
    }

    // Product origin row — where cols A–C were set (not last supplier continuation row).
    product.sourceSheetRows = [row.productKeySourceRowNumber];

    if (supplierEmpty) {
      continue;
    }

    if (!isValidSupplierOption(row.supplierOption)) {
      skippedInvalidRows += 1;
      pushError(
        buildDataError(
          row,
          "invalid_supplier_option",
          `supplier option must be ${MIN_SUPPLIER_OPTION}–${MAX_SUPPLIER_OPTION} (got ${formatSupplierOptionDisplay(row.supplierOption)}). Parsed key: ${formatParsedProductKey(keyFields)}.`,
          keyFields,
        ),
      );
      continue;
    }

    const slotKey = `${product.skuId}::${row.supplierOption}`;
    if (supplierSlotKeys.has(slotKey)) {
      skippedInvalidRows += 1;
      pushError(
        buildDataError(
          row,
          "duplicate_supplier_option",
          `duplicate supplier option ${row.supplierOption} for product ${product.skuId}. Parsed key: ${formatParsedProductKey(keyFields)}.`,
          keyFields,
        ),
      );
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
