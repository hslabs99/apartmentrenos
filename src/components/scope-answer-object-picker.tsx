"use client";

import {
  systemScopeObjectId,
  type SystemScopeType,
} from "@/lib/system-scope-types";
import type { QuoteObjectPublic } from "@/types/quote-object";
import { useMemo, useState } from "react";

const UNTYPED_GROUP = "(No object type)";
const SYSTEM_OBJECT_TYPE = "System";

type PickerItem = {
  id: string;
  objecttype: string;
  label: string;
  isSystem: boolean;
};

function displayObjectType(raw: string): string {
  const t = raw.trim();
  return t || UNTYPED_GROUP;
}

function quoteObjectToPickerItem(q: QuoteObjectPublic): PickerItem {
  const name = q.objectname.trim() || "(unnamed)";
  const cat = q.category.trim();
  return {
    id: q.id,
    objecttype: displayObjectType(q.objecttype),
    label: cat ? `${name} · ${cat}` : name,
    isSystem: false,
  };
}

type TypeGroup = {
  objecttype: string;
  items: PickerItem[];
};

type Props = {
  quoteObjects: QuoteObjectPublic[];
  /** When the scope is a system scope, offer `System:{type}` for attachment. */
  systemScopeType?: SystemScopeType | null;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  inputClassName: string;
};

