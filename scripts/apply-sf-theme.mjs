/**
 * Bulk theme pass: zinc utility classes → Lightning (sf-*) tokens.
 * Run: node scripts/apply-sf-theme.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, "..", "src");

function walkTsx(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkTsx(p, out);
    else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

/** @param {string} s */
function transform(s) {
  let t = s;

  // Solid primary backgrounds only (not dark:bg-zinc-900, not /opacity)
  t = t.replace(/(?<!dark:)bg-zinc-900(?!\/)/g, "bg-sf-brand");

  // Primary hover — not `dark:hover:bg-zinc-800` (neutral in dark mode)
  t = t.replace(/(?<!dark:)hover:bg-zinc-800\b/g, "hover:bg-sf-brand-hover");

  // Surfaces & borders
  t = t.replace(/\bborder-zinc-200\b/g, "border-sf-border");
  t = t.replace(/\bborder-zinc-300\b/g, "border-sf-border-strong");
  t = t.replace(/\bborder-zinc-100\b/g, "border-sf-border");
  t = t.replace(/\bborder-zinc-400\b/g, "border-sf-border-strong");
  t = t.replace(/\bdark:border-zinc-800\/80\b/g, "dark:border-zinc-700/80");
  t = t.replace(/\bdark:border-zinc-800\b/g, "dark:border-zinc-700");

  t = t.replace(/\bbg-zinc-50\/90\b/g, "bg-sf-page/90");
  t = t.replace(/\bbg-zinc-50\/95\b/g, "bg-sf-page/95");
  t = t.replace(/\bbg-zinc-50\/80\b/g, "bg-sf-page/80");
  t = t.replace(/\bbg-zinc-50\b/g, "bg-sf-page");
  t = t.replace(/\bbg-zinc-100\/80\b/g, "bg-sf-page/80");
  t = t.replace(/\bbg-zinc-100\b/g, "bg-sf-page");

  t = t.replace(/\bbg-white\b/g, "bg-sf-surface");
  t = t.replace(/\bfrom-zinc-50\b/g, "from-sf-page");

  // Text
  t = t.replace(/\btext-zinc-900\b/g, "text-sf-text");
  t = t.replace(/\btext-zinc-800\b/g, "text-sf-text");
  t = t.replace(/\btext-zinc-700\b/g, "text-sf-text-secondary");
  t = t.replace(/\btext-zinc-600\b/g, "text-sf-text-secondary");
  t = t.replace(/\btext-zinc-500\b/g, "text-sf-text-weak");

  // Neutral hovers
  t = t.replace(/\bhover:bg-zinc-50\b/g, "hover:bg-sf-page");
  t = t.replace(/\bhover:bg-zinc-200\b/g, "hover:bg-sf-border/50");

  // Focus rings
  t = t.replace(/focus-visible:ring-zinc-400\/35/g, "focus-visible:ring-sf-brand/25");
  t = t.replace(/focus-visible:ring-zinc-500\/35/g, "focus-visible:ring-sf-brand/30");
  t = t.replace(/focus-visible:ring-zinc-400/g, "focus-visible:ring-sf-brand/40");
  t = t.replace(/focus-visible:ring-zinc-500/g, "focus-visible:ring-sf-brand/40");
  t = t.replace(/focus-visible:bg-zinc-50/g, "focus-visible:bg-sf-page");

  // Modals / cards radius
  t = t.replace(/\brounded-2xl\b/g, "rounded-lg");
  t = t.replace(/\brounded-t-2xl\b/g, "rounded-t-lg");

  // Selected / strong borders
  t = t.replace(/\bborder-zinc-900\b/g, "border-sf-text");
  t = t.replace(/\bdark:border-white\b/g, "dark:border-zinc-200");

  return t;
}

const files = walkTsx(srcRoot).filter((f) => !f.includes("lightning-icons"));
let changed = 0;
for (const f of files) {
  const before = fs.readFileSync(f, "utf8");
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(f, after);
    changed++;
    console.log("updated", path.relative(srcRoot, f));
  }
}
console.log("files changed:", changed);
