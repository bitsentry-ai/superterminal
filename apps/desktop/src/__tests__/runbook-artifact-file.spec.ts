import { describe, expect, it } from "vitest";
import type { DesktopRunbookExportArtifactV1 } from "@bitsentry-ce/core/features/runbooks/desktop-runbook-ce.types";
import {
  parseRunbookArtifactFile,
  serializeRunbookArtifactFile,
} from "@bitsentry-ce/core/features/runbooks/desktop-runbook-artifact-file-yaml";

const artifact: DesktopRunbookExportArtifactV1 = {
  format: "bitsentry.runbooks.export",
  version: 1,
  exportedAt: "2026-05-31T00:00:00.000Z",
  exportedBy: {
    product: "superterminal",
    runtime: "desktop",
  },
  runbooks: [
    {
      title: "Check API health",
      description: "Validate the health endpoint",
      idleTimeout: 15,
      actions: [
        {
          type: "http",
          title: "Fetch health",
          url: "https://example.com/health",
          method: "GET",
          headers: [
            {
              key: "Authorization",
              value: "${globals.api_token}",
            },
          ],
        },
        {
          type: "external_source",
          title: "Search PostHog errors",
          query: "error",
          sourceRef: "lumendesk-posthog",
          sourceName: "Lumendesk PostHog",
          sourceType: "posthog",
        },
      ],
    },
  ],
  globals: [
    {
      key: "api_token",
      secure: true,
      redacted: true,
    },
  ],
  externalSources: [
    {
      ref: "lumendesk-posthog",
      sourceType: "posthog",
      name: "Lumendesk PostHog",
      configuration: {
        orgSlug: "lumendesk",
        posthogBaseUrl: "https://us.posthog.com",
        projectIds: ["123"],
      },
      credentials: {
        authToken: "",
      },
      credentialsRedacted: true,
    },
  ],
};

describe("runbook artifact file helpers", () => {
  it("serializes exported runbooks as YAML", () => {
    const serialized = serializeRunbookArtifactFile(artifact);

    expect(serialized).toContain("format: bitsentry.runbooks.export");
    expect(serialized).toContain("runbooks:");
    expect(serialized.trim().startsWith("{")).toBe(false);
  });

  it("parses YAML runbook artifacts", () => {
    const raw = serializeRunbookArtifactFile(artifact);

    expect(parseRunbookArtifactFile(raw)).toEqual(artifact);
  });

  it("accepts legacy JSON runbook artifacts during import", () => {
    const raw = JSON.stringify(artifact, null, 2);

    expect(parseRunbookArtifactFile(raw)).toEqual(artifact);
  });

  it("rejects malformed artifact files", () => {
    expect(() => parseRunbookArtifactFile("format: [")).toThrow(
      "Invalid runbook import file. Expected YAML or JSON.",
    );
  });
});
