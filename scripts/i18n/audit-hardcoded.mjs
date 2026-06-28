#!/usr/bin/env node
/**
 * Audit remaining hardcoded user-facing strings the codemod missed:
 *  - StringLiteral inside `case` clauses (status maps, label maps)
 *  - StringLiteral values in object literals where ≥2 sibling values look
 *    like display text (heuristic: capitalized, has spaces, has letters)
 *  - StringLiteral returned from named functions whose name suggests UI
 *    (`get*Label`, `format*`, `humanize*`, `*Title`, `*Description`)
 *  - StringLiteral in BinaryExpression (string concatenation)
 *
 * Output: a CSV-like report (file:line, snippet, suggested namespace).
 *
 * Usage:
 *   node scripts/audit-hardcoded.mjs --root ../../packages/components/src
 *   node scripts/audit-hardcoded.mjs --root ../../apps/frontend/src
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { Project, SyntaxKind } from "ts-morph";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = parseArgs(process.argv.slice(2));
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const ROOTS = args.roots.length
  ? args.roots.map((r) => path.resolve(process.cwd(), r))
  : [
      path.join(REPO_ROOT, "packages", "components", "src"),
      path.join(REPO_ROOT, "apps", "frontend", "src"),
      path.join(REPO_ROOT, "apps", "desktop", "src", "renderer", "src"),
    ];

const UI_FUNCTION_NAME_RX = /^(get|format|humanize|render|build|describe).*(Label|Title|Description|Message|Text|Status|State|Name|Display)$/;

async function main() {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { jsx: 4, target: 99, allowJs: true },
  });

  const allFiles = ROOTS.flatMap(listTsxFiles);
  const sourceFiles = allFiles
    .filter((f) => !isTestFile(f))
    .map((f) => project.addSourceFileAtPath(f));

  /** @type {Array<{file: string; line: number; kind: string; snippet: string}>} */
  const findings = [];

  for (const sf of sourceFiles) {
    if (sf.getFullText().includes("i18n:done")) continue;
    const rel = path.relative(REPO_ROOT, sf.getFilePath());

    sf.forEachDescendant((node) => {
      if (node.getKind() !== SyntaxKind.StringLiteral) return;
      const value = node.getLiteralText();
      if (!isCandidateText(value)) return;

      const parent = node.getParent();
      if (!parent) return;
      const ctx = classifyContext(node, parent);
      if (!ctx) return;

      // Skip if the string already appears inside a t("...") call.
      const callAncestor = findCallAncestor(node);
      if (callAncestor && callAncestor.getExpression().getText() === "t") return;

      const line = node.getStartLineNumber();
      findings.push({ file: rel, line, kind: ctx, snippet: value.slice(0, 80) });
    });
  }

  // Group + print.
  const byKind = {};
  for (const f of findings) {
    (byKind[f.kind] ??= []).push(f);
  }
  console.log(`Total candidate hardcoded strings: ${findings.length}\n`);
  for (const [kind, items] of Object.entries(byKind).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    console.log(`=== ${kind} (${items.length}) ===`);
    for (const it of items.slice(0, 30)) {
      console.log(`  ${it.file}:${it.line}  "${it.snippet}"`);
    }
    if (items.length > 30) console.log(`  ... and ${items.length - 30} more`);
    console.log("");
  }
}

/**
 * @param {import("ts-morph").Node} node
 * @param {import("ts-morph").Node} parent
 */
function classifyContext(node, parent) {
  const pkind = parent.getKind();

  // case "active": ...   →   classified as switch-case
  if (pkind === SyntaxKind.CaseClause) {
    const expr = /** @type {any} */ (parent).getExpression();
    if (expr === node) return "switch-case";
  }

  // return "Foo" inside a UI helper function
  if (pkind === SyntaxKind.ReturnStatement) {
    const fn = findEnclosingFunction(node);
    if (fn) {
      const name = getFunctionName(fn);
      if (name && UI_FUNCTION_NAME_RX.test(name)) return "ui-helper-return";
    }
  }

  // Object literal value where multiple sibling values look like UI text
  if (pkind === SyntaxKind.PropertyAssignment) {
    const objLit = parent.getParent();
    if (objLit && objLit.getKind() === SyntaxKind.ObjectLiteralExpression) {
      const props = /** @type {any} */ (objLit).getProperties();
      const stringValues = props.filter((p) => {
        if (p.getKind() !== SyntaxKind.PropertyAssignment) return false;
        const init = p.getInitializer();
        return init && init.getKind() === SyntaxKind.StringLiteral &&
          isCandidateText(init.getLiteralText());
      });
      if (stringValues.length >= 2) return "object-label-map";
    }
  }

  // Binary expression with `+` (string concat)
  if (pkind === SyntaxKind.BinaryExpression) {
    const op = /** @type {any} */ (parent).getOperatorToken().getKind();
    if (op === SyntaxKind.PlusToken) return "string-concat";
  }

  return null;
}

function findEnclosingFunction(node) {
  let n = node.getParent();
  while (n) {
    const k = n.getKind();
    if (
      k === SyntaxKind.FunctionDeclaration ||
      k === SyntaxKind.ArrowFunction ||
      k === SyntaxKind.FunctionExpression ||
      k === SyntaxKind.MethodDeclaration
    ) {
      return n;
    }
    n = n.getParent();
  }
  return null;
}

function getFunctionName(fn) {
  const k = fn.getKind();
  if (k === SyntaxKind.FunctionDeclaration) return fn.getName?.();
  // For arrow/expression: look for VariableDeclaration parent.
  const parent = fn.getParent();
  if (parent && parent.getKind() === SyntaxKind.VariableDeclaration) {
    return parent.getName();
  }
  if (parent && parent.getKind() === SyntaxKind.PropertyAssignment) {
    return parent.getName();
  }
  return null;
}

function findCallAncestor(node) {
  let n = node.getParent();
  while (n) {
    if (n.getKind() === SyntaxKind.CallExpression) return n;
    n = n.getParent();
  }
  return null;
}

function isCandidateText(text) {
  if (!text || text.length < 2) return false;
  if (!/\p{L}/u.test(text)) return false;
  if (/^https?:\/\//.test(text)) return false;
  if (/^#[0-9a-fA-F]{3,8}$/.test(text)) return false;
  if (/^[/.]/.test(text)) return false;
  if (/^[\d.]+(px|rem|em|%|vh|vw|fr|s|ms|ch|ex)$/.test(text)) return false;
  if (/^[a-z][a-zA-Z0-9_.-]*$/.test(text) && !/\s/.test(text)) return false;
  if (/^[A-Z_][A-Z0-9_]+$/.test(text)) return false;
  // Multi-token CSS classes like "flex items-center gap-2"
  const tokens = text.split(/\s+/);
  const hyphenCount = (text.match(/-/g) || []).length;
  if (
    !/[A-Z]/.test(text) &&
    tokens.length >= 2 &&
    hyphenCount >= 2 &&
    !/[.,:!?]$/.test(text)
  ) {
    return false;
  }
  return true;
}

function isTestFile(filePath) {
  return (
    /\.(test|spec)\.tsx?$/.test(filePath) ||
    filePath.includes(`${path.sep}__tests__${path.sep}`) ||
    filePath.endsWith(".d.ts")
  );
}

function listTsxFiles(root) {
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
      } else if (e.isFile() && /\.tsx?$/.test(e.name)) {
        out.push(full);
      }
    }
  };
  walk(root);
  return out;
}

function parseArgs(argv) {
  const out = { roots: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root") out.roots.push(argv[++i]);
  }
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
