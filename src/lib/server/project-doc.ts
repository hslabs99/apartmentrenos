import { type DocumentData, Timestamp } from "firebase-admin/firestore";
import { isProjectArchivedFlag } from "@/lib/project-archived";
import { parseProjectStatus } from "@/lib/project-status";
import { isProjectTemplateFlag } from "@/lib/project-template";
import type { ProjectPublic } from "@/types/project";

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

function numOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

/** Map a Firestore project document to the public API shape. Missing `template` is false. */
export function projectDocToPublic(id: string, data: DocumentData): ProjectPublic {
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
    template: isProjectTemplateFlag(data.template),
    archived: isProjectArchivedFlag(data.archived),
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}
