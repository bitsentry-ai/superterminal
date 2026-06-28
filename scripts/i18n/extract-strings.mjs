#!/usr/bin/env node
/**
 * Extract hardcoded user-facing strings from TSX files and replace them with
 * `t('key')` calls. Emits translation keys into a target JSON namespace.
 *
 * Modes:
 *   --audit              Count extractable strings per file, write nothing.
 *   --dry  --file <p>    Transform one file in memory, print the result.
 *   --apply              Write modifications + update the namespace JSON.
 *
 * Usage:
 *   node scripts/extract-strings.mjs --audit --root ../components/src
 *   node scripts/extract-strings.mjs --dry --file ../components/src/auth/EmailOtpLogin.tsx
 *   node scripts/extract-strings.mjs --apply --root ../components/src --namespace common
 *
 * Key convention: <namespace>.<fileStem>.<camelCaseFromString>
 *   Collisions are resolved with _2, _3, ...
 *
 * Skipped: .test.tsx / .spec.tsx / __tests__/ / files with the
 * `/* i18n:done *\/` pragma.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import {
  IndentationText,
  NewLineKind,
  Project,
  QuoteKind,
  SyntaxKind,
} from "ts-morph";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = parseArgs(process.argv.slice(2));
const MODE = args.apply ? "apply" : args.dry ? "dry" : "audit";
const NAMESPACE = args.namespace ?? "common";
const INCLUDE_CALLS = !!args.includeCalls;
const I18N_IMPORT_SOURCE = "@bitsentry-ce/i18n";
const TRANSLATABLE_ATTRS = new Set([
  "placeholder",
  "title",
  "aria-label",
  "aria-description",
  "alt",
  "aria-placeholder",
  "aria-roledescription",
  "label",
]);
// User-facing call patterns. The matcher tests the callee's full text.
const CALL_PATTERNS = [
  /^toast(\.(success|error|info|warning|message|loading))?$/,
  /^setError$/,
];
const SKIP_PRAGMA = "i18n:done";
const MIN_STRING_LENGTH = 2;

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const LOCALES_DIR = path.join(
  WORKSPACE_ROOT,
  "packages",
  "i18n",
  "src",
  "locales",
);
const DEFAULT_ROOT = path.join(WORKSPACE_ROOT, "packages", "components", "src");

async function main() {
  const root = args.root
    ? path.resolve(process.cwd(), args.root)
    : DEFAULT_ROOT;

  const files = args.files && args.files.length
    ? args.files.map((f) => path.resolve(process.cwd(), f))
    : listTsxFiles(root);

  const project = new Project({
    useInMemoryFileSystem: false,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      jsx: 4, // ReactJSX
      target: 99, // ESNext
      allowJs: true,
    },
    manipulationSettings: {
      quoteKind: QuoteKind.Double,
      indentationText: IndentationText.TwoSpaces,
      newLineKind: NewLineKind.LineFeed,
    },
  });

  const sourceFiles = files
    .filter((f) => !isTestFile(f))
    .map((f) => project.addSourceFileAtPath(f));

  const enUsPath = path.join(LOCALES_DIR, "en-US", `${NAMESPACE}.json`);
  const existing = readJsonSafe(enUsPath);
  /** @type {Record<string, string>} */
  const newKeys = {};
  /** @type {Array<{file: string; count: number; strings: string[]; skipped?: string}>} */
  const report = [];

  for (const sf of sourceFiles) {
    const rel = path.relative(root, sf.getFilePath());
    if (sf.getFullText().includes(SKIP_PRAGMA)) {
      report.push({ file: rel, count: 0, strings: [], skipped: "pragma" });
      continue;
    }
    const findings = findExtractableStrings(sf);
    if (findings.length === 0) {
      report.push({ file: rel, count: 0, strings: [] });
      continue;
    }

    if (MODE === "audit") {
      report.push({
        file: rel,
        count: findings.length,
        strings: findings.map((f) => f.text),
      });
      continue;
    }

    const fileStem = toCamel(path.basename(sf.getFilePath(), ".tsx"));
    const localUsedKeys = new Set();

    for (const finding of findings) {
      const key = pickKey(
        NAMESPACE,
        fileStem,
        finding.text,
        { ...existing, ...newKeys },
        localUsedKeys,
      );
      finding.key = key;
      localUsedKeys.add(key);
      newKeys[key] = finding.text;
    }

    applyReplacements(findings);
    ensureUseTranslationHook(sf);

    report.push({
      file: rel,
      count: findings.length,
      strings: findings.map((f) => f.text),
    });
  }

  if (MODE === "audit") {
    printAuditReport(report);
    return;
  }

  if (MODE === "dry") {
    for (const sf of sourceFiles) {
      console.log(`\n==== ${path.relative(process.cwd(), sf.getFilePath())} ====`);
      console.log(sf.getFullText());
    }
    console.log(`\n[dry-run] Would add ${Object.keys(newKeys).length} keys to ${enUsPath}`);
    return;
  }

  // apply mode
  await project.save();
  if (Object.keys(newKeys).length) {
    const merged = { ...existing, ...newKeys };
    fs.writeFileSync(enUsPath, JSON.stringify(sortKeys(merged), null, 2) + "\n", "utf8");
  }
  const totalFiles = report.filter((r) => r.count > 0 && !r.skipped).length;
  const totalStrings = report.reduce((acc, r) => acc + (r.skipped ? 0 : r.count), 0);
  console.log(
    `[apply] Modified ${totalFiles} files, added ${Object.keys(newKeys).length} keys (${totalStrings} replacements) to ${path.relative(process.cwd(), enUsPath)}`,
  );
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

