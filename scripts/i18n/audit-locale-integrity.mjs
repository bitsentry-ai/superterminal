#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..", "..", "packages", "i18n");
const localesRoot = path.join(packageRoot, "src", "locales");
const sourceLocale = "en-US";
const fullCoverageLocales = new Set(["fr-FR", "zh-CN", "id-ID"]);

const htmlEntityPattern = /&(?:quot|amp|lt|gt|nbsp|mdash|ndash|hellip);/;
const rawPlaceholderOnlyPattern = /^\s*\{\{\s*[\w.]+\s*\}\}\s*$/;
const replacementPattern = /\uFFFD|ï¿½/;
const repeatedQuestionMarkPattern = /\?{2,}/;
const latinWordQuestionMarkPattern = /\p{L}\?\p{L}/u;
const mojibakePattern =
  /(?:Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]?|â(?:€|„|œ|�|€™|€œ|€�|€¦|†’|€”|€“)|ðŸ)/;
const interpolationPattern = /\{\{\s*([\w.]+)\s*\}\}/g;

const failures = [];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    failures.push(`${path.relative(packageRoot, filePath)}: invalid JSON: ${error.message}`);
    return null;
  }
}

function sortedJsonFiles(locale) {
  const dir = path.join(localesRoot, locale);
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();
}

function flatten(value, prefix = "") {
  if (typeof value === "string") return [[prefix, value]];
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];

  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

function interpolationNames(value) {
  return [...value.matchAll(interpolationPattern)].map((match) => match[1]).sort();
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

const locales = fs
  .readdirSync(localesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const sourceFiles = sortedJsonFiles(sourceLocale);
const sourceByFile = new Map(
  sourceFiles.map((file) => [file, readJson(path.join(localesRoot, sourceLocale, file))]),
);

for (const locale of locales) {
  for (const file of sortedJsonFiles(locale)) {
    const filePath = path.join(localesRoot, locale, file);
    const json = readJson(filePath);
    if (!json) continue;

    const source = sourceByFile.get(file);
    const sourceValues = source ? new Map(flatten(source)) : new Map();
    const values = flatten(json);

    for (const [key, value] of values) {
      const location = `${locale}/${file}:${key}`;
      if (replacementPattern.test(value)) {
        failures.push(`${location}: contains a replacement/mojibake character`);
      }
      if (repeatedQuestionMarkPattern.test(value)) {
        failures.push(`${location}: contains repeated question marks, likely encoding loss`);
      }
      if (latinWordQuestionMarkPattern.test(value)) {
        failures.push(`${location}: contains a question mark inside a word, likely encoding loss`);
      }
      if (mojibakePattern.test(value)) {
        failures.push(`${location}: contains likely mojibake text`);
      }
      if (htmlEntityPattern.test(value)) {
        failures.push(`${location}: contains visible HTML entity text`);
      }
      if (rawPlaceholderOnlyPattern.test(value)) {
        failures.push(`${location}: translation value is only an interpolation token`);
      }

      const sourceValue = sourceValues.get(key);
      if (typeof sourceValue === "string") {
        const expected = interpolationNames(sourceValue);
        const actual = interpolationNames(value);
        if (!sameArray(expected, actual)) {
          failures.push(
            `${location}: interpolation mismatch; expected [${expected.join(", ")}], got [${actual.join(", ")}]`,
          );
        }
      }
    }

    if (fullCoverageLocales.has(locale) && source) {
      const actualKeys = new Set(values.map(([key]) => key));
      for (const [key] of sourceValues) {
        if (!actualKeys.has(key)) {
          failures.push(`${locale}/${file}:${key}: missing translation key`);
        }
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`Locale integrity audit failed with ${failures.length} issue(s):`);
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(`Locale integrity audit passed for ${locales.length} locales.`);
