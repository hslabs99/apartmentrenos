/** A1 range for a tab title that may contain spaces or quotes. */
export function quoteSheetTabForRange(tabTitle: string): string {
  const escaped = tabTitle.replace(/'/g, "''");
  return `'${escaped}'`;
}
