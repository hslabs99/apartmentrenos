import {
  FieldValue,
  type DocumentData,
  Timestamp,
} from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isAreasMetaDocument } from "@/lib/firestore/areas-collection";
import { ensureProjectsBootstrap } from "@/lib/firestore/collection-bootstrap";
import { isProjectsMetaDocument } from "@/lib/firestore/projects-collection";
import { allocateNextSequence } from "@/lib/firestore/sequences";
import { areaCountsByProjectDocId } from "@/lib/server/project-area-counts";
import { finalTotalsByProjectDocId } from "@/lib/server/project-list-final-totals";
import {
  addProjectAreaWithSeed,
  loadQuoteByObjectIdMap,
} from "@/lib/server/project-area-seeding";
import { compareTemplateDocs } from "@/lib/server/template-sort-order";
import { parseProjectStatus } from "@/lib/project-status";
import type { ProjectListItem, ProjectPublic } from "@/types/project";

export const runtime = "nodejs";

const numberOrNull = z.union([z.number(), z.null()]);

const projectBodySchema = z.object({
  projectname: z.string().min(1, "Name is required"),
  projectdescription: z.string().optional().default(""),
  projectm2: numberOrNull.optional(),
  projectm2hard: numberOrNull.optional(),
  projectm2soft: numberOrNull.optional(),
  ceilingheightm: numberOrNull.optional(),
  projectaddress: z.string().optional().default(""),
  projectcontact: z.string().optional().default(""),
  projecttel: z.string().optional().default(""),
  projectemail: z.string().optional().default(""),
  projectbrief: z.string().optional().default(""),
  projectfinish: z.string().optional().default(""),
  defaultstyle: z.string().optional().default(""),
  defaultcolour: z.string().optional().default(""),
  spec2: z.string().optional().default(""),
  spec3: z.string().optional().default(""),
  targetstartdate: z.union([z.string(), z.null()]).optional(),
  projectnotes: z.string().optional().default(""),
  quotedby: z.string().optional().default(""),
  quotedon: z.union([z.string(), z.null()]).optional(),
  defaultpricelevelid: numberOrNull.optional(),
});

/** POST /api/projects — default tier is required so seeded areas and scopes have an effective price level. */
const projectCreateBodySchema = projectBodySchema.extend({
  defaultpricelevelid: z.number().int("Select a valid default price level (integer tier ID)"),
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
    marginpct: numOrNull(data.marginpct) ?? null,
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}

function bodyToFirestore(
  parsed: z.infer<typeof projectBodySchema>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    projectname: parsed.projectname,
    projectdescription: parsed.projectdescription,
    projectm2: parsed.projectm2 ?? null,
    projectm2hard: parsed.projectm2hard ?? null,
    projectm2soft: parsed.projectm2soft ?? null,
    ceilingheightm: parsed.ceilingheightm ?? null,
    projectaddress: parsed.projectaddress,
    projectcontact: parsed.projectcontact,
    projecttel: parsed.projecttel,
    projectemail: parsed.projectemail,
    projectbrief: parsed.projectbrief,
    projectfinish: parsed.projectfinish,
    defaultstyle: parsed.defaultstyle,
    defaultcolour: parsed.defaultcolour,
    spec2: parsed.spec2,
    spec3: parsed.spec3,
    projectnotes: parsed.projectnotes,
    quotedby: parsed.quotedby,
  };
  const ts = parseDateTime(parsed.targetstartdate);
  out.targetstartdate = ts ?? null;
  const qo = parseDateTime(parsed.quotedon);
  out.quotedon = qo ?? null;
  if (parsed.defaultpricelevelid !== undefined) {
    out.defaultpricelevelid = parsed.defaultpricelevelid;
  }
  return out;
}

export async function GET() {
  try {
    console.info("[api/projects] GET start");
    const db = getAdminFirestore();
    await ensureProjectsBootstrap(db);
    const projSnap = await db.collection("projects").get();
    const pubs = projSnap.docs
      .filter((d) => !isProjectsMetaDocument(d.id))
      .map((d) => docToPublic(d.id, d.data()));
    const areaMap = await areaCountsByProjectDocId(db, pubs);
    const finalMap = await finalTotalsByProjectDocId(db, pubs);
    const projects: ProjectListItem[] = pubs
      .map((pub) => ({
        ...pub,
        areaCount: areaMap.get(pub.id) ?? 0,
        finalTotal: finalMap.get(pub.id) ?? 0,
      }))
      .sort((a, b) =>
        a.projectname.localeCompare(b.projectname, undefined, {
          sensitivity: "base",
        }),
      );
    return NextResponse.json({ projects });
  } catch (e) {
    console.error("[api/projects] GET failed", e);
    const message = e instanceof Error ? e.message : "Failed to list projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = projectCreateBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const db = getAdminFirestore();
    await ensureProjectsBootstrap(db);
    const projectid = await allocateNextSequence(db, "projectid");
    const ref = await db.collection("projects").add({
      ...bodyToFirestore(parsed.data),
      projectid,
      status: "Live",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const defaultAreasSnap = await db
      .collection("areas")
      .where("default", "==", true)
      .get();
    const defaultAreaDocs = defaultAreasSnap.docs.filter(
      (d) => !isAreasMetaDocument(d.id),
    );
    defaultAreaDocs.sort((a, b) =>
      compareTemplateDocs(a, b, (data) => String(data.areaname ?? "")),
    );

    if (defaultAreaDocs.length > 0) {
      const quoteByObjectId = await loadQuoteByObjectIdMap(db);
      const pl = parsed.data.defaultpricelevelid;
      const seedPayload = { pricelevelid: pl };
      for (const areaDoc of defaultAreaDocs) {
        await addProjectAreaWithSeed(db, ref.id, areaDoc.id, seedPayload, {
          quoteByObjectId,
        });
      }
    }

    return NextResponse.json({ id: ref.id, projectid });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
