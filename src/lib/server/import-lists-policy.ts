/**
 * Master Prices → Import Lists upsert policy (styles, colours, UOM):
 * - Match an existing row by that list’s natural key (case-insensitive, trimmed).
 * - If found: update `notes` (and `updatedAt`) only — do not change identity fields.
 * - If not found: insert a full new document.
 */
