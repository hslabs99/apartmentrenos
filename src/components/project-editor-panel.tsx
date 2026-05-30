"use client";

import { PriceLevelSelect } from "@/components/price-level-select";
import { ProjectsTabs } from "@/components/projects-tabs";
import { useLookups } from "@/lib/client/use-lookups";
import { distinctLookupValues, isAllLookupOrFilterValue } from "@/lib/lookup-list-values";
import { LOOKUP_TYPE_STYLE } from "@/lib/lookup-types";
import { PROJECT_STATUS_OPTIONS, type ProjectPublic, type ProjectStatus } from "@/types/project";
import type { SalesStaffPublic } from "@/types/sales-staff";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

async function readApiResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  const text = await res.text();
  throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
}

function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateInputToIso(s: string): string | null {
  if (!s.trim()) return null;
  return new Date(`${s}T12:00:00`).toISOString();
}

function numToInput(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

export function ProjectEditorPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectDocId = searchParams.get("id");
  const { lookups } = useLookups();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [salesStaff, setSalesStaff] = useState<SalesStaffPublic[]>([]);

  const [numericProjectId, setNumericProjectId] = useState<number | null>(null);
  const [projectname, setProjectname] = useState("");
  const [projectdescription, setProjectdescription] = useState("");
  const [projectm2Str, setProjectm2Str] = useState("");
  const [projectm2HardStr, setProjectm2HardStr] = useState("");
  const [projectm2SoftStr, setProjectm2SoftStr] = useState("");
  const [ceilingHeightMStr, setCeilingHeightMStr] = useState("");
  const [projectaddress, setProjectaddress] = useState("");
  const [projectcontact, setProjectcontact] = useState("");
  const [projecttel, setProjecttel] = useState("");
  const [projectemail, setProjectemail] = useState("");
  const [projectbrief, setProjectbrief] = useState("");
  const [projectfinish, setProjectfinish] = useState("");
  const [defaultstyle, setDefaultstyle] = useState("");
  const [defaultcolour, setDefaultcolour] = useState("");
  const [spec2, setSpec2] = useState("");
  const [spec3, setSpec3] = useState("");
  const [targetstartdate, setTargetstartdate] = useState("");
  const [projectnotes, setProjectnotes] = useState("");
  const [quotedby, setQuotedby] = useState("");
  const [quotedon, setQuotedon] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("Live");

  const loadSalesStaff = useCallback(async () => {
    const res = await fetch("/api/sales-staff");
    const data = (await res.json()) as { staff?: SalesStaffPublic[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Failed to load sales staff");
    setSalesStaff(data.staff ?? []);
  }, []);

  useEffect(() => {
    if (!projectDocId) {
      router.replace("/projects");
    }
  }, [projectDocId, router]);

  useEffect(() => {
    async function boot() {
      if (!projectDocId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        await Promise.all([
          loadSalesStaff(),
          (async () => {
            const res = await fetch(`/api/projects/${projectDocId}`);
            const data = await readApiResponse<{ project?: ProjectPublic; error?: string }>(res);
            if (!res.ok || !data.project) throw new Error(data.error ?? "Failed to load project");
            const p = data.project;
            setNumericProjectId(
              typeof p.projectid === "number" && Number.isInteger(p.projectid) ? p.projectid : null,
            );
            setProjectname(p.projectname);
            setProjectdescription(p.projectdescription);
            setProjectm2Str(numToInput(p.projectm2));
            setProjectm2HardStr(numToInput(p.projectm2hard));
            setProjectm2SoftStr(numToInput(p.projectm2soft));
            setCeilingHeightMStr(numToInput(p.ceilingheightm));
            setProjectaddress(p.projectaddress);
            setProjectcontact(p.projectcontact);
            setProjecttel(p.projecttel);
            setProjectemail(p.projectemail);
            setProjectbrief(p.projectbrief);
            setProjectfinish(p.projectfinish);
            setDefaultstyle(p.defaultstyle ?? "");
            setDefaultcolour(p.defaultcolour ?? "");
            setSpec2(p.spec2);
            setSpec3(p.spec3);
            setTargetstartdate(isoToDateInput(p.targetstartdate));
            setProjectnotes(p.projectnotes);
            setQuotedby(p.quotedby);
            setQuotedon(isoToDateInput(p.quotedon));
            setStatus(p.status);
          })(),
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load editor");
      } finally {
        setLoading(false);
      }
    }
    void boot();
  }, [projectDocId, loadSalesStaff]);

  function buildPayload(): Record<string, unknown> {
    const parseOptionalNumber = (label: string, raw: string): number | null => {
      const t = raw.trim();
      if (!t) return null;
      const n = Number(t);
      if (!Number.isFinite(n)) throw new Error(`${label} must be a valid number`);
      return n;
    };

    const projectm2 = parseOptionalNumber("M2 (total)", projectm2Str);
    const projectm2hard = parseOptionalNumber("M2 (Hard Floor)", projectm2HardStr);
    const projectm2soft = parseOptionalNumber("M2 (Soft Floor)", projectm2SoftStr);
    const ceilingheightm = parseOptionalNumber("Ceiling Height (m)", ceilingHeightMStr);

    return {
      projectname,
      status,
      projectdescription,
      projectm2,
      projectm2hard,
      projectm2soft,
      ceilingheightm,
      projectaddress,
      projectcontact,
      projecttel,
      projectemail,
      projectbrief,
      projectfinish,
      defaultstyle,
      defaultcolour,
      spec2,
      spec3,
      projectnotes,
      quotedby,
      targetstartdate: dateInputToIso(targetstartdate),
      quotedon: dateInputToIso(quotedon),
    };
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!projectDocId) return;
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      const res = await fetch(`/api/projects/${projectDocId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readApiResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Save failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950";

  const styleOptions = useMemo(() => {
    const out = distinctLookupValues(lookups, LOOKUP_TYPE_STYLE);
    const set = new Set(out);
    const saved = defaultstyle.trim();
    if (saved && !set.has(saved) && !isAllLookupOrFilterValue(saved)) {
      out.push(saved);
      out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    }
    return out;
  }, [lookups, defaultstyle]);

  if (!projectDocId) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <h1 className="text-xl font-normal tracking-tight text-sf-text md:text-2xl dark:text-zinc-50">Project</h1>
          <ProjectsTabs />
        </div>
        <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
          New projects are created from the Projects list. Taking you there…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h1 className="text-xl font-normal tracking-tight text-sf-text md:text-2xl dark:text-zinc-50">Project</h1>
        <ProjectsTabs />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-sf-text-secondary dark:text-zinc-400">Editing project details</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/projects"
            className="min-h-11 rounded-lg border border-sf-border-strong px-4 py-2.5 text-sm font-medium dark:border-zinc-600"
          >
            All projects
          </Link>
          <Link
            href={`/projects/project/workbench?id=${encodeURIComponent(projectDocId)}`}
            className="min-h-11 rounded-lg bg-sf-brand px-4 py-2.5 text-sm font-medium text-white"
          >
            Workbench
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border border-sf-border bg-sf-surface p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50 md:p-6">
        {loading ? (
          <p className="text-sf-text-secondary dark:text-zinc-400">Loading…</p>
        ) : (
          <form onSubmit={onSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Finish level
                </span>
                <PriceLevelSelect
                  value={projectfinish}
                  onChange={setProjectfinish}
                  className={inputClass}
                  emptyLabel="Select price level"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Style
                </span>
                <select
                  value={defaultstyle}
                  onChange={(e) => setDefaultstyle(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Not set</option>
                  {styleOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Colour
                </span>
                <input
                  value={defaultcolour}
                  onChange={(e) => setDefaultcolour(e.target.value)}
                  className={inputClass}
                  placeholder="Not set"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Project ID
                </span>
                <input
                  readOnly
                  value={numericProjectId != null ? String(numericProjectId) : "—"}
                  className={`${inputClass} bg-sf-page dark:bg-zinc-900`}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Name
                </span>
                <input
                  required
                  value={projectname}
                  onChange={(e) => setProjectname(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block sm:col-span-2 sm:max-w-xs">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Status
                </span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                  className={inputClass}
                >
                  {PROJECT_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Description
                </span>
                <textarea
                  value={projectdescription}
                  onChange={(e) => setProjectdescription(e.target.value)}
                  rows={3}
                  className={`${inputClass} min-h-[5rem] resize-y`}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  m² (total)
                </span>
                <input
                  value={projectm2Str}
                  onChange={(e) => setProjectm2Str(e.target.value)}
                  inputMode="decimal"
                  placeholder="Optional"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  M2 (Hard Floor)
                </span>
                <input
                  value={projectm2HardStr}
                  onChange={(e) => setProjectm2HardStr(e.target.value)}
                  inputMode="decimal"
                  placeholder="Optional"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  M2 (Soft Floor)
                </span>
                <input
                  value={projectm2SoftStr}
                  onChange={(e) => setProjectm2SoftStr(e.target.value)}
                  inputMode="decimal"
                  placeholder="Optional"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Ceiling Height (m)
                </span>
                <input
                  value={ceilingHeightMStr}
                  onChange={(e) => setCeilingHeightMStr(e.target.value)}
                  inputMode="decimal"
                  placeholder="Optional"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Address
                </span>
                <input
                  value={projectaddress}
                  onChange={(e) => setProjectaddress(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Contact
                </span>
                <input
                  value={projectcontact}
                  onChange={(e) => setProjectcontact(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Phone
                </span>
                <input
                  value={projecttel}
                  onChange={(e) => setProjecttel(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Email
                </span>
                <input
                  type="email"
                  value={projectemail}
                  onChange={(e) => setProjectemail(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Brief
                </span>
                <textarea
                  value={projectbrief}
                  onChange={(e) => setProjectbrief(e.target.value)}
                  rows={2}
                  className={`${inputClass} min-h-[4rem] resize-y`}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Target start
                </span>
                <input
                  type="date"
                  value={targetstartdate}
                  onChange={(e) => setTargetstartdate(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Spec 2
                </span>
                <input value={spec2} onChange={(e) => setSpec2(e.target.value)} className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Spec 3
                </span>
                <input value={spec3} onChange={(e) => setSpec3(e.target.value)} className={inputClass} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Notes
                </span>
                <textarea
                  value={projectnotes}
                  onChange={(e) => setProjectnotes(e.target.value)}
                  rows={3}
                  className={`${inputClass} min-h-[5rem] resize-y`}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Quoted by
                </span>
                <select
                  value={quotedby}
                  onChange={(e) => setQuotedby(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select sales staff</option>
                  {salesStaff.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Quoted on
                </span>
                <input
                  type="date"
                  value={quotedon}
                  onChange={(e) => setQuotedon(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="submit"
                disabled={saving}
                className="min-h-12 rounded-lg bg-sf-brand px-5 py-3 text-base font-medium text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save project"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
