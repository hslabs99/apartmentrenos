import { FieldValue, type DocumentData, Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isUsersMetaDocument } from "@/lib/firestore/users-collection";
import type { UserPublic } from "@/types/user";

export const runtime = "nodejs";

const updateSchema = z.object({
  username: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(80).optional(),
  type: z.enum(["user", "admin"]).optional(),
  businessName: z
    .string()
    .max(255)
    .optional()
    .transform((v) => (typeof v === "string" && v.trim() ? v.trim() : null)),
  relationshipTypeLookupId: z.number().int().optional().nullable(),
  password: z
    .union([z.string().min(8, "Password must be at least 8 characters"), z.literal("")])
    .optional(),
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

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isUsersMetaDocument(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = getAdminFirestore();
    const ref = db.collection("users").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ user: docToPublic(id, snap.data()!) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isUsersMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot modify collection metadata" }, { status: 403 });
    }
    const raw = await req.json();
    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { password, ...fields } = parsed.data;
    const db = getAdminFirestore();
    const ref = db.collection("users").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) update[k] = v;
    }
    if (password && password.length > 0) {
      update.passwordHash = await bcrypt.hash(password, 10);
    }

    await ref.update(update);
    const next = await ref.get();
    return NextResponse.json({ user: docToPublic(id, next.data()!) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isUsersMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot delete collection metadata" }, { status: 403 });
    }
    const db = getAdminFirestore();
    const ref = db.collection("users").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
