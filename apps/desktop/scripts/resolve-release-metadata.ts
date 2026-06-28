#!/usr/bin/env node

import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

type CliOptions = {
  githubOutput: boolean;
};

type ReleaseMetadata = {
  release_version: string;
  release_display_version: string;
  release_tag: string;
};

function parseArgs(argv: string[]): CliOptions {
  return {
    githubOutput: argv.includes("--github-output"),
  };
}

function readDesktopVersion(): string {
  const packageJsonPath = resolve(process.cwd(), "apps/desktop/package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    version?: unknown;
  };
  const version = packageJson.version;

  if (typeof version !== "string" || !SEMVER_PATTERN.test(version)) {
    throw new Error(
      `apps/desktop/package.json must contain a valid semver version, received '${String(version)}'.`,
    );
  }

  return version;
}

function writeGithubOutput(entries: ReleaseMetadata): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath === undefined || outputPath.length === 0) {
    throw new Error("GITHUB_OUTPUT is required when using --github-output.");
  }

  const serialized = Object.entries(entries)
    .map(([key, value]) => `${key}=${value}\n`)
    .join("");

  appendFileSync(outputPath, serialized);
}

function main(): void {
  const { githubOutput } = parseArgs(process.argv.slice(2));
  const releaseVersion = readDesktopVersion();
  const releaseTag = `desktop-v${releaseVersion}`;

  const output: ReleaseMetadata = {
    release_version: releaseVersion,
    release_display_version: `v${releaseVersion}`,
    release_tag: releaseTag,
  };

  if (githubOutput) {
    writeGithubOutput(output);
    return;
  }

  for (const [key, value] of Object.entries(output)) {
    console.log(`${key}=${value}`);
  }
}

main();
