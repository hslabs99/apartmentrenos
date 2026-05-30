import type { ProductKeyFields } from "@/lib/sku/product-key";

export type ProductKeyLogContext = {
  headerRow1Based: number;
  dataStartRow1Based: number;
};

export function formatWorkbookRowRef(
  sheetRowNumber: number,
  ctx: ProductKeyLogContext,
): string {
  const dataRowIndex = sheetRowNumber - ctx.dataStartRow1Based + 1;
  return (
    `Workbook row ${sheetRowNumber} (Excel row ${sheetRowNumber}; ` +
    `data row #${dataRowIndex} after header on row ${ctx.headerRow1Based})`
  );
}

export function formatParsedProductKey(fields: ProductKeyFields): string {
  return [
    `Category="${truncate(fields.category)}"`,
    `ProductType="${truncate(fields.productType)}"`,
    `Product="${truncate(fields.product)}"`,
    `ElevateLevel="${truncate(fields.elevateLevel)}"`,
    `Style="${truncate(fields.style)}"`,
    `ColourOptions="${truncate(fields.colourOptions)}"`,
  ].join(", ");
}

function truncate(s: string, max = 80): string {
  const t = s.trim();
  if (!t) return "(empty)";
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}
