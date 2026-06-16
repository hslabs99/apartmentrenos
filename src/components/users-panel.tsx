"use client";

import { IconPencil, IconTrash } from "@/components/icons/lightning-icons";
import { sfDataSurface, sfPrimaryToolbarButton, sfSectionLead } from "@/lib/sf-layout";
import { sfRowIconBtn, sfRowIconBtnDanger } from "@/lib/sf-row-actions";
import { LOOKUP_TYPE_RELATIONSHIP_TYPE } from "@/lib/lookup-types";
import type { LookupPublic } from "@/types/lookup";
import type { UserPublic, UserType } from "@/types/user";
import { USER_TYPE_LABELS, USER_TYPES } from "@/types/user";
import { useCallback, useEffect, useState } from "react";

type Mode = "idle" | "create" | "edit";

type ValidationDetails = {
  fieldErrors?: Record<string, string[] | undefined>;
  formErrors?: string[];
};

function formatApiError(data: {
  error?: string;
  details?: ValidationDetails;
}): string {
  const fieldBits: string[] = [];
  const fieldErrors = data.details?.fieldErrors;
  if (fieldErrors) {
    for (const [field, messages] of Object.entries(fieldErrors)) {
      if (Array.isArray(messages) && messages.length > 0) {
        fieldBits.push(`${field}: ${messages.join(", ")}`);
      }
    }
  }
  const formBits = Array.isArray(data.details?.formErrors)
    ? data.details.formErrors.filter(Boolean)
    : [];
  if (fieldBits.length || formBits.length) {
    return [...fieldBits, ...formBits].join(" | ");
  }
  return typeof data.error === "string" ? data.error : "Request failed";
}

