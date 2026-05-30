import { FieldValue, type DocumentData, Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureSettingsBootstrap } from "@/lib/firestore/collection-bootstrap";
import { isSettingsMetaDocument } from "@/lib/firestore/settings-collection";
import { isMarginSettingKey } from "@/lib/settings-margin";
import { isLoadRateSettingKey } from "@/lib/settings-load-rates";
import type { SettingPublic } from "@/types/setting";

export const runtime = "nodejs";

const createSchema = z.object({
  settingname: z.string().min(1).max(255),
  settingvalue: z.string().max(2000),
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

export async function GET() {
  try {
    const db = getAdminFirestore();
    await ensureSettingsBootstrap(db);
    const snap = await db.collection("settings").get();
    const settings: SettingPublic[] = snap.docs
      .filter((d) => !isSettingsMetaDocument(d.id))
      .map((d) => docToPublic(d.id, d.data()))
      .sort((a, b) => {
        const n = a.settingname.localeCompare(b.settingname, undefined, { sensitivity: "base" });
        if (n !== 0) return n;
        return a.id.localeCompare(b.id);
      });
    return NextResponse.json({ settings });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list settings";
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
    await ensureSettingsBootstrap(db);
    const nameNorm = normalizeName(parsed.data.settingname);
    if (isMarginSettingKey(parsed.data.settingname)) {
      return NextResponse.json(
        {
          error:
            'The name "margin" is reserved. Edit the existing margin setting to change its value.',
        },
        { status: 403 },
      );
    }
    if (isLoadRateSettingKey(parsed.data.settingname)) {
      return NextResponse.json(
        {
          error:
            "Load rate setting names are reserved. Edit the existing load rate rows under System → Settings.",
        },
        { status: 403 },
      );
    }
    const existing = await db.collection("settings").get();
    const dup = existing.docs.some((d) => {
      if (isSettingsMetaDocument(d.id)) return false;
      return normalizeName(String(d.data().settingname ?? "")) === nameNorm;
    });
    if (dup) {
      return NextResponse.json(
        { error: "A setting with this name already exists" },
        { status: 409 },
      );
    }
    const ref = await db.collection("settings").add({
      settingname: parsed.data.settingname.trim(),
      settingvalue: parsed.data.settingvalue,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create setting";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
