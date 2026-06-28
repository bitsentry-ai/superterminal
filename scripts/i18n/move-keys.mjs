#!/usr/bin/env node
/**
 * Migrate translation keys from one namespace to another.
 *
 * Usage:
 *   node scripts/move-keys.mjs --apply --map errors-migration.json
 *   node scripts/move-keys.mjs --dry --map navigation-migration.json
 *
 * Migration map format:
 *   {
 *     "common.errorBoundary.somethingWentWrong": "errors.errorBoundary.somethingWentWrong",
 *     ...
 *   }
 *
 * For each entry:
 *  - Source key value is moved to target file across all locales.
 *  - All `t("oldKey")` references in source files are rewritten to `t("newKey")`.
 *  - Old key is deleted from its locale file.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = parseArgs(process.argv.slice(2));
const MODE = args.apply ? "apply" : "dry";
if (!args.map) {
  console.error("--map <migration-file.json> required");
  process.exit(1);
}

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const LOCALES_DIR = path.join(REPO_ROOT, "packages", "i18n", "src", "locales");
const SCAN_DIRS = [
  path.join(REPO_ROOT, "packages", "components", "src"),
  path.join(REPO_ROOT, "apps", "desktop", "src", "renderer", "src"),
];

async function main() {
  const migrationPath = path.resolve(process.cwd(), args.map);
  const migration = JSON.parse(fs.readFileSync(migrationPath, "utf8"));
  const entries = Object.entries(migration);
  console.log(`Migration map: ${entries.length} keys`);

  // Validate
  for (const [oldK, newK] of entries) {
    const oldNs = nsOf(oldK);
    const newNs = nsOf(newK);
    if (!oldNs || !newNs) {
      console.error(`Invalid key shape: ${oldK} → ${newK}`);
      process.exit(1);
    }
  }

  // 1) Move JSON values across locales.
  const locales = fs
    .readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const stats = { jsonMoved: 0, jsonMissing: 0, refsRewritten: 0, filesTouched: new Set() };

  for (const loc of locales) {
    for (const [oldK, newK] of entries) {
      const oldNs = nsOf(oldK);
      const newNs = nsOf(newK);
      const oldFile = path.join(LOCALES_DIR, loc, `${oldNs}.json`);
      const newFile = path.join(LOCALES_DIR, loc, `${newNs}.json`);
      if (!fs.existsSync(oldFile)) continue;
      const oldContent = readJson(oldFile);
      if (!(oldK in oldContent)) {
        stats.jsonMissing++;
        continue;
      }
      const value = oldContent[oldK];
      delete oldContent[oldK];

      const newContent = fs.existsSync(newFile) ? readJson(newFile) : {};
      newContent[newK] = value;

      if (MODE === "apply") {
        writeJson(oldFile, oldContent);
        writeJson(newFile, newContent);
      }
      stats.jsonMoved++;
    }
  }

  // 2) Rewrite t("oldKey") → t("newKey") across source files.
  const sourceFiles = collectFiles(SCAN_DIRS, /\.(tsx?|jsx?)$/);
  for (const f of sourceFiles) {
    const before = fs.readFileSync(f, "utf8");
    let after = before;
    for (const [oldK, newK] of entries) {
      const escapedOld = oldK.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Match t("oldKey"), t('oldKey'), t(`oldKey`)
      const rx = new RegExp(`t\\((\\s*)(["'\`])${escapedOld}\\2(\\s*[,)])`, "g");
      after = after.replace(rx, (_m, pre, q, post) => `t(${pre}${q}${newK}${q}${post}`);
    }
    if (after !== before) {
      stats.filesTouched.add(f);
      const matchCount = (before.match(/t\(["'`]/g) || []).length - (after.match(/t\(["'`]/g) || []).length;
      // Better: count specific replacements
      let n = 0;
      for (const [oldK] of entries) {
        const escapedOld = oldK.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const rx = new RegExp(`t\\((\\s*)(["'\`])${escapedOld}\\2(\\s*[,)])`, "g");
        n += (before.match(rx) || []).length;
      }
      stats.refsRewritten += n;
      if (MODE === "apply") fs.writeFileSync(f, after, "utf8");
    }
  }

  console.log(`\n[${MODE}] Summary:`);
  console.log(`  JSON entries moved: ${stats.jsonMoved} (across ${locales.length} locales)`);
  if (stats.jsonMissing) console.log(`  JSON keys missing in source files: ${stats.jsonMissing}`);
  console.log(`  Source-file t() references rewritten: ${stats.refsRewritten}`);
  console.log(`  Source files touched: ${stats.filesTouched.size}`);
}

function nsOf(key) {
  const m = /^([a-z][a-zA-Z0-9]*)\./.exec(key);
  return m ? m[1] : null;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8") || "{}");
}

function writeJson(p, obj) {
  const sorted = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(sorted, null, 2) + "\n", "utf8");
}

function collectFiles(roots, pattern) {
  /** @type {string[]} */
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "dist" || e.name.startsWith(".")) continue;
        walk(full);
      } else if (e.isFile() && pattern.test(e.name)) {
        out.push(full);
      }
    }
  };
  for (const root of roots) walk(root);
  return out;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") out.apply = true;
    else if (a === "--dry") out.dry = true;
    else if (a === "--map") out.map = argv[++i];
  }
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
