import {
  FieldValue,
  type DocumentData,
  Timestamp,
} from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isUsersMetaDocument } from "@/lib/firestore/users-collection";
import type { UserPublic } from "@/types/user";

export const runtime = "nodejs";

const createSchema = z.object({
  username: z.string().min(1).max(255),
  email: z.string().email(),
  phone: z.string().max(80).optional().default(""),
  type: z.enum(["user", "admin"]),
  businessName: z
    .string()
    .max(255)
    .optional()
    .transform((v) => (typeof v === "string" && v.trim() ? v.trim() : null)),
  relationshipTypeLookupId: z.number().int().optional().nullable(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

function docToPublic(id: string, data: DocumentData): UserPublic {
  return {
    id,
    username: String(data.username ?? ""),
    email: String(data.email ?? ""),
    phone: String(data.phone ?? ""),
    type: data.type === "admin" ? "admin" : "user",
    businessName: typeof data.businessName === "string" ? data.businessName : null,
    relationshipTypeLookupId:
      typeof data.relationshipTypeLookupId === "number" && Number.isFinite(data.relationshipTypeLookupId)
        ? data.relationshipTypeLookupId
        : null,
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}

export async function GET() {
  try {
    const db = getAdminFirestore();
    const snap = await db.collection("users").get();
    const users: UserPublic[] = snap.docs
      .filter((d) => !isUsersMetaDocument(d.id))
      .map((d) => docToPublic(d.id, d.data()))
      .sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: "base" }));
    return NextResponse.json({ users });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list users";
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
    const { password, ...rest } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 10);
    const db = getAdminFirestore();
    const ref = await db.collection("users").add({
      ...rest,
      passwordHash,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
