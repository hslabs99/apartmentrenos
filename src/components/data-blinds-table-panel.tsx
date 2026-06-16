"use client";

import { readApiJson } from "@/lib/client/read-api-json";
import { BLIND_WIDTH_MM_VALUES } from "@/lib/google/blinds-width-columns";
import { sfDataSurface, sfPrimaryToolbarButton } from "@/lib/sf-layout";
import type {
  DataBlindFooterPublic,
  DataBlindPublic,
  DataBlindTypePublic,
} from "@/types/data-blind-public";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  refreshKey?: number;
};

const EMPTY_TYPE = "";

function distinctTypes(types: DataBlindTypePublic[], rows: DataBlindPublic[]): string[] {
  const set = new Set<string>();
  for (const t of types) set.add(t.typeName);
  for (const r of rows) if (r.type) set.add(r.type);
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function DataBlindsTablePanel({ refreshKey = 0 }: Props) {
  const [types, setTypes] = useState<DataBlindTypePublic[]>([]);
  const [rows, setRows] = useState<DataBlindPublic[]>([]);
  const [footers, setFooters] = useState<DataBlindFooterPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState(EMPTY_TYPE);
  const [view, setView] = useState<"prices" | "types" | "footers">("prices");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [typesRes, blindsRes, footersRes] = await Promise.all([
        fetch("/api/data-blinds-types"),
        fetch("/api/data-blinds"),
        fetch("/api/data-blinds-footers"),
      ]);
      const typesData = await readApiJson<{ items: DataBlindTypePublic[]; error?: string }>(
        typesRes,
      );
      const blindsData = await readApiJson<{ items: DataBlindPublic[]; error?: string }>(blindsRes);
      const footersData = await readApiJson<{ items: DataBlindFooterPublic[]; error?: string }>(
        footersRes,
      );
      if (!typesRes.ok) throw new Error(typesData.error ?? "Failed to load types");
      if (!blindsRes.ok) throw new Error(blindsData.error ?? "Failed to load prices");
      if (!footersRes.ok) throw new Error(footersData.error ?? "Failed to load footers");
      setTypes(typesData.items ?? []);
      setRows(blindsData.items ?? []);
      setFooters(footersData.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setTypes([]);
      setRows([]);
      setFooters([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const typeOptions = useMemo(() => distinctTypes(types, rows), [types, rows]);

  const selectedTypeMeta = useMemo(
    () => types.find((t) => t.typeName === typeFilter) ?? null,
    [types, typeFilter],
  );

  const filteredRows = useMemo(() => {
    if (!typeFilter) return rows;
    return rows.filter((r) => r.type === typeFilter);
  }, [rows, typeFilter]);

  const filteredFooters = useMemo(() => {
    if (!typeFilter) return footers;
    return footers.filter((f) => f.type === typeFilter);
  }, [footers, typeFilter]);

  const activeWidths = useMemo(() => {
    const metaMin = selectedTypeMeta?.widthMinMm;
    const metaMax = selectedTypeMeta?.widthMaxMm;
    if (metaMin != null && metaMax != null) {
      return BLIND_WIDTH_MM_VALUES.filter((w) => w >= metaMin && w <= metaMax);
    }
    const used = new Set<number>();
    for (const row of filteredRows) {
      for (const w of BLIND_WIDTH_MM_VALUES) {
        const key = `w${w}` as const;
        if (row.prices[key] != null) used.add(w);
      }
    }
    return used.size > 0
      ? BLIND_WIDTH_MM_VALUES.filter((w) => used.has(w))
      : BLIND_WIDTH_MM_VALUES;
  }, [filteredRows, selectedTypeMeta]);

  return (
    <div className="-mx-4 flex flex-col gap-4 md:-mx-6 lg:-mx-8">
      <section className={`${sfDataSurface} mx-4 flex flex-col gap-4 p-4 md:mx-6 md:p-5 lg:mx-8`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-sf-text dark:text-zinc-100">Blinds</h2>
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
              Imported from the blinds price workbook into{" "}
              <code className="text-xs">data_blinds</code>,{" "}
              <code className="text-xs">data_blinds_types</code>, and{" "}
              <code className="text-xs">data_blinds_footers</code>.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className={sfPrimaryToolbarButton}>
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["prices", "types", "footers"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded border px-3 py-1.5 text-sm ${
                view === v
                  ? "border-sf-brand bg-sf-brand/10 text-sf-brand dark:border-[#58a9f5] dark:text-[#58a9f5]"
                  : "border-sf-border text-sf-text-secondary dark:border-zinc-600"
              }`}
            >
              {v === "prices" ? "Price grid" : v === "types" ? "Types" : "Footer notes"}
            </button>
          ))}
        </div>

        <label className="flex max-w-lg flex-col gap-1 text-sm">
          <span className="text-sf-text-secondary dark:text-zinc-400">Type</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="min-h-10 rounded border border-sf-border bg-sf-surface px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          >
            <option value="">All types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        {selectedTypeMeta && view === "prices" ? (
          <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
            {selectedTypeMeta.productLabel || selectedTypeMeta.typeName}
            {selectedTypeMeta.priceSheetDate ? ` · ${selectedTypeMeta.priceSheetDate}` : ""}
            {selectedTypeMeta.gstInclusive ? " · GST inclusive" : ""}
            {selectedTypeMeta.widthMinMm != null && selectedTypeMeta.widthMaxMm != null
              ? ` · widths ${selectedTypeMeta.widthMinMm}–${selectedTypeMeta.widthMaxMm} mm`
              : ""}
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-red-800 dark:text-red-300" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-sf-text-secondary">Loading…</p>
        ) : view === "types" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-sf-border text-sf-text-secondary dark:border-zinc-600">
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Product</th>
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Widths</th>
                  <th className="py-2 pr-3 font-medium">×</th>
                  <th className="py-2 pr-3 font-medium">Chain col</th>
                </tr>
              </thead>
              <tbody>
                {(typeFilter ? types.filter((t) => t.typeName === typeFilter) : types).map(
                  (t) => (
                    <tr
                      key={t.id}
                      className="border-b border-sf-border/60 dark:border-zinc-700/80"
                    >
                      <td className="py-2 pr-3">{t.typeName}</td>
                      <td className="max-w-xs py-2 pr-3 truncate" title={t.productLabel}>
                        {t.productLabel || "—"}
                      </td>
                      <td className="py-2 pr-3">{t.priceSheetDate ?? "—"}</td>
                      <td className="py-2 pr-3">
                        {t.widthMinMm != null && t.widthMaxMm != null
                          ? `${t.widthMinMm}–${t.widthMaxMm}`
                          : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {t.priceMultiplier != null ? t.priceMultiplier : "—"}
                      </td>
                      <td className="py-2 pr-3">{t.hasMinChainDropColumn ? "Yes" : "No"}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        ) : view === "footers" ? (
          <ul className="space-y-2 text-sm">
            {filteredFooters.length === 0 ? (
              <li className="text-sf-text-secondary">No footer notes.</li>
            ) : (
              filteredFooters.map((f) => (
                <li
                  key={f.id}
                  className="rounded border border-sf-border/80 px-3 py-2 dark:border-zinc-700"
                >
                  <span className="font-medium text-sf-text dark:text-zinc-200">
                    {f.type}
                    {f.impactPct != null ? ` · ${f.impactPct}%` : ""}
                  </span>
                  <p className="mt-1 text-sf-text-secondary dark:text-zinc-400">{f.noteText}</p>
                </li>
              ))
            )}
          </ul>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-sf-border text-sf-text-secondary dark:border-zinc-600">
                  <th className="sticky left-0 z-20 min-w-[9rem] max-w-[14rem] bg-sf-surface py-2 pr-2 font-medium dark:bg-zinc-900">
                    Type
                  </th>
                  <th className="sticky left-[9rem] z-20 bg-sf-surface py-2 pr-2 font-medium dark:bg-zinc-900">
                    Drop
                  </th>
                  {activeWidths.map((w) => (
                    <th key={w} className="whitespace-nowrap py-2 px-1 font-medium">
                      {w}
                    </th>
                  ))}
                  <th className="whitespace-nowrap py-2 pl-1 font-medium">Min chain</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={activeWidths.length + 3}
                      className="py-4 text-sf-text-secondary"
                    >
                      No price rows. Run blinds import on Import Master Prices.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-sf-border/60 dark:border-zinc-700/80"
                    >
                      <td
                        className="sticky left-0 z-20 max-w-[14rem] truncate bg-sf-surface py-1 pr-2 dark:bg-zinc-900"
                        title={row.type}
                      >
                        {row.type}
                      </td>
                      <td className="sticky left-[9rem] z-20 bg-sf-surface py-1 pr-2 font-medium tabular-nums dark:bg-zinc-900">
                        {row.dropMm}
                      </td>
                      {activeWidths.map((w) => {
                        const key = `w${w}` as const;
                        const v = row.prices[key];
                        return (
                          <td key={w} className="whitespace-nowrap px-1 py-1 tabular-nums">
                            {v != null ? v : "—"}
                          </td>
                        );
                      })}
                      <td className="whitespace-nowrap py-1 pl-1 tabular-nums">
                        {row.minChainDropMm ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
