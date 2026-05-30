import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureProjectAreasBootstrap } from "@/lib/firestore/collection-bootstrap";
import { isProjectAreasMetaDocument } from "@/lib/firestore/projectareas-collection";
import { ensureProjectNumericId } from "@/lib/server/resolve-ids";
import { addProjectAreaWithSeed } from "@/lib/server/project-area-seeding";
import { backfillMissingProjectAreaDocIds } from "@/lib/server/project-area-line-backfill";
import { compareProjectAreasDisplayOrder } from "@/lib/project-area-display-order";
import { projectAreaDocToPublic } from "@/lib/server/project-area-to-public";
import type { ProjectAreaPublic } from "@/types/project-area";

export const runtime = "nodejs";

const numberOrNull = z.union([z.number(), z.null()]);

const createSchema = z.object({
  projectDocId: z.string().min(1),
  areaDocId: z.string().min(1),
  displayName: z.string().optional().nullable(),
  areanotes1: z.string().optional().default(""),
  areanotes2: z.string().optional().default(""),
  aream2: z.union([z.number(), z.null()]).optional(),
  areafinish: z.string().optional().default(""),
  pricelevelid: numberOrNull.optional(),
  style: z.union([z.string(), z.null()]).optional(),
  colour: z.union([z.string(), z.null()]).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const db = getAdminFirestore();
    await ensureProjectAreasBootstrap(db);
    const projectDocId = req.nextUrl.searchParams.get("projectDocId");
    const projectidParam = req.nextUrl.searchParams.get("projectid");

    let projectid: number;
    if (projectDocId) {
      projectid = await ensureProjectNumericId(db, projectDocId);
      await backfillMissingProjectAreaDocIds(db, projectid);
    } else if (projectidParam) {
      projectid = Number(projectidParam);
      if (!Number.isInteger(projectid)) {
        return NextResponse.json(
          { error: "projectid must be an integer" },
          { status: 400 },
        );
      }
      await backfillMissingProjectAreaDocIds(db, projectid);
    } else {
      return NextResponse.json(
        { error: "projectDocId or projectid is required" },
        { status: 400 },
      );
    }

    const snap = await db
      .collection("projectareas")
      .where("projectid", "==", projectid)
      .get();
    const projectAreas: ProjectAreaPublic[] = snap.docs
      .filter((d) => !isProjectAreasMetaDocument(d.id))
      .map((d) => projectAreaDocToPublic(d.id, d.data()))
      .sort(compareProjectAreasDisplayOrder);
    return NextResponse.json({ projectAreas });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list project areas";
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
    await ensureProjectAreasBootstrap(db);
    const payload = parsed.data;

    const { id, seededLineCount } = await addProjectAreaWithSeed(
      db,
      payload.projectDocId,
      payload.areaDocId,
      {
        areanotes1: payload.areanotes1,
        areanotes2: payload.areanotes2,
        aream2: payload.aream2 ?? null,
        areafinish: payload.areafinish,
        pricelevelid: payload.pricelevelid,
        style: payload.style ?? null,
        colour: payload.colour ?? null,
        displayName: payload.displayName ?? null,
      },
    );
    return NextResponse.json({ id, seededLineCount });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create project area";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
