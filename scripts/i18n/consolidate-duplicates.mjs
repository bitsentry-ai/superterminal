#!/usr/bin/env node
/**
 * Consolidate duplicate-value keys into a canonical `common.actions.*`
 * namespace. Reduces translation bloat and prevents inconsistent
 * translations of the same English string across components.
 *
 * Usage:
 *   node scripts/consolidate-duplicates.mjs --dry
 *   node scripts/consolidate-duplicates.mjs --apply
 *
 * Behavior:
 *  1. For each canonical action key, finds all existing keys whose en-US value
 *     equals the canonical value.
 *  2. Emits a migration map (canonical key gets first slot; all others migrate
 *     to the canonical).
 *  3. Hands the map to move-keys.mjs to do the actual rewriting.
 *
 * Adjust CANONICAL below to grow the action vocabulary.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { execFileSync } from "node:child_process";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = parseArgs(process.argv.slice(2));
const MODE = args.apply ? "apply" : "dry";

// Canonical action key → English value. Add more as needed.
const CANONICAL = {
  "common.actions.cancel": "Cancel",
  "common.actions.save": "Save",
  "common.actions.saveChanges": "Save Changes",
  "common.actions.delete": "Delete",
  "common.actions.close": "Close",
  "common.actions.edit": "Edit",
  "common.actions.continue": "Continue",
  "common.actions.back": "Back",
  "common.actions.done": "Done",
  "common.actions.new": "New",
  "common.actions.import": "Import",
  "common.actions.remove": "Remove",
  "common.actions.enable": "Enable",
  "common.actions.saving": "Saving...",
  "common.actions.starting": "Starting...",
  "common.actions.verifying": "Verifying...",
};

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const LOCALES_DIR = path.join(
  WORKSPACE_ROOT,
  "packages",
  "i18n",
  "src",
  "locales",
);
const SOURCE_LOCALE = "en-US";
const SOURCE_DIR = path.join(LOCALES_DIR, SOURCE_LOCALE);

async function main() {
  // Build value → keys index across all namespace JSONs in en-US.
  const valueToKeys = {};
  const namespaces = fs
    .readdirSync(SOURCE_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));

  for (const ns of namespaces) {
    const j = readJson(path.join(SOURCE_DIR, `${ns}.json`));
    for (const [k, v] of Object.entries(j)) {
      if (typeof v !== "string") continue;
      const norm = v.trim();
      if (!valueToKeys[norm]) valueToKeys[norm] = [];
      valueToKeys[norm].push(k);
    }
  }

  // Build migration map.
  const migration = {};
  let canonicalsCreated = 0;
  let migrationsPlanned = 0;
  for (const [canonical, value] of Object.entries(CANONICAL)) {
    const matches = valueToKeys[value] || [];
    if (matches.length === 0) {
      console.warn(`  [skip] No keys found for "${value}" → ${canonical}`);
      continue;
    }
    canonicalsCreated++;
    for (const k of matches) {
      // The canonical key itself doesn't migrate.
      if (k === canonical) continue;
      migration[k] = canonical;
      migrationsPlanned++;
    }
  }

  console.log(`Canonical action keys: ${canonicalsCreated}`);
  console.log(`Total migrations planned: ${migrationsPlanned}`);

  if (Object.keys(migration).length === 0) {
    console.log("Nothing to consolidate.");
    return;
  }

  // First, ensure the canonical keys exist in en-US/common.json with the
  // canonical English value.
  const enUsCommonPath = path.join(SOURCE_DIR, "common.json");
  const enUsCommon = readJson(enUsCommonPath);
  let added = 0;
  for (const [canonical, value] of Object.entries(CANONICAL)) {
    if (!(canonical in enUsCommon)) {
      enUsCommon[canonical] = value;
      added++;
    }
  }
  if (MODE === "apply" && added > 0) {
    writeJson(enUsCommonPath, enUsCommon);
    console.log(`Seeded ${added} canonical keys into en-US/common.json`);
  }

  // Write migration map to a temp file, hand to move-keys.mjs.
  const tmp = path.join(__dirname, "migrations", `_consolidation-tmp.json`);
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(migration, null, 2), "utf8");
  console.log(`Wrote migration map to ${path.relative(process.cwd(), tmp)}`);

  if (MODE === "dry") {
    console.log(`\n[dry] Re-run with --apply to execute the consolidation.`);
    return;
  }

  console.log(`\nDelegating to move-keys.mjs --apply ...\n`);
  execFileSync(
    process.execPath,
    [path.join(__dirname, "move-keys.mjs"), "--apply", "--map", tmp],
    { stdio: "inherit", cwd: process.cwd() },
  );

  // Cleanup tmp migration file
  fs.unlinkSync(tmp);
}

function readJson(p) {
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, "utf8") || "{}");
}

function writeJson(p, obj) {
  const sorted = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
  fs.writeFileSync(p, JSON.stringify(sorted, null, 2) + "\n", "utf8");
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") out.apply = true;
    else if (a === "--dry") out.dry = true;
  }
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
