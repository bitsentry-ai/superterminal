import { describe, expect, it, vi } from "vitest";

import type { DesktopRunbookExportArtifactV1 } from "@bitsentry-ce/core/features/runbooks/desktop-runbook-ce.types";
import { createDesktopYamlRunbookHandlers as createRunbookHandlers } from "@bitsentry-ce/core/features/runbooks/desktop-runbook-handler-yaml-bindings";
import { DesktopRunbookStore as RunbookStore } from "@bitsentry-ce/core/features/runbooks/desktop-runbook.store";

function createDb(overrides?: Partial<Record<string, unknown>>) {
  return {
    runbook: {
      findMany: vi.fn(() => []),
      create: vi.fn(
        ({ data }: { data: Record<string, unknown> }) => data,
      ),
      delete: vi.fn(() => {}),
      ...((overrides?.runbook as Record<string, unknown> | undefined) ?? {}),
    },
    runbookAction: {
      findMany: vi.fn(() => []),
      create: vi.fn(
        ({ data }: { data: Record<string, unknown> }) => data,
      ),
      deleteMany: vi.fn(() => {}),
      ...((overrides?.runbookAction as Record<string, unknown> | undefined) ??
        {}),
    },
    errorSource: {
      findMany: vi.fn(() => []),
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      findUnique: vi.fn(() => null),
      ...((overrides?.errorSource as Record<string, unknown> | undefined) ??
        {}),
    },
  };
}

function createStore(dbOverrides?: Partial<Record<string, unknown>>) {
  const db = createDb(dbOverrides);
  const globalVariablesService = {
    list: vi.fn(() => []),
  };

  return {
    db,
    store: new RunbookStore(db as never, globalVariablesService as never),
  };
}

