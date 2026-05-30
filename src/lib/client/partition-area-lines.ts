import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

export type PartitionedAreaLines = {
  /** Lines shown at top level (excludes bundled children). */
  topLevel: ProjectAreaObjectPublic[];
  /** Bundled SKU lines grouped by parent line id, sorted by append slot. */
  bundledByParentId: Map<string, ProjectAreaObjectPublic[]>;
};

export function partitionAreaLines(rows: ProjectAreaObjectPublic[]): PartitionedAreaLines {
  const bundledByParentId = new Map<string, ProjectAreaObjectPublic[]>();
  const topLevel: ProjectAreaObjectPublic[] = [];

  for (const row of rows) {
    const parentId = row.bundledFromLineId?.trim();
    if (row.linesource === "bundled" && parentId) {
      const list = bundledByParentId.get(parentId) ?? [];
      list.push(row);
      bundledByParentId.set(parentId, list);
    } else {
      topLevel.push(row);
    }
  }

  for (const list of bundledByParentId.values()) {
    list.sort((a, b) => (a.bundledAppendSlot ?? 0) - (b.bundledAppendSlot ?? 0));
  }

  return { topLevel, bundledByParentId };
}
