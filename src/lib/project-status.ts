import type { ProjectStatus } from "@/types/project";

export function parseProjectStatus(raw: unknown): ProjectStatus {
  if (raw === "Live" || raw === "Archive") return raw;
  return "Live";
}
