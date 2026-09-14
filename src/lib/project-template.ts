/** Project header flag. Missing / not `true` means a live project (shows on the Projects tab). */
export function isProjectTemplateFlag(value: unknown): boolean {
  return value === true;
}
