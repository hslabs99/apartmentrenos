import {
  FieldValue,
  type DocumentData,
  Timestamp,
} from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureProjectsBootstrap } from "@/lib/firestore/collection-bootstrap";
import { isProjectsMetaDocument } from "@/lib/firestore/projects-collection";
import { parseProjectStatus } from "@/lib/project-status";
import type { ProjectPublic } from "@/types/project";

export const runtime = "nodejs";

const numberOrNull = z.union([z.number(), z.null()]);

const updateSchema = z.object({
  projectname: z.string().min(1).optional(),
  status: z.enum(["Live", "Archive"]).optional(),
  projectdescription: z.string().optional(),
  projectm2: numberOrNull.optional(),
  projectm2hard: numberOrNull.optional(),
  projectm2soft: numberOrNull.optional(),
  ceilingheightm: numberOrNull.optional(),
  projectaddress: z.string().optional(),
  projectcontact: z.string().optional(),
  projecttel: z.string().optional(),
  projectemail: z.string().optional(),
  projectbrief: z.string().optional(),
  projectfinish: z.string().optional(),
  spec2: z.string().optional(),
  spec3: z.string().optional(),
  targetstartdate: z.union([z.string(), z.null()]).optional(),
  projectnotes: z.string().optional(),
  quotedby: z.string().optional(),
  quotedon: z.union([z.string(), z.null()]).optional(),
  defaultpricelevelid: numberOrNull.optional(),
  defaultstyle: z.string().max(255).optional(),
  defaultcolour: z.string().max(255).optional(),
});

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

function parseDateTime(value: unknown): Timestamp | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Timestamp.fromDate(d);
}

function numOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

function docToPublic(id: string, data: DocumentData): ProjectPublic {
  const tid = data.targetstartdate as Timestamp | undefined;
  const qd = data.quotedon as Timestamp | undefined;
  let projectid: number | null | undefined =
    typeof data.projectid === "number" ? data.projectid : undefined;
  if (data.projectid === null) projectid = null;
  return {
    id,
    projectid,
    status: parseProjectStatus(data.status),
    projectname: String(data.projectname ?? ""),
    projectdescription: String(data.projectdescription ?? ""),
    projectm2: numOrNull(data.projectm2),
    projectm2hard: numOrNull(data.projectm2hard),
    projectm2soft: numOrNull(data.projectm2soft),
    ceilingheightm: numOrNull(data.ceilingheightm),
    projectaddress: String(data.projectaddress ?? ""),
    projectcontact: String(data.projectcontact ?? ""),
    projecttel: String(data.projecttel ?? ""),
    projectemail: String(data.projectemail ?? ""),
    projectbrief: String(data.projectbrief ?? ""),
    projectfinish: String(data.projectfinish ?? ""),
    spec2: String(data.spec2 ?? ""),
    spec3: String(data.spec3 ?? ""),
    targetstartdate: tsToIso(tid),
    projectnotes: String(data.projectnotes ?? ""),
    quotedby: String(data.quotedby ?? ""),
    quotedon: tsToIso(qd),
    defaultpricelevelid: numOrNull(data.defaultpricelevelid) ?? null,
    defaultstyle: String(data.defaultstyle ?? ""),
    defaultcolour: String(data.defaultcolour ?? ""),
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isProjectsMetaDocument(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = getAdminFirestore();
    await ensureProjectsBootstrap(db);
    const ref = db.collection("projects").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ project: docToPublic(id, snap.data()!) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isProjectsMetaDocument(id)) {
      return NextResponse.json(
        { error: "Cannot modify collection metadata" },
        { status: 403 },
      );
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
    await ensureProjectsBootstrap(db);
    const ref = db.collection("projects").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    const d = parsed.data;
    if (d.projectname !== undefined) update.projectname = d.projectname;
    if (d.status !== undefined) update.status = d.status;
    if (d.projectdescription !== undefined)
      update.projectdescription = d.projectdescription;
    if (d.projectm2 !== undefined) update.projectm2 = d.projectm2;
    if (d.projectm2hard !== undefined) update.projectm2hard = d.projectm2hard;
    if (d.projectm2soft !== undefined) update.projectm2soft = d.projectm2soft;
    if (d.ceilingheightm !== undefined) update.ceilingheightm = d.ceilingheightm;
    if (d.projectaddress !== undefined) update.projectaddress = d.projectaddress;
    if (d.projectcontact !== undefined) update.projectcontact = d.projectcontact;
    if (d.projecttel !== undefined) update.projecttel = d.projecttel;
    if (d.projectemail !== undefined) update.projectemail = d.projectemail;
    if (d.projectbrief !== undefined) update.projectbrief = d.projectbrief;
    if (d.projectfinish !== undefined) update.projectfinish = d.projectfinish;
    if (d.spec2 !== undefined) update.spec2 = d.spec2;
    if (d.spec3 !== undefined) update.spec3 = d.spec3;
    if (d.projectnotes !== undefined) update.projectnotes = d.projectnotes;
    if (d.quotedby !== undefined) update.quotedby = d.quotedby;
    if (d.targetstartdate !== undefined) {
      update.targetstartdate = parseDateTime(d.targetstartdate) ?? null;
    }
    if (d.quotedon !== undefined) {
      update.quotedon = parseDateTime(d.quotedon) ?? null;
    }
    if (d.defaultpricelevelid !== undefined) {
      update.defaultpricelevelid = d.defaultpricelevelid;
    }
    if (d.defaultstyle !== undefined) update.defaultstyle = d.defaultstyle;
    if (d.defaultcolour !== undefined) update.defaultcolour = d.defaultcolour;

    await ref.update(update);
    const next = await ref.get();
    return NextResponse.json({ project: docToPublic(id, next.data()!) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isProjectsMetaDocument(id)) {
      return NextResponse.json(
        { error: "Cannot delete collection metadata" },
        { status: 403 },
      );
    }
    const db = getAdminFirestore();
    const ref = db.collection("projects").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const data = snap.data() as DocumentData;
    const projectid =
      typeof data.projectid === "number" && Number.isInteger(data.projectid)
        ? data.projectid
        : null;
    if (projectid != null) {
      const pa = await db.collection("projectareas").where("projectid", "==", projectid).get();
      if (!pa.empty) {
        const batch = db.batch();
        pa.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      const pao = await db
        .collection("projectareaobjects")
        .where("projectid", "==", projectid)
        .get();
      if (!pao.empty) {
        const batch = db.batch();
        pao.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
