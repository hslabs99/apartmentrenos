"use client";

import { readApiJson } from "@/lib/client/read-api-json";
import { sfDataSurface, sfPrimaryToolbarButton } from "@/lib/sf-layout";
import type { CascadePublic } from "@/types/cascade-public";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  refreshKey?: number;
};

export function CascadesTablePanel({ refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<CascadePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cascades");
      const data = await readApiJson<{ items: CascadePublic[]; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to load cascades");
      setRows(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const displayRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.level.toLowerCase().includes(q) ||
        r.style.toLowerCase().includes(q) ||
        r.colour.toLowerCase().includes(q),
    );
  }, [rows, filter]);

  return (
    <div className="-mx-4 flex flex-col gap-4 md:-mx-6 lg:-mx-8">
      <section className={`${sfDataSurface} mx-4 flex flex-col gap-4 p-4 md:mx-6 md:p-5 lg:mx-8`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-sf-text dark:text-zinc-100">Cascades</h2>
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
              Read-only view of <code className="text-xs">cascades</code> (Level, Style, Colour from
              Cascading Restrictions sheet).
            </p>
          </div>
          <button type="button" onClick={() => void load()} className={sfPrimaryToolbarButton}>
            Refresh
          </button>
        </div>

        <label className="flex max-w-md flex-col gap-1 text-sm">
          <span className="text-sf-text-secondary dark:text-zinc-400">Filter</span>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Level, style, colour…"
            className="min-h-10 rounded border border-sf-border bg-sf-surface px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          />
        </label>

        {error ? (
          <p className="text-sm text-red-800 dark:text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className={`${sfDataSurface} mx-4 overflow-hidden md:mx-6 lg:mx-8`}>
        <div className="max-h-[calc(100dvh-14rem)] overflow-auto px-4 py-3 md:px-5 lg:px-6">
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-sf-surface dark:bg-zinc-900">
              <tr className="border-b border-sf-border dark:border-zinc-700">
                <th className="py-2 pr-3 font-medium">Level</th>
                <th className="py-2 pr-3 font-medium">Style</th>
                <th className="py-2 pr-3 font-medium">Colour</th>
                <th className="py-2 pr-3 font-medium">Sheet row</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-sf-text-secondary dark:text-zinc-400">
                    Loading cascades…
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-sf-text-secondary dark:text-zinc-400">
                    {rows.length === 0
                      ? "No cascades yet — run Import Cascades on the Import tab."
                      : "No rows match your filter."}
                  </td>
                </tr>
              ) : (
                displayRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-sf-border/80 dark:border-zinc-800"
                  >
                    <td className="py-2 pr-3 whitespace-nowrap">{row.level || "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{row.style || "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{row.colour || "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-sf-text-secondary">
                      {row.sheetRow > 0 ? row.sheetRow : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading ? (
          <p className="border-t border-sf-border px-4 py-2 text-xs text-sf-text-secondary dark:border-zinc-700 dark:text-zinc-400 md:px-5 lg:px-6">
            Showing {displayRows.length} of {rows.length} row(s)
          </p>
        ) : null}
      </section>
    </div>
  );
}