export function ScopeAnswerObjectPicker({
  quoteObjects,
  systemScopeType = null,
  selectedIds,
  onChange,
  disabled = false,
  inputClassName,
}: Props) {
  const [search, setSearch] = useState("");
  const [expandedTypes, setExpandedTypes] = useState<Set<string> | null>(null);

  const systemItems = useMemo((): PickerItem[] => {
    if (!systemScopeType) return [];
    const id = systemScopeObjectId(systemScopeType);
    return [
      {
        id,
        objecttype: SYSTEM_OBJECT_TYPE,
        label: id,
        isSystem: true,
      },
    ];
  }, [systemScopeType]);

  const quoteItems = useMemo(
    () => quoteObjects.map(quoteObjectToPickerItem),
    [quoteObjects],
  );

  const allItems = useMemo(() => [...systemItems, ...quoteItems], [systemItems, quoteItems]);

  const byId = useMemo(() => {
    const m = new Map<string, PickerItem>();
    for (const item of allItems) m.set(item.id, item);
    return m;
  }, [allItems]);

  const typeGroups = useMemo(() => {
    const map = new Map<string, PickerItem[]>();
    for (const item of allItems) {
      const list = map.get(item.objecttype) ?? [];
      list.push(item);
      map.set(item.objecttype, list);
    }
    const groups: TypeGroup[] = [...map.entries()].map(([objecttype, items]) => ({
      objecttype,
      items: [...items].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
      ),
    }));
    groups.sort((a, b) => {
      if (a.objecttype === SYSTEM_OBJECT_TYPE) return -1;
      if (b.objecttype === SYSTEM_OBJECT_TYPE) return 1;
      return a.objecttype.localeCompare(b.objecttype, undefined, { sensitivity: "base" });
    });
    return groups;
  }, [allItems]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return typeGroups;
    return typeGroups
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => {
          const hay = [g.objecttype, item.label, item.id].join(" ").toLowerCase();
          return hay.includes(q);
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [typeGroups, search]);

  const effectiveExpanded = useMemo(() => {
    if (expandedTypes !== null) return expandedTypes;
    return new Set(filteredGroups.map((g) => g.objecttype));
  }, [expandedTypes, filteredGroups]);

  const selectedItems = useMemo(() => {
    return selectedIds
      .map((id) => byId.get(id))
      .filter((item): item is PickerItem => item != null)
      .sort((a, b) =>
        a.objecttype.localeCompare(b.objecttype, undefined, { sensitivity: "base" }),
      );
  }, [selectedIds, byId]);

  function toggleExpanded(objecttype: string) {
    setExpandedTypes((prev) => {
      const base = prev ?? new Set(filteredGroups.map((g) => g.objecttype));
      const next = new Set(base);
      if (next.has(objecttype)) next.delete(objecttype);
      else next.add(objecttype);
      return next;
    });
  }

  function setChecked(id: string, checked: boolean) {
    if (disabled) return;
    if (checked) {
      if (selectedIds.includes(id)) return;
      onChange([...selectedIds, id]);
    } else {
      onChange(selectedIds.filter((x) => x !== id));
    }
  }

  function expandAll() {
    setExpandedTypes(new Set(filteredGroups.map((g) => g.objecttype)));
  }

  function collapseAll() {
    setExpandedTypes(new Set());
  }

  if (allItems.length === 0) {
    return (
      <p className="text-sm text-amber-800 dark:text-amber-200">
        No quote objects loaded. Add rows under Setup → Quote Objects, then reopen this form.
      </p>
    );
  }

  const objectCountLabel =
    systemItems.length > 0
      ? `${quoteObjects.length} quote object(s) in ${Math.max(0, typeGroups.length - 1)} type${
          typeGroups.length - 1 === 1 ? "" : "s"
        }, plus ${systemItems.length} system object(s).`
      : `${quoteObjects.length} quote object(s) in ${typeGroups.length} type${
          typeGroups.length === 1 ? "" : "s"
        }.`;

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-sf-text-secondary dark:text-zinc-400">
          Search
        </label>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by type, object name, or category…"
          className={`${inputClassName} min-h-11 text-sm`}
          autoComplete="off"
          disabled={disabled}
        />
        <p className="mt-1 text-xs text-sf-text-weak dark:text-zinc-400">{objectCountLabel}</p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-sf-text-secondary dark:text-zinc-400">
          Selected ({selectedItems.length})
        </p>
        {selectedItems.length > 0 ? (
          <ul className="flex flex-wrap gap-2 rounded-lg border border-sf-border bg-sf-page p-2 dark:border-zinc-600 dark:bg-zinc-900/50">
            {selectedItems.map((item) => (
              <li
                key={item.id}
                className="flex max-w-full items-center gap-1 rounded-full bg-sf-surface px-2 py-1 text-xs dark:bg-zinc-800"
              >
                <span className="truncate" title={item.label}>
                  <span className="text-sf-text-weak dark:text-zinc-400">
                    {item.objecttype} ·{" "}
                  </span>
                  {item.isSystem ? item.id : item.label.split(" · ")[0]}
                </span>
                <button
                  type="button"
                  aria-label="Remove"
                  disabled={disabled}
                  onClick={() => setChecked(item.id, false)}
                  className="shrink-0 rounded px-1 text-sf-text-secondary hover:bg-sf-border/50 disabled:opacity-50 dark:hover:bg-zinc-700"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-sf-text-weak">No objects attached.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={expandAll}
          className="text-xs font-medium text-sf-brand hover:underline disabled:opacity-50 dark:text-[#58a9f5]"
        >
          Expand all
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={collapseAll}
          className="text-xs font-medium text-sf-text-secondary hover:underline disabled:opacity-50 dark:text-zinc-400"
        >
          Collapse all
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-lg border border-sf-border p-1 dark:border-zinc-600">
        {filteredGroups.length === 0 ? (
          <p className="px-2 py-3 text-xs text-sf-text-weak">No matches.</p>
        ) : (
          <ul className="space-y-0.5">
            {filteredGroups.map((group) => {
              const open = effectiveExpanded.has(group.objecttype);
              const selectedInGroup = group.items.filter((i) =>
                selectedIds.includes(i.id),
              ).length;
              return (
                <li key={group.objecttype}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleExpanded(group.objecttype)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm font-medium text-sf-text hover:bg-sf-page disabled:opacity-50 dark:text-zinc-100 dark:hover:bg-zinc-800/80"
                  >
                    <span className="w-4 shrink-0 tabular-nums text-sf-text-weak dark:text-zinc-400">
                      {open ? "−" : "+"}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{group.objecttype}</span>
                    <span className="shrink-0 text-xs font-normal text-sf-text-weak dark:text-zinc-400">
                      {group.items.length}
                      {selectedInGroup > 0 ? ` · ${selectedInGroup} selected` : ""}
                    </span>
                  </button>
                  {open ? (
                    <ul className="mb-1 ml-6 border-l border-sf-border pl-2 dark:border-zinc-700">
                      {group.items.map((item) => {
                        const checked = selectedIds.includes(item.id);
                        return (
                          <li key={item.id}>
                            <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 hover:bg-sf-page dark:hover:bg-zinc-800/60">
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-sf-border-strong"
                                checked={checked}
                                disabled={disabled}
                                onChange={(e) => setChecked(item.id, e.target.checked)}
                              />
                              <span className="min-w-0 text-sm text-sf-text dark:text-zinc-100">
                                {item.label}
                                {item.isSystem ? (
                                  <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                                    Built-in system object — runtime rules apply when selected.
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
