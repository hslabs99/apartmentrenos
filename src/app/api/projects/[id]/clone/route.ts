import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isProjectsMetaDocument } from "@/lib/firestore/projects-collection";
import { cloneProject } from "@/lib/server/clone-project";

export const runtime = "nodejs";

const numberOrNull = z.union([z.number(), z.null()]);

const cloneBodySchema = z.object({
  projectname: z.string().min(1, "Name is required"),
  template: z.boolean().optional(),
  overlay: z
    .object({
      projectdescription: z.string().optional(),
      projectm2: numberOrNull.optional(),
      defaultpricelevelid: numberOrNull.optional(),
      projectfinish: z.string().optional(),
      defaultstyle: z.string().optional(),
      defaultcolour: z.string().optional(),
    })
    .optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isProjectsMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot clone collection metadata" }, { status: 403 });
    }
    const raw = await req.json();
    const parsed = cloneBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const db = getAdminFirestore();
    const result = await cloneProject(db, {
      sourceProjectDocId: id,
      projectname: parsed.data.projectname,
      template: parsed.data.template,
      overlay: parsed.data.overlay,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to clone project";
    const status =
      message === "Project not found" || message === "Invalid source project"
        ? 404
        : message === "Restore this project from Archives before cloning it"
          ? 409
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
