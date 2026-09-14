/** Project header flag. Missing / not `true` means the row is on Projects or Templates. */
export function isProjectArchivedFlag(value: unknown): boolean {
  return value === true;
}

/** Characters of the project name required to confirm a permanent delete. */
export const PROJECT_HARD_DELETE_NAME_PREFIX_LEN = 5;

export function projectHardDeleteNamePrefix(projectname: string): string {
  return projectname.trim().slice(0, PROJECT_HARD_DELETE_NAME_PREFIX_LEN);
}

export function projectHardDeletePrefixMatches(
  projectname: string,
  typed: string,
): boolean {
  const expected = projectHardDeleteNamePrefix(projectname);
  if (!expected) return false;
  return typed.trim().toLowerCase() === expected.toLowerCase();
}