/**
 * @param {import("ts-morph").SourceFile} sf
 * @returns {Array<{
 *   text: string;
 *   key?: string;
 *   kind: "jsx-text" | "jsx-expr-string" | "attr-string" | "attr-expr-string";
 *   node: import("ts-morph").Node;
 *   container?: import("ts-morph").Node;
 * }>}
 */
function findExtractableStrings(sf) {
  /** @type {any[]} */
  const findings = [];

  sf.forEachDescendant((node) => {
    const kind = node.getKind();

    // 1) JSX text: <div>Save changes</div>
    if (kind === SyntaxKind.JsxText) {
      const raw = node.getText();
      // Collapse newline+indent runs (JSX source formatting) into single
      // spaces so the captured value is one logical line, not a multiline
      // chunk with embedded \r\n. Browsers already collapse JSX whitespace,
      // so this preserves rendered behavior while keeping JSON tidy.
      const trimmed = raw
        .replace(/\r?\n\s+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (!isCandidateText(trimmed)) return;
      findings.push({ text: trimmed, kind: "jsx-text", node });
      return;
    }

    // 2) JSX expression wrapping a bare string literal:
    //    <span>{"Save changes"}</span>
    if (kind === SyntaxKind.JsxExpression) {
      const child = /** @type {any} */ (node).getExpression();
      if (child && isBareStringLiteral(child)) {
        const value = unquote(child.getText());
        if (!isCandidateText(value)) return;
        findings.push({
          text: value,
          kind: "jsx-expr-string",
          node: child,
        });
      }
      return;
    }

    // 3) JSX attribute: <Input placeholder="Enter email" />
    if (kind === SyntaxKind.JsxAttribute) {
      const name = /** @type {any} */ (node).getNameNode().getText();
      if (!TRANSLATABLE_ATTRS.has(name)) return;
      const init = /** @type {any} */ (node).getInitializer();
      if (!init) return;
      if (isBareStringLiteral(init)) {
        const value = unquote(init.getText());
        if (!isCandidateText(value)) return;
        findings.push({ text: value, kind: "attr-string", node: init });
        return;
      }
      if (init.getKind() === SyntaxKind.JsxExpression) {
        const inner = init.getExpression();
        if (inner && isBareStringLiteral(inner)) {
          const value = unquote(inner.getText());
          if (!isCandidateText(value)) return;
          findings.push({ text: value, kind: "attr-expr-string", node: inner });
        }
      }
      return;
    }

    // 4) User-facing call expression: toast.success("..."), setError("...")
    if (INCLUDE_CALLS && kind === SyntaxKind.CallExpression) {
      const callee = /** @type {any} */ (node).getExpression();
      if (!callee) return;
      const calleeText = callee.getText();
      if (!CALL_PATTERNS.some((rx) => rx.test(calleeText))) return;
      const callArgs = /** @type {any} */ (node).getArguments();
      if (callArgs.length === 0) return;
      const first = callArgs[0];
      if (!isBareStringLiteral(first)) return;
      const value = unquote(first.getText());
      if (!isCandidateText(value)) return;
      findings.push({ text: value, kind: "call-string", node: first });
      return;
    }

    // 5) StringLiteral nested in a logical/conditional fallback inside a
    //    JsxExpression, JsxAttribute, or matched CallExpression.
    //    Catches `cond ? "Yes" : "No"`, `value || "Default"`, `cond && "Show"`.
    if (kind === SyntaxKind.StringLiteral) {
      const parent = node.getParent();
      if (!parent) return;
      const pkind = parent.getKind();
      if (
        pkind !== SyntaxKind.BinaryExpression &&
        pkind !== SyntaxKind.ConditionalExpression
      ) {
        return;
      }
      if (pkind === SyntaxKind.BinaryExpression) {
        const op = /** @type {any} */ (parent).getOperatorToken().getKind();
        const allowed = new Set([
          SyntaxKind.BarBarToken,
          SyntaxKind.QuestionQuestionToken,
          SyntaxKind.AmpersandAmpersandToken,
        ]);
        if (!allowed.has(op)) return;
      }
      // Walk up looking for a translatable context.
      let context = parent.getParent();
      while (context) {
        const ck = context.getKind();
        if (
          ck === SyntaxKind.BinaryExpression ||
          ck === SyntaxKind.ConditionalExpression ||
          ck === SyntaxKind.ParenthesizedExpression
        ) {
          context = context.getParent();
          continue;
        }
        if (ck === SyntaxKind.JsxExpression) {
          const value = unquote(node.getText());
          if (!isCandidateText(value)) return;
          findings.push({ text: value, kind: "call-string", node });
          return;
        }
        if (ck === SyntaxKind.CallExpression) {
          if (!INCLUDE_CALLS) return;
          const callee = /** @type {any} */ (context).getExpression();
          if (!callee) return;
          if (!CALL_PATTERNS.some((rx) => rx.test(callee.getText()))) return;
          const value = unquote(node.getText());
          if (!isCandidateText(value)) return;
          findings.push({ text: value, kind: "call-string", node });
          return;
        }
        // Reached a non-expression boundary — abort.
        return;
      }
    }
  });

  return findings;
}

/**
 * Apply replacements from last-to-first so offsets don't shift out from under us.
 * @param {Array<any>} findings
 */
function applyReplacements(findings) {
  const sorted = [...findings].sort((a, b) => b.node.getStart() - a.node.getStart());
  for (const f of sorted) {
    if (!f.key) continue;
    switch (f.kind) {
      case "jsx-text": {
        const raw = f.node.getText();
        const leading = raw.match(/^\s*/)?.[0] ?? "";
        const trailing = raw.match(/\s*$/)?.[0] ?? "";
        f.node.replaceWithText(`${leading}{t("${f.key}")}${trailing}`);
        break;
      }
      case "jsx-expr-string":
      case "attr-expr-string":
      case "call-string":
        f.node.replaceWithText(`t("${f.key}")`);
        break;
      case "attr-string":
        f.node.replaceWithText(`{t("${f.key}")}`);
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// useTranslation injection
// ---------------------------------------------------------------------------

/** @param {import("ts-morph").SourceFile} sf */
function ensureUseTranslationHook(sf) {
  const existing = sf.getImportDeclaration(
    (d) => d.getModuleSpecifierValue() === I18N_IMPORT_SOURCE,
  );
  if (existing) {
    const named = existing.getNamedImports().map((n) => n.getName());
    if (!named.includes("useTranslation")) {
      existing.addNamedImport("useTranslation");
    }
  } else {
    sf.addImportDeclaration({
      moduleSpecifier: I18N_IMPORT_SOURCE,
      namedImports: ["useTranslation"],
    });
  }

  // Walk up from every t("...") call to the outermost enclosing function-like
  // ancestor. That's the React component (or closest component-level scope).
  // Collect unique bodies so we inject once per component.
  /** @type {Set<import("ts-morph").Node>} */
  const bodiesToInject = new Set();
  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.CallExpression) return;
    const callee = /** @type {any} */ (node).getExpression();
    if (!callee || callee.getText() !== "t") return;
    const funcAncestors = node
      .getAncestors()
      .filter((a) => {
        const k = a.getKind();
        return (
          k === SyntaxKind.FunctionDeclaration ||
          k === SyntaxKind.ArrowFunction ||
          k === SyntaxKind.FunctionExpression
        );
      });
    if (funcAncestors.length === 0) return;
    // Outermost is last element of getAncestors() result.
    const outer = funcAncestors[funcAncestors.length - 1];
    const body = /** @type {any} */ (outer).getBody?.();
    if (!body || body.getKind() !== SyntaxKind.Block) return;
    const bodyText = body.getText();
    if (/\buseTranslation\s*\(/.test(bodyText)) return;
    if (/\b(const|let|var)\s*\{[^}]*\bt\b[^}]*\}\s*=/.test(bodyText)) return;
    bodiesToInject.add(body);
  });

  for (const body of bodiesToInject) {
    const stmts = body.getStatements();
    const stmtText = `const { t } = useTranslation();`;
    if (stmts.length === 0) {
      body.setBodyText(stmtText);
    } else {
      stmts[0].replaceWithText(`${stmtText}\n${stmts[0].getText()}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickKey(namespace, fileStem, text, taken, localUsedKeys) {
  const base = `${namespace}.${fileStem}.${textToSlug(text)}`;
  if (!(base in taken) && !localUsedKeys.has(base)) return base;
  let i = 2;
  while (true) {
    const candidate = `${base}_${i}`;
    if (!(candidate in taken) && !localUsedKeys.has(candidate)) return candidate;
    i++;
  }
}

function textToSlug(text) {
  const clean = text
    .replace(/\{\{[^}]+\}\}/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .map((word, i) =>
      i === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join("");
  if (!clean) return "text";
  return /^[0-9]/.test(clean) ? `_${clean}` : clean;
}

function toCamel(name) {
  return name
    .replace(/[^a-zA-Z0-9]+(.)?/g, (_, ch) => (ch ? ch.toUpperCase() : ""))
    .replace(/^(.)/, (m) => m.toLowerCase());
}

function isBareStringLiteral(node) {
  const k = node.getKind();
  return (
    k === SyntaxKind.StringLiteral ||
    k === SyntaxKind.NoSubstitutionTemplateLiteral
  );
}

function unquote(text) {
  return text.replace(/^["'`]|["'`]$/g, "");
}

function isCandidateText(text) {
  if (!text) return false;
  if (text.length < MIN_STRING_LENGTH) return false;
  if (!/\p{L}/u.test(text)) return false;
  if (/^https?:\/\//.test(text)) return false;
  // Hex color literal e.g. #4A5568, #fff, #aabbccdd
  if (/^#[0-9a-fA-F]{3,8}$/.test(text)) return false;
  // URL path / file path / route literal
  if (/^[/.]/.test(text)) return false;
  // CSS unit literal e.g. 100px, 1.5rem, 50%
  if (/^[\d.]+(px|rem|em|%|vh|vw|fr|s|ms|ch|ex)$/.test(text)) return false;
  // Looks like identifier / token: single word, no spaces, starts lowercase
  if (/^[a-z][a-zA-Z0-9_.-]*$/.test(text) && !/\s/.test(text)) return false;
  // CONSTANT_CASE
  if (/^[A-Z_][A-Z0-9_]+$/.test(text)) return false;
  // Pure CSS class string: all-lowercase, multi-token, several hyphens
  // (Tailwind-style). Distinguishes "flex items-center gap-2" (skip) from
  // user copy like "6-digit code sent to your email" (keep).
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
  /** @type {string[]} */
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".tsx")) out.push(full);
    }
  };
  walk(root);
  return out;
}

function readJsonSafe(p) {
  try {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function sortKeys(obj) {
  const sorted = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
  return sorted;
}

function printAuditReport(report) {
  const withContent = report.filter((r) => r.count > 0 && !r.skipped);
  const totalStrings = withContent.reduce((acc, r) => acc + r.count, 0);
  const skipped = report.filter((r) => r.skipped);
  console.log(
    `\nAudit: ${withContent.length}/${report.length} files have extractable strings (${totalStrings} total)`,
  );
  if (skipped.length) {
    console.log(`Skipped ${skipped.length} files with pragma`);
  }
  for (const r of withContent.sort((a, b) => b.count - a.count)) {
    console.log(`  ${String(r.count).padStart(4)}  ${r.file}`);
  }
  console.log("\nSample strings from the top 3 files:");
  for (const r of withContent.sort((a, b) => b.count - a.count).slice(0, 3)) {
    console.log(`\n--- ${r.file} ---`);
    for (const s of r.strings.slice(0, 10)) {
      console.log(`  "${s.slice(0, 80)}"`);
    }
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--audit") out.audit = true;
    else if (a === "--dry") out.dry = true;
    else if (a === "--apply") out.apply = true;
    else if (a === "--root") out.root = argv[++i];
    else if (a === "--file") (out.files ??= []).push(argv[++i]);
    else if (a === "--namespace") out.namespace = argv[++i];
    else if (a === "--include-calls") out.includeCalls = true;
  }
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
