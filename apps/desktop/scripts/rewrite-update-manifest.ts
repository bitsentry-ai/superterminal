#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type CliOptions = {
  input: string;
  output: string;
  urlPrefix: string;
};

type CliOptionName = "--input" | "--output" | "--url-prefix";
type MutableCliOptions = {
  input: string;
  output: string;
  urlPrefix: string;
};

const optionSetters: Record<
  CliOptionName,
  (options: MutableCliOptions, value: string) => void
> = {
  "--input": (options, value) => {
    options.input = value;
  },
  "--output": (options, value) => {
    options.output = value;
  },
  "--url-prefix": (options, value) => {
    options.urlPrefix = value;
  },
};

function readOptionValue(argv: string[], index: number, optionName: string): string {
  if (index + 1 >= argv.length) {
    throw new Error(`${optionName} requires a value`);
  }

  return argv[index + 1];
}

function isCliOptionName(value: string): value is CliOptionName {
  return value === "--input" || value === "--output" || value === "--url-prefix";
}

function parseArgs(argv: string[]): CliOptions {
  const options: MutableCliOptions = {
    input: "",
    output: "",
    urlPrefix: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!isCliOptionName(arg)) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    optionSetters[arg](options, readOptionValue(argv, index, arg));
    index += 1;
  }

  if (options.input.length === 0) throw new Error("--input is required");
  if (options.output.length === 0) throw new Error("--output is required");
  if (options.urlPrefix.length === 0) throw new Error("--url-prefix is required");

  return options;
}

function normalizePrefix(prefix: string): string {
  return prefix.replace(/^\/+|\/+$/g, "");
}

function shouldRewriteValue(value: string, normalizedPrefix: string): boolean {
  if (value.length === 0) return false;
  if (value.includes("://")) return false;
  if (value.startsWith("/")) return false;
  if (value.startsWith(`${normalizedPrefix}/`)) return false;
  return true;
}

function rewriteManifest(content: string, prefix: string): string {
  const normalizedPrefix = normalizePrefix(prefix);
  const linePattern = /^([ \t]*-?[ \t]*)(path|url):[ \t]*(['"]?)([^'"]+)\3[ \t]*$/;

  return content
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(linePattern);
      if (match === null) return line;

      const [, indentation, key, quote, rawValue] = match;
      const value = rawValue.trim();
      if (!shouldRewriteValue(value, normalizedPrefix)) {
        return line;
      }

      let quoted = quote;
      if (quote.length === 0) {
        quoted = "";
      }
      return `${indentation}${key}: ${quoted}${normalizedPrefix}/${value}${quoted}`;
    })
    .join("\n");
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = resolve(process.cwd(), options.input);
  const outputPath = resolve(process.cwd(), options.output);
  const content = readFileSync(inputPath, "utf8");
  const rewritten = rewriteManifest(content, options.urlPrefix);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, rewritten, "utf8");
}

main();
