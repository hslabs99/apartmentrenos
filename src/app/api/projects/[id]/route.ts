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
import {
  isProjectArchivedFlag,
  projectHardDeletePrefixMatches,
} from "@/lib/project-archived";
import { hardDeleteArchivedProject } from "@/lib/server/delete-project-owned-data";
import { parseMarginPercent } from "@/lib/settings-margin";
import { projectDocToPublic } from "@/lib/server/project-doc";

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
  marginpct: z.number().min(0).max(999).optional(),
  archived: z.boolean().optional(),
});

const hardDeleteSchema = z.object({
  confirmNamePrefix: z.string().min(1),
});

function parseDateTime(value: unknown): Timestamp | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Timestamp.fromDate(d);
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
    return NextResponse.json({ project: projectDocToPublic(id, snap.data()!) });
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

    const current = snap.data() as DocumentData;
    const currentlyArchived = isProjectArchivedFlag(current.archived);
    const d = parsed.data;
    const keys = Object.keys(d) as Array<keyof typeof d>;
    const onlyArchivedFlag =
      keys.length === 1 && d.archived !== undefined;
    if (currentlyArchived && !onlyArchivedFlag) {
      return NextResponse.json(
        { error: "Restore this project from Archives before editing it" },
        { status: 409 },
      );
    }

    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
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
    if (d.marginpct !== undefined) update.marginpct = parseMarginPercent(String(d.marginpct));
    if (d.archived !== undefined) update.archived = d.archived;

    await ref.update(update);
    const next = await ref.get();
    return NextResponse.json({ project: projectDocToPublic(id, next.data()!) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isProjectsMetaDocument(id)) {
      return NextResponse.json(
        { error: "Cannot delete collection metadata" },
        { status: 403 },
      );
    }
    const raw = await req.json().catch(() => null);
    const parsed = hardDeleteSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Type the first characters of the project name to confirm permanent delete" },
        { status: 400 },
      );
    }
    const db = getAdminFirestore();
    const ref = db.collection("projects").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const data = snap.data() as DocumentData;
    if (!isProjectArchivedFlag(data.archived)) {
      return NextResponse.json(
        { error: "Archive this project first before permanently deleting it" },
        { status: 409 },
      );
    }
    const projectname = String(data.projectname ?? "");
    if (!projectHardDeletePrefixMatches(projectname, parsed.data.confirmNamePrefix)) {
      return NextResponse.json(
        { error: "Name confirmation does not match this project" },
        { status: 400 },
      );
    }
    await hardDeleteArchivedProject(db, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete project";
    const status =
      message === "Project not found"
        ? 404
        : message === "Cannot delete collection metadata"
          ? 403
          : message === "Archive this project first before permanently deleting it" ||
              message === "Project was restored during delete; aborting"
            ? 409
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
