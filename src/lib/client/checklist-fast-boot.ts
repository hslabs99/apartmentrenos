/**
 * Checklist / workbench load optimizations (2026-09-18).
 *
 * When true:
 * - Catalog fetches run in parallel with project data (no 3-wave waterfall)
 * - Workbench-only catalogs (building/painting books, object labour rates) skip on Check List
 * - Shared catalog JSON is cached in memory until Setup / Import is visited
 * - Project-notes collection init is not POSTed on every Check List open
 *
 * Rollback if load/behavior regresses:
 * 1. Fastest: set `CHECKLIST_FAST_BOOT` to `false`, save, hard-refresh.
 * 2. Full undo: `git revert` the commit that introduced these changes.
 */
export const CHECKLIST_FAST_BOOT = true;