describe("RunbookStore importRunbooks", () => {
  it("imports a duplicate copy when actions match an existing runbook by fingerprint", async () => {
    const existingRunbookId = "runbook-existing";
    const action = {
      id: "action-existing",
      runbookId: existingRunbookId,
      sortOrder: 0,
      type: "shell",
      title: "Check disk",
      command: "df -h",
    };
    const { store } = createStore({
      runbook: {
        findMany: vi.fn(() => [
          {
            id: existingRunbookId,
            title: "Server health",
            description: "",
            revisionNumber: 1,
            createdAt: "2026-05-31T00:00:00.000Z",
            updatedAt: "2026-05-31T00:00:00.000Z",
          },
        ]),
      },
      runbookAction: {
        findMany: vi.fn(({ where }: { where: { runbookId: string } }) => {
          if (where.runbookId === existingRunbookId) {
            return [action];
          }

          return [];
        }),
      },
    });
    const artifact: DesktopRunbookExportArtifactV1 = {
      format: "bitsentry.runbooks.export",
      version: 1,
      exportedAt: "2026-05-31T00:00:00.000Z",
      runbooks: [
        {
          title: "Server health",
          actions: [
            {
              type: "shell",
              title: "Check disk",
              command: "df -h",
            },
          ],
        },
      ],
    };

    const summary = await store.importRunbooks({
      artifact,
      options: { dryRun: true },
    });

    expect(summary).toMatchObject({
      imported: 1,
      skipped: 0,
      failed: 0,
    });
    expect(summary.results[0]).toMatchObject({
      status: "imported",
      title: "Server health (imported)",
    });
  });

  it("skips matching runbook fingerprints when conflictPolicy is skip", async () => {
    const existingRunbookId = "runbook-existing";
    const action = {
      id: "action-existing",
      runbookId: existingRunbookId,
      sortOrder: 0,
      type: "shell",
      title: "Check disk",
      command: "df -h",
    };
    const { store } = createStore({
      runbook: {
        findMany: vi.fn(() => [
          {
            id: existingRunbookId,
            title: "Server health",
            description: "",
            revisionNumber: 1,
            createdAt: "2026-05-31T00:00:00.000Z",
            updatedAt: "2026-05-31T00:00:00.000Z",
          },
        ]),
      },
      runbookAction: {
        findMany: vi.fn(({ where }: { where: { runbookId: string } }) => {
          if (where.runbookId === existingRunbookId) {
            return [action];
          }

          return [];
        }),
      },
    });
    const artifact: DesktopRunbookExportArtifactV1 = {
      format: "bitsentry.runbooks.export",
      version: 1,
      exportedAt: "2026-05-31T00:00:00.000Z",
      runbooks: [
        {
          title: "Server health",
          actions: [
            {
              type: "shell",
              title: "Check disk",
              command: "df -h",
            },
          ],
        },
      ],
    };

    const summary = await store.importRunbooks({
      artifact,
      options: { conflictPolicy: "skip", dryRun: true },
    });

    expect(summary).toMatchObject({
      imported: 0,
      skipped: 1,
      failed: 0,
    });
    expect(summary.results[0]).toMatchObject({
      status: "skipped",
      runbookId: existingRunbookId,
      reason: 'same runbook actions already exist in "Server health"',
    });
  });

  it("imports legacy external source actions without artifact externalSources", async () => {
    const { store, db } = createStore();
    const artifact: DesktopRunbookExportArtifactV1 = {
      format: "bitsentry.runbooks.export",
      version: 1,
      exportedAt: "2026-05-31T00:00:00.000Z",
      runbooks: [
        {
          title: "Retrieve errors",
          actions: [
            {
              type: "external_source",
              title: "Query Sentry",
              query: "is:unresolved",
              sourceRef: "jagad",
              sourceName: "Jagad",
            },
          ],
        },
      ],
    };

    const summary = await store.importRunbooks({
      artifact,
      options: { dryRun: false },
    });

    expect(summary).toMatchObject({
      imported: 1,
      skipped: 0,
      failed: 0,
    });
    expect(summary.results[0].warnings).toContain(
      'Action "Query Sentry" references external source "Jagad" and should be reviewed in the target environment.',
    );
    const [createRunbookActionCall] = db.runbookAction.create.mock.calls;
    expect(createRunbookActionCall[0]).toMatchObject({
      data: {
        sourceId: null,
      },
    });
  });

  it("rejects external source actions that reference an undefined artifact sourceRef", async () => {
    const { store } = createStore();
    const artifact: DesktopRunbookExportArtifactV1 = {
      format: "bitsentry.runbooks.export",
      version: 1,
      exportedAt: "2026-05-31T00:00:00.000Z",
      runbooks: [
        {
          title: "Retrieve errors",
          actions: [
            {
              type: "external_source",
              title: "Query Sentry",
              query: "is:unresolved",
              sourceRef: "jagad",
            },
          ],
        },
      ],
      externalSources: [
        {
          ref: "other",
          sourceType: "sentry",
          name: "Other",
          configuration: {
            orgSlug: "other",
          },
        },
      ],
    };

    await expect(
      store.importRunbooks({
        artifact,
        options: { dryRun: true },
      }),
    ).rejects.toThrow(
      'External Source action "Query Sentry" references sourceRef "jagad" but the import YAML does not define it under externalSources.',
    );
  });

  it("reuses an existing matching external source even when YAML credentials are blank", async () => {
    const existingSourceId = "source-existing";
    const { store, db } = createStore({
      errorSource: {
        findMany: vi.fn(() => [
          {
            id: existingSourceId,
            sourceType: "sentry",
            name: "Jagad",
            accessTokenRef: "stored-token",
            refreshTokenRef: null,
            expiresAt: null,
            grantedScopes: "[]",
            configuration: JSON.stringify({
              orgSlug: "jagad",
              projectIds: ["4504367120777216"],
              projectSlugs: ["server"],
            }),
            logLevelThreshold: "error",
            additionalMetadata: null,
            syncEnabled: false,
            autoDiagnosisEnabled: false,
            lastSyncAt: null,
            lastSyncStatus: null,
            lastSyncError: null,
            createdAt: "2026-05-31T00:00:00.000Z",
            updatedAt: "2026-05-31T00:00:00.000Z",
          },
        ]),
      },
    });

    const artifact: DesktopRunbookExportArtifactV1 = {
      format: "bitsentry.runbooks.export",
      version: 1,
      exportedAt: "2026-05-31T00:00:00.000Z",
      runbooks: [
        {
          title: "Retrieve errors from Jagad",
          actions: [
            {
              type: "external_source",
              title: "Query Sentry",
              query: "is:unresolved level:error",
              sourceRef: "jagad",
              sourceName: "Jagad",
              sourceType: "sentry",
            },
          ],
        },
      ],
      externalSources: [
        {
          ref: "jagad",
          sourceType: "sentry",
          name: "Jagad",
          configuration: {
            orgSlug: "jagad",
            projectIds: ["4504367120777216"],
            projectSlugs: ["server"],
          },
          credentials: {
            authToken: "",
          },
          credentialsRedacted: true,
        },
      ],
    };

    const summary = await store.importRunbooks({
      artifact,
      options: { dryRun: false },
    });

    expect(summary).toMatchObject({
      imported: 1,
      skipped: 0,
      failed: 0,
    });
    expect(
      db.errorSource.create as ReturnType<typeof vi.fn>,
    ).not.toHaveBeenCalled();
    const [createRunbookActionCall] = db.runbookAction.create.mock.calls;
    expect(createRunbookActionCall[0]).toMatchObject({
      data: {
        sourceId: existingSourceId,
      },
    });
  });

  it("imports external sources without provider-specific auth enforcement", async () => {
    const { store, db } = createStore();
    const artifact: DesktopRunbookExportArtifactV1 = {
      format: "bitsentry.runbooks.export",
      version: 1,
      exportedAt: "2026-05-31T00:00:00.000Z",
      runbooks: [
        {
          title: "Retrieve errors from Jagad",
          actions: [
            {
              type: "external_source",
              title: "Query Sentry",
              query: "is:unresolved level:error",
              sourceRef: "jagad",
              sourceName: "Jagad",
              sourceType: "sentry",
            },
          ],
        },
      ],
      externalSources: [
        {
          ref: "jagad",
          sourceType: "sentry",
          name: "Jagad",
          configuration: {
            orgSlug: "jagad",
            projectSlugs: ["server"],
          },
        },
      ],
    };

    const summary = await store.importRunbooks({
      artifact,
      options: { dryRun: false },
    });

    expect(summary).toMatchObject({
      imported: 1,
      skipped: 0,
      failed: 0,
    });
    const [createSourceCall] = db.errorSource.create.mock.calls;
    expect(createSourceCall[0].data).toMatchObject({
      sourceType: "sentry",
      name: "Jagad",
      accessTokenRef: null,
      refreshTokenRef: null,
    });
    const [createRunbookActionCall] = db.runbookAction.create.mock.calls;
    expect(createRunbookActionCall[0]).toMatchObject({
      data: {
        sourceId: createSourceCall[0].data.id,
      },
    });
  });

  it("rejects external source actions that omit sourceRef", async () => {
    const { store } = createStore();
    const artifact: DesktopRunbookExportArtifactV1 = {
      format: "bitsentry.runbooks.export",
      version: 1,
      exportedAt: "2026-05-31T00:00:00.000Z",
      runbooks: [
        {
          title: "Retrieve errors",
          actions: [
            {
              type: "external_source",
              title: "Query Sentry",
              query: "is:unresolved",
            },
          ],
        },
      ],
      externalSources: [
        {
          ref: "jagad",
          sourceType: "sentry",
          name: "Jagad",
          configuration: {
            orgSlug: "jagad",
          },
          credentials: {
            authToken: "",
          },
        },
      ],
    };

    await expect(
      store.importRunbooks({
        artifact,
        options: { dryRun: true },
      }),
    ).rejects.toThrow(
      'External Source action "Query Sentry" is missing sourceRef in the import YAML.',
    );
  });
});
