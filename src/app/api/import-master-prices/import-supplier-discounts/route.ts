import { NextResponse } from "next/server";

import { getAdminFirestore } from "@/lib/firebase/admin";

import { runImportSupplierDiscounts } from "@/lib/server/import-supplier-discounts";



export const runtime = "nodejs";



/** POST — replace `data_supplier_discounts` from `Supplier Discounts` tab. */

export async function POST() {

  try {

    const db = getAdminFirestore();

    const result = await runImportSupplierDiscounts(db);

    return NextResponse.json({ ok: true, ...result });

  } catch (e) {

    const message = e instanceof Error ? e.message : "Failed to import supplier discounts";

    return NextResponse.json({ error: message }, { status: 500 });

  }

}


