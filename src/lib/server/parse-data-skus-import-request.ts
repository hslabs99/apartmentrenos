import type { NextRequest } from "next/server";
import {
  parseDataSkusImportOptions,
  type DataSkusImportOptions,
} from "@/lib/server/import-data-skus";

/** POST body is optional JSON `{ removeProductsNotInSheet?: boolean }`. */
export async function readDataSkusImportOptions(
  req: NextRequest,
): Promise<DataSkusImportOptions> {
  try {
    const text = await req.text();
    if (!text.trim()) return {};
    return parseDataSkusImportOptions(JSON.parse(text) as unknown);
  } catch {
    return {};
  }
}
