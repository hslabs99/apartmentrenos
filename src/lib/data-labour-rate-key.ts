/** Natural key for labour rate rows (category + product type + product). */
export function dataLabourRateKey(
  category: string,
  productType: string,
  product: string,
): string {
  return [category, productType, product]
    .map((p) => p.trim().toLowerCase())
    .join("\x1e");
}
