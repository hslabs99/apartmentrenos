import { NextResponse } from "next/server";

import { getAdminFirestore } from "@/lib/firebase/admin";

import { ensureDataSupplierDiscountsBootstrap } from "@/lib/firestore/collection-bootstrap";



export const runtime = "nodejs";



/** Idempotent: ensures the `data_supplier_discounts` collection exists in Firestore. */

export async function POST() {

  try {

    const db = getAdminFirestore();

    await ensureDataSupplierDiscountsBootstrap(db);

    return NextResponse.json({ ok: true });

  } catch (e) {

    const message =

      e instanceof Error ? e.message : "Failed to initialize supplier discounts collection";

    return NextResponse.json({ error: message }, { status: 500 });

  }

}


