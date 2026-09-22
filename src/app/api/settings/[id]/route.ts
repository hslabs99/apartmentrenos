import {
  FieldValue,
  type DocumentData,
  Timestamp,
} from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureSettingsBootstrap } from "@/lib/firestore/collection-bootstrap";
import { isSettingsMetaDocument } from "@/lib/firestore/settings-collection";
import { isProtectedSettingKey } from "@/lib/settings-protected";
import type { SettingPublic } from "@/types/setting";

export const runtime = "nodejs";

const updateSchema = z.object({
  settingname: z.string().min(1).max(255).optional(),
  settingvalue: z.string().max(2000).optional(),
});

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

function docToPublic(id: string, data: DocumentData): SettingPublic {
  return {
    id,
    settingname: String(data.settingname ?? ""),
    settingvalue: String(data.settingvalue ?? ""),
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase();
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isSettingsMetaDocument(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = getAdminFirestore();
    await ensureSettingsBootstrap(db);
    const ref = db.collection("settings").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ setting: docToPublic(id, snap.data()!) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load setting";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isSettingsMetaDocument(id)) {
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
    const db = getAdminFirestore();
    await ensureSettingsBootstrap(db);
    const ref = db.collection("settings").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const currentName = String((snap.data() as DocumentData).settingname ?? "");
    /** Protected rows: value-only updates — never run duplicate-name logic. */
    if (isProtectedSettingKey(currentName)) {
      const update: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (parsed.data.settingvalue !== undefined) {
        update.settingvalue = parsed.data.settingvalue;
      }
      await ref.update(update);
      const next = await ref.get();
      return NextResponse.json({ setting: docToPublic(id, next.data()!) });
    }

    const nextName =
      parsed.data.settingname !== undefined
        ? parsed.data.settingname.trim()
        : currentName;
    const nameNorm = normalizeName(nextName);

    if (parsed.data.settingname !== undefined && isProtectedSettingKey(parsed.data.settingname)) {
      return NextResponse.json(
        { error: "That name is reserved for a protected system setting." },
        { status: 403 },
      );
    }

    if (parsed.data.settingname !== undefined) {
      const all = await db.collection("settings").get();
      const dup = all.docs.some((d) => {
        if (d.id === id || isSettingsMetaDocument(d.id)) return false;
        return normalizeName(String(d.data().settingname ?? "")) === nameNorm;
      });
      if (dup) {
        return NextResponse.json(
          { error: "A setting with this name already exists" },
          { status: 409 },
        );
      }
    }

    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (parsed.data.settingname !== undefined) update.settingname = nextName;
    if (parsed.data.settingvalue !== undefined) update.settingvalue = parsed.data.settingvalue;

    await ref.update(update);
    const next = await ref.get();
    return NextResponse.json({ setting: docToPublic(id, next.data()!) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update setting";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isSettingsMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot delete collection metadata" }, { status: 403 });
    }
    const db = getAdminFirestore();
    await ensureSettingsBootstrap(db);
    const ref = db.collection("settings").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const data = snap.data() as DocumentData;
    const n = String(data.settingname ?? "");
    if (isProtectedSettingKey(n)) {
      return NextResponse.json(
        { error: "Protected system settings cannot be deleted." },
        { status: 403 },
      );
    }
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete setting";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