export function UsersPanel() {
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [lookups, setLookups] = useState<LookupPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<UserType>("sales");
  const [businessName, setBusinessName] = useState("");
  const [relationshipTypeLookupId, setRelationshipTypeLookupId] = useState<string>("");
  const [password, setPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = (await res.json()) as {
        users?: UserPublic[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load users");
      setUsers(data.users ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLookups = useCallback(async () => {
    try {
      await fetch("/api/lookups/init", { method: "POST" });
    } catch {
      // optional bootstrap; UI still works without it
    }
    try {
      const res = await fetch("/api/lookups");
      const data = (await res.json()) as { lookups?: LookupPublic[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load lookups");
      setLookups(data.lookups ?? []);
    } catch {
      setLookups([]);
    }
  }, []);

  useEffect(() => {
    async function bootstrapThenLoad() {
      setLoading(true);
      setError(null);
      try {
        const initRes = await fetch("/api/users/init", { method: "POST" });
        const initData = (await initRes.json()) as { error?: string };
        if (!initRes.ok) {
          setError(
            initData.error ?? "Failed to initialize users collection in Firestore",
          );
          setUsers([]);
          setLoading(false);
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Initialization failed");
        setUsers([]);
        setLoading(false);
        return;
      }
      await Promise.all([load(), loadLookups()]);
    }
    void bootstrapThenLoad();
  }, [load, loadLookups]);

  function openCreate() {
    setEditingId(null);
    setUsername("");
    setEmail("");
    setPhone("");
    setType("sales");
    setBusinessName("");
    setRelationshipTypeLookupId("");
    setPassword("");
    setMode("create");
  }

  function openEdit(u: UserPublic) {
    setEditingId(u.id);
    setUsername(u.username);
    setEmail(u.email);
    setPhone(u.phone);
    setType(u.type);
    setBusinessName(u.businessName ?? "");
    setRelationshipTypeLookupId(
      typeof u.relationshipTypeLookupId === "number" ? String(u.relationshipTypeLookupId) : "",
    );
    setPassword("");
    setMode("edit");
  }

  function closeForm() {
    setMode("idle");
    setEditingId(null);
    setPassword("");
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const relId = relationshipTypeLookupId.trim();
      const relationshipTypeIdNum =
        relId && Number.isFinite(Number(relId)) ? Number(relId) : null;
      if (mode === "create") {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            email,
            phone,
            type,
            businessName,
            relationshipTypeLookupId: relationshipTypeIdNum,
            password,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          details?: ValidationDetails;
        };
        if (!res.ok) {
          throw new Error(formatApiError(data));
        }
      } else if (mode === "edit" && editingId) {
        const body: Record<string, unknown> = {
          username,
          email,
          phone,
          type,
          businessName,
          relationshipTypeLookupId: relationshipTypeIdNum,
        };
        if (password.length > 0) body.password = password;
        const res = await fetch(`/api/users/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as {
          error?: string;
          details?: ValidationDetails;
        };
        if (!res.ok) {
          throw new Error(formatApiError(data));
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
      const res = await fetch(`/api/users/${deleteId}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok)
        throw new Error(
          typeof data.error === "string" ? data.error : "Delete failed",
        );
      setDeleteId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  const relationshipTypes = lookups
    .filter((l) => l.lookuptype === LOOKUP_TYPE_RELATIONSHIP_TYPE && typeof l.lookupid === "number")
    .slice()
    .sort((a, b) =>
      a.lookupvalue.localeCompare(b.lookupvalue, undefined, { sensitivity: "base" }),
    );

  const relationshipTypeLabelById = new Map<number, string>();
  for (const l of relationshipTypes) {
    if (typeof l.lookupid === "number") relationshipTypeLabelById.set(l.lookupid, l.lookupvalue);
  }

  function userTypeBadgeClass(userType: UserType): string {
    switch (userType) {
      case "admin":
        return "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100";
      case "management":
        return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100";
      default:
        return "border-sf-border bg-sf-page text-sf-text-secondary dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-normal tracking-tight text-sf-text md:text-2xl dark:text-zinc-50">
            Users
          </h1>
          <p className={sfSectionLead}>
            Manage staff accounts. Passwords are stored hashed on the server; sign-in uses this
            table only.
          </p>
        </div>
        <button type="button" onClick={openCreate} className={sfPrimaryToolbarButton}>
          Add user
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
        ) : users.length === 0 ? (
          <p className="p-6 text-sf-text-secondary dark:text-zinc-400">
            No users yet. Add one to create the{" "}
            <code className="rounded bg-sf-page px-1 font-mono text-sm dark:bg-zinc-800">
              users
            </code>{" "}
            collection in Firestore.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm md:text-base">
              <thead className="border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">
                    Username
                  </th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell md:px-5 md:py-4">
                    Business
                  </th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell md:px-5 md:py-4">
                    Relationship type
                  </th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">
                    Email
                  </th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell md:px-5 md:py-4">
                    Phone
                  </th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">
                    Type
                  </th>
                  <th className="px-4 py-3 text-right font-semibold md:px-5 md:py-4">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-sf-border last:border-0 dark:border-zinc-700/80"
                  >
                    <td className="px-4 py-3 font-medium md:px-5 md:py-3.5">
                      {u.username}
                    </td>
                    <td className="hidden px-4 py-3 text-sf-text-secondary dark:text-zinc-300 lg:table-cell md:px-5 md:py-3.5">
                      {u.businessName?.trim() ? u.businessName : "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-sf-text-secondary dark:text-zinc-300 lg:table-cell md:px-5 md:py-3.5">
                      {typeof u.relationshipTypeLookupId === "number"
                        ? (relationshipTypeLabelById.get(u.relationshipTypeLookupId) ??
                          String(u.relationshipTypeLookupId))
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-sf-text-secondary dark:text-zinc-300 md:px-5 md:py-3.5">
                      {u.email}
                    </td>
                    <td className="hidden px-4 py-3 text-sf-text-secondary dark:text-zinc-300 sm:table-cell md:px-5 md:py-3.5">
                      {u.phone || "—"}
                    </td>
                    <td className="px-4 py-3 md:px-5 md:py-3.5">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium md:text-sm ${userTypeBadgeClass(u.type)}`}
                      >
                        {USER_TYPE_LABELS[u.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right md:px-5 md:py-3.5">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className={sfRowIconBtn}
                          aria-label="Edit user"
                        >
                          <IconPencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(u.id)}
                          className={sfRowIconBtnDanger}
                          aria-label="Delete user"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
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
          aria-labelledby="user-form-title"
          onClick={closeForm}
        >
          <div
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-lg border border-sf-border bg-sf-surface shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:max-w-lg sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-sf-border px-5 py-4 dark:border-zinc-700">
              <h2
                id="user-form-title"
                className="text-lg font-normal text-sf-text md:text-xl dark:text-zinc-50"
              >
                {mode === "create" ? "New user" : "Edit user"}
              </h2>
            </div>
            <form onSubmit={submitForm} className="space-y-4 px-5 py-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Business Name
                </span>
                <input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="min-h-10 w-full rounded border border-sf-border-strong bg-sf-surface px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  autoComplete="organization"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Relationship type
                </span>
                <select
                  value={relationshipTypeLookupId}
                  onChange={(e) => setRelationshipTypeLookupId(e.target.value)}
                  className="min-h-10 w-full rounded border border-sf-border-strong bg-sf-surface px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                >
                  <option value="">—</option>
                  {relationshipTypes.map((l) => (
                    <option key={l.id} value={String(l.lookupid)}>
                      {l.lookupvalue}
                    </option>
                  ))}
                </select>
                {relationshipTypes.length === 0 ? (
                  <span className="mt-1 block text-xs text-sf-text-weak">
                    No relationship types exist yet. Add them under Setup → System → Lookups using
                    type <span className="font-mono">{LOOKUP_TYPE_RELATIONSHIP_TYPE}</span>.
                  </span>
                ) : null}
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Username
                </span>
                <input
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="min-h-10 w-full rounded border border-sf-border-strong bg-sf-surface px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  autoComplete="username"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Email
                </span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-h-10 w-full rounded border border-sf-border-strong bg-sf-surface px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  autoComplete="email"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Phone
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="min-h-10 w-full rounded border border-sf-border-strong bg-sf-surface px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  autoComplete="tel"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Type
                </span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as UserType)}
                  className="min-h-10 w-full rounded border border-sf-border-strong bg-sf-surface px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                >
                  {USER_TYPES.map((userType) => (
                    <option key={userType} value={userType}>
                      {USER_TYPE_LABELS[userType]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  {mode === "create" ? "Password" : "New password (optional)"}
                </span>
                <input
                  type="password"
                  required={mode === "create"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "edit" ? "Leave blank to keep" : ""}
                  className="min-h-10 w-full rounded border border-sf-border-strong bg-sf-surface px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  autoComplete="new-password"
                />
                <span className="mt-1 block text-xs text-sf-text-weak">
                  Min 8 characters. Stored as a hash, not plain text.
                </span>
              </label>
              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  className="inline-flex min-h-9 items-center justify-center rounded border border-sf-border-strong bg-sf-surface px-4 py-2 text-sm font-normal text-sf-text shadow-sm hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-9 items-center justify-center rounded bg-sf-brand px-4 py-2 text-sm font-normal text-white shadow-sm hover:bg-sf-brand-hover disabled:opacity-50"
                >
                  {saving ? "Saving…" : mode === "create" ? "Create" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-title"
        >
          <div className="w-full max-w-md rounded border border-sf-border bg-sf-surface p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2 id="delete-title" className="text-lg font-normal text-sf-text dark:text-zinc-50">
              Delete user?
            </h2>
            <p className="mt-2 text-sm text-sf-text-secondary dark:text-zinc-400">
              This removes the user document from Firestore. This cannot be
              undone.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="inline-flex min-h-9 items-center justify-center rounded border border-sf-border-strong bg-sf-surface px-4 py-2 text-sm font-normal text-sf-text shadow-sm hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={saving}
                className="inline-flex min-h-9 items-center justify-center rounded bg-sf-destructive px-4 py-2 text-sm font-normal text-white shadow-sm hover:bg-sf-destructive-hover disabled:opacity-50"
              >
                {saving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
