import {
  FieldValue,
  type DocumentData,
  Timestamp,
} from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isSalesStaffMetaDocument } from "@/lib/firestore/sales-staff-collection";
import type { SalesStaffPublic } from "@/types/sales-staff";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  company: z.string().max(255).optional().default(""),
  email: z.string().email(),
  phone: z.string().max(80).optional().default(""),
});

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

function docToPublic(id: string, data: DocumentData): SalesStaffPublic {
  return {
    id,
    name: String(data.name ?? ""),
    company: String(data.company ?? ""),
    email: String(data.email ?? ""),
    phone: String(data.phone ?? ""),
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}

export async function GET() {
  try {
    const db = getAdminFirestore();
    const snap = await db.collection("sales_staff").get();
    const staff: SalesStaffPublic[] = snap.docs
      .filter((d) => !isSalesStaffMetaDocument(d.id))
      .map((d) => docToPublic(d.id, d.data()))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return NextResponse.json({ staff });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list sales staff";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const db = getAdminFirestore();
    const ref = await db.collection("sales_staff").add({
      ...parsed.data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create sales staff";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
