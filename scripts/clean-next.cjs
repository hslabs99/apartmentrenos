/**
 * Removes `.next` so the dev server can recover from ENOENT / corrupted manifest
 * errors (common on Windows when multiple dev instances share the same folder,
 * or when the bundler briefly writes an inconsistent chunk graph during hot reload).
 * Run via `npm run dev:fresh` or `npm run dev:clean` — default `npm run dev` no longer cleans every time.
 */
const fs = require("fs");
const path = require("path");

const nextDir = path.join(__dirname, "..", ".next");
try {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log("[clean-next] Removed .next");
} catch (e) {
  if (e && e.code === "ENOENT") {
    console.log("[clean-next] No .next directory (nothing to remove)");
  } else {
    throw e;
  }
}
