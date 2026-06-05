"use client";

import {
  SCOPE_TOOL_TYPES,
  scopeToolTypeLabel,
  type ScopeToolType,
} from "@/lib/scope-tools";
import {
  systemScopeObjectId,
  type SystemScopeType,
} from "@/lib/system-scope-types";
import type { QuoteObjectPublic } from "@/types/quote-object";
import { useMemo, useState, type DragEvent } from "react";

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
  objectTools: Partial<Record<string, ScopeToolType>>;
  objectShowAll: Partial<Record<string, boolean>>;
  objectNoCharge: Partial<Record<string, boolean>>;
  onChange: (ids: string[]) => void;
  onObjectToolsChange: (tools: Partial<Record<string, ScopeToolType>>) => void;
  onObjectShowAllChange: (showAll: Partial<Record<string, boolean>>) => void;
  onObjectNoChargeChange: (noCharge: Partial<Record<string, boolean>>) => void;
  disabled?: boolean;
  inputClassName: string;
};

export function ScopeAnswerObjectPicker({
  quoteObjects,
  systemScopeType = null,
  selectedIds,
  objectTools,
  objectShowAll,
  objectNoCharge,
  onChange,
  onObjectToolsChange,
  onObjectShowAllChange,
  onObjectNoChargeChange,
  disabled = false,
  inputClassName,
}: Props) {
  const [search, setSearch] = useState("");
  const [expandedTypes, setExpandedTypes] = useState<Set<string> | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

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

  /** Preserve Setup order from `selectedIds` (drag-and-drop reorder). */
  const selectedItems = useMemo(() => {
    return selectedIds
      .map((id) => byId.get(id))
      .filter((item): item is PickerItem => item != null);
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
      if (objectTools[id]) {
        const next = { ...objectTools };
        delete next[id];
        onObjectToolsChange(next);
      }
      if (objectShowAll[id]) {
        const next = { ...objectShowAll };
        delete next[id];
        onObjectShowAllChange(next);
      }
      if (objectNoCharge[id]) {
        const next = { ...objectNoCharge };
        delete next[id];
        onObjectNoChargeChange(next);
      }
    }
  }

  function setObjectTool(id: string, tool: ScopeToolType | "") {
    if (disabled) return;
    const next = { ...objectTools };
    if (!tool) delete next[id];
    else next[id] = tool;
    onObjectToolsChange(next);
  }

  function setObjectShowAll(id: string, checked: boolean) {
    if (disabled) return;
    const next = { ...objectShowAll };
    if (!checked) delete next[id];
    else next[id] = true;
    onObjectShowAllChange(next);
  }

  function setObjectNoCharge(id: string, checked: boolean) {
    if (disabled) return;
    const next = { ...objectNoCharge };
    if (!checked) delete next[id];
    else next[id] = true;
    onObjectNoChargeChange(next);
  }

  function reorderSelected(draggedId: string, targetId: string) {
    if (disabled || draggedId === targetId) return;
    const from = selectedIds.indexOf(draggedId);
    const to = selectedIds.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...selectedIds];
    next.splice(from, 1);
    next.splice(to, 0, draggedId);
    onChange(next);
  }

  function handleDragStart(e: DragEvent<HTMLLIElement>, id: string) {
    if (disabled) return;
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function handleDragOver(e: DragEvent<HTMLLIElement>) {
    if (disabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: DragEvent<HTMLLIElement>, targetId: string) {
    e.preventDefault();
    const dragged = dragId ?? e.dataTransfer.getData("text/plain");
    setDragId(null);
    if (dragged) reorderSelected(dragged, targetId);
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
          Selected ({selectedItems.length}) — drag to reorder
        </p>
        {selectedItems.length > 0 ? (
          <ul className="space-y-2 rounded-lg border border-sf-border bg-sf-page p-2 dark:border-zinc-600 dark:bg-zinc-900/50">
            {selectedItems.map((item) => (
              <li
                key={item.id}
                draggable={!disabled}
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, item.id)}
                onDragEnd={() => setDragId(null)}
                className={`flex flex-wrap items-center gap-2 rounded-md bg-sf-surface px-2 py-2 text-sm dark:bg-zinc-800 ${
                  dragId === item.id ? "opacity-60 ring-2 ring-sf-brand/40" : ""
                } ${!disabled ? "cursor-grab active:cursor-grabbing" : ""}`}
              >
                <span
                  className="shrink-0 select-none text-sf-text-weak dark:text-zinc-500"
                  aria-hidden
                  title="Drag to reorder"
                >
                  ⠿
                </span>
                <span className="min-w-0 flex-1 truncate" title={item.label}>
                  <span className="text-xs text-sf-text-weak dark:text-zinc-400">
                    {item.objecttype} ·{" "}
                  </span>
                  {item.isSystem ? item.id : item.label.split(" · ")[0]}
                </span>
                {!item.isSystem ? (
                  <>
                    <label className="flex shrink-0 cursor-pointer items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-sf-border-strong"
                        checked={objectShowAll[item.id] === true}
                        disabled={disabled}
                        onChange={(e) => setObjectShowAll(item.id, e.target.checked)}
                      />
                      <span className="text-sf-text-weak dark:text-zinc-400" title="One checklist row per matching SKU">
                        Show All
                      </span>
                    </label>
                    <label className="flex shrink-0 cursor-pointer items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-sf-border-strong"
                        checked={objectNoCharge[item.id] === true}
                        disabled={disabled}
                        onChange={(e) => setObjectNoCharge(item.id, e.target.checked)}
                      />
                      <span
                        className="text-sf-text-weak dark:text-zinc-400"
                        title="Import line with $0 unit and total price"
                      >
                        No Charge
                      </span>
                    </label>
                    <label className="flex shrink-0 items-center gap-1.5 text-xs">
                      <span className="text-sf-text-weak dark:text-zinc-400">Calc tool</span>
                      <select
                        value={objectTools[item.id] ?? ""}
                        disabled={disabled}
                        onChange={(e) =>
                          setObjectTool(item.id, e.target.value as ScopeToolType | "")
                        }
                        className="min-h-9 rounded border border-sf-border-strong bg-sf-surface px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                      >
                        <option value="">None</option>
                        {SCOPE_TOOL_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {scopeToolTypeLabel(type)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : null}
                <button
                  type="button"
                  aria-label="Remove"
                  disabled={disabled}
                  onClick={() => setChecked(item.id, false)}
                  className="shrink-0 rounded px-1.5 text-sf-text-secondary hover:bg-sf-border/50 disabled:opacity-50 dark:hover:bg-zinc-700"
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
