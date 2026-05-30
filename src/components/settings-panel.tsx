"use client";

import { IconPencil, IconTrash } from "@/components/icons/lightning-icons";
import { isProtectedSettingKey } from "@/lib/settings-protected";
import {
  sfDataSurface,
  sfPrimaryToolbarButton,
  sfSectionHeading,
  sfSectionLead,
} from "@/lib/sf-layout";
import { sfRowIconBtn, sfRowIconBtnDanger } from "@/lib/sf-row-actions";
import type { SettingPublic } from "@/types/setting";
import { useCallback, useEffect, useMemo, useState } from "react";

type Mode = "idle" | "create" | "edit";

export function SettingsPanel() {
  const [settings, setSettings] = useState<SettingPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [settingname, setSettingname] = useState("");
  const [settingvalue, setSettingvalue] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      const data = (await res.json()) as { settings?: SettingPublic[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load settings");
      setSettings(data.settings ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
      setSettings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function bootstrapThenLoad() {
      setLoading(true);
      setError(null);
      try {
        const initRes = await fetch("/api/settings/init", { method: "POST" });
        const initData = (await initRes.json()) as { error?: string };
        if (!initRes.ok) {
          setError(initData.error ?? "Failed to initialize settings collection in Firestore");
          setSettings([]);
          setLoading(false);
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Initialization failed");
        setSettings([]);
        setLoading(false);
        return;
      }
      await load();
    }
    void bootstrapThenLoad();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setSettingname("");
    setSettingvalue("");
    setMode("create");
  }

  function openEdit(s: SettingPublic) {
    setEditingId(s.id);
    setSettingname(s.settingname);
    setSettingvalue(s.settingvalue);
    setMode("edit");
  }

  function closeForm() {
    setMode("idle");
    setEditingId(null);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const trimmedName = settingname.trim();
      const payload = { settingname: trimmedName, settingvalue };
      if (mode === "create") {
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { error?: string; details?: unknown };
        if (!res.ok) {
          const msg =
            typeof data.error === "string" ? data.error : JSON.stringify(data.details ?? data);
          throw new Error(msg);
        }
      } else if (mode === "edit" && editingId) {
        const editingRow = settings.find((s) => s.id === editingId);
        /** Never send `settingname` on PATCH for margin/load rates — avoids duplicate-name checks and stray creates. */
        const valueOnlyEdit =
          isProtectedSettingKey(trimmedName) ||
          (editingRow ? isProtectedSettingKey(editingRow.settingname) : false);
        const body = valueOnlyEdit ? { settingvalue: payload.settingvalue } : payload;
        const res = await fetch(`/api/settings/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as { error?: string; details?: unknown };
        if (!res.ok) {
          const msg =
            typeof data.error === "string" ? data.error : JSON.stringify(data.details ?? data);
          throw new Error(msg);
        }
      }
      closeForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/settings/${deleteId}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok)
        throw new Error(typeof data.error === "string" ? data.error : "Delete failed");
      setDeleteId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950";

  const sortedSettings = useMemo(() => {
    const rank = (name: string) => {
      const n = name.trim().toLowerCase();
      if (n === "margin") return 0;
      if (n.startsWith("loadrate")) return 1;
      return 2;
    };
    return [...settings].sort((a, b) => {
      const d = rank(a.settingname) - rank(b.settingname);
      if (d !== 0) return d;
      return a.settingname.localeCompare(b.settingname, undefined, { sensitivity: "base" });
    });
  }, [settings]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className={sfSectionHeading}>Settings</h2>
          <p className={sfSectionLead}>
            Key/value app settings. <span className="font-medium">margin</span> and the{" "}
            <span className="font-medium">loadRate*</span> rows are protected (names fixed, values
            editable): margin drives Check List markup %; load rates are $ per load unit for costing
            load columns (default 0).
          </p>
        </div>
        <button type="button" onClick={openCreate} className={sfPrimaryToolbarButton}>
          Add setting
        </button>
      </div>

      {error ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className={sfDataSurface}>
        {loading ? (
          <p className="p-6 text-sf-text-secondary dark:text-zinc-400">Loading…</p>
        ) : settings.length === 0 ? (
          <p className="p-6 text-sf-text-secondary dark:text-zinc-400">
            No settings yet. Initialization should create{" "}
            <code className="rounded bg-sf-page px-1 font-mono text-sm dark:bg-zinc-800">margin</code>{" "}
            and load rate rows.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm md:text-base">
              <thead className="border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Name</th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Value</th>
                  <th className="px-4 py-3 text-right font-semibold md:px-5 md:py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedSettings.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-sf-border last:border-0 dark:border-zinc-700/80"
                  >
                    <td className="px-4 py-3 font-medium md:px-5 md:py-3.5">
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {s.settingname}
                        {isProtectedSettingKey(s.settingname) ? (
                          <span className="rounded-md bg-zinc-200 px-2 py-0.5 text-xs font-medium text-sf-text-secondary dark:bg-zinc-700 dark:text-zinc-200">
                            Protected
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm md:px-5 md:py-3.5">
                      {s.settingvalue}
                    </td>
                    <td className="px-4 py-3 text-right md:px-5 md:py-3.5">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className={sfRowIconBtn}
                          aria-label="Edit setting"
                        >
                          <IconPencil className="h-4 w-4" />
                        </button>
                        {isProtectedSettingKey(s.settingname) ? null : (
                          <button
                            type="button"
                            onClick={() => setDeleteId(s.id)}
                            className={sfRowIconBtnDanger}
                            aria-label="Delete setting"
                          >
                            <IconTrash className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(mode === "create" || mode === "edit") && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="setting-form-title"
          onClick={closeForm}
        >
          <div
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-lg border border-sf-border bg-sf-surface shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:max-w-lg sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-sf-border px-5 py-4 dark:border-zinc-700">
              <h2 id="setting-form-title" className="text-lg font-semibold md:text-xl">
                {mode === "create" ? "New setting" : "Edit setting"}
              </h2>
            </div>
            <form onSubmit={submitForm} className="space-y-4 px-5 py-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Setting name
                </span>
                {mode === "edit" && isProtectedSettingKey(settingname) ? (
                  <div
                    className={`${inputClass} cursor-not-allowed bg-sf-page text-sf-text-secondary dark:bg-zinc-900 dark:text-zinc-400`}
                  >
                    {settingname}
                  </div>
                ) : (
                  <input
                    required
                    value={settingname}
                    onChange={(e) => setSettingname(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. margin"
                  />
                )}
                {mode === "edit" && isProtectedSettingKey(settingname) ? (
                  <p className="mt-1.5 text-xs text-sf-text-weak dark:text-zinc-400">
                    This name is fixed. You can only change the value.
                  </p>
                ) : null}
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Setting value
                </span>
                <input
                  value={settingvalue}
                  onChange={(e) => setSettingvalue(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 20 (margin %) or 45.00 (load $/unit)"
                />
              </label>
              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium dark:border-zinc-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-12 rounded-lg bg-sf-brand px-5 py-3 text-base font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : mode === "create" ? "Create" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-setting-title"
        >
          <div className="w-full max-w-md rounded-lg border border-sf-border bg-sf-surface p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2 id="delete-setting-title" className="text-lg font-semibold">
              Delete setting?
            </h2>
            <p className="mt-2 text-sm text-sf-text-secondary dark:text-zinc-400">
              This removes the setting from Firestore. This cannot be undone from the app.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium dark:border-zinc-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={saving}
                className="min-h-12 rounded-lg bg-red-600 px-5 py-3 text-base font-medium text-white disabled:opacity-50"
              >
                {saving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
