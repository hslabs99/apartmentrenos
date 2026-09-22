import { FieldValue, Timestamp } from "firebase-admin/firestore";
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
import { projectDocToPublic } from "@/lib/server/project-doc";
import { isProjectArchivedFlag } from "@/lib/project-archived";
import { isProjectTemplateFlag } from "@/lib/project-template";
import type { ProjectListItem } from "@/types/project";

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

function parseDateTime(value: unknown): Timestamp | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Timestamp.fromDate(d);
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

export async function GET(req: NextRequest) {
  try {
    console.info("[api/projects] GET start");
    const wantTemplates = req.nextUrl.searchParams.get("template") === "true";
    const wantArchived = req.nextUrl.searchParams.get("archived") === "true";
    const db = getAdminFirestore();
    await ensureProjectsBootstrap(db);
    const projSnap = await db.collection("projects").get();
    const pubs = projSnap.docs
      .filter((d) => !isProjectsMetaDocument(d.id))
      .map((d) => projectDocToPublic(d.id, d.data()))
      .filter((p) => {
        if (wantArchived) return isProjectArchivedFlag(p.archived);
        if (isProjectArchivedFlag(p.archived)) return false;
        return isProjectTemplateFlag(p.template) === wantTemplates;
      });
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
      template: false,
      archived: false,
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
      // Do not copy project Elevate/Style/Colour onto seeded areas — those fields are
      // per-area overrides. Line pricing uses the project default via
      // resolveEffectivePriceLevelId when the area has no override.
      for (const areaDoc of defaultAreaDocs) {
        await addProjectAreaWithSeed(db, ref.id, areaDoc.id, {}, {
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
