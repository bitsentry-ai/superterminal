import type { ErrorSourceConfiguration } from "./desktop-error-sources.types";

export interface DesktopSentryProjectSummary {
  id: string;
  slug: string;
  name: string;
  organizationId?: string;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of value) {
    if (item === null || item === undefined) continue;

    const normalized = String(item).trim();
    if (normalized.length === 0 || seen.has(normalized)) continue;

    seen.add(normalized);
    items.push(normalized);
  }
  return items;
}

type ProjectSelection = {
  selectedProjects: DesktopSentryProjectSummary[];
  missingProjectIds: string[];
  missingProjectSlugs: string[];
};

type SentryProjectSelectionResult = {
  projectIds: string[];
  projectSlugs: string[];
  projectNames: string[];
  missingProjectIds: string[];
  missingProjectSlugs: string[];
};

function addSelectedProject(
  selectedProjects: DesktopSentryProjectSummary[],
  seenIds: Set<string>,
  project: DesktopSentryProjectSummary,
): void {
  if (seenIds.has(project.id)) return;

  seenIds.add(project.id);
  selectedProjects.push(project);
}

function selectProjectsById(
  requestedIds: string[],
  byId: Map<string, DesktopSentryProjectSummary>,
): ProjectSelection {
  const selectedProjects: DesktopSentryProjectSummary[] = [];
  const seenIds = new Set<string>();
  const missingProjectIds: string[] = [];

  for (const projectId of requestedIds) {
    const project = byId.get(projectId);
    if (project === undefined) {
      missingProjectIds.push(projectId);
      continue;
    }

    addSelectedProject(selectedProjects, seenIds, project);
  }

  return { selectedProjects, missingProjectIds, missingProjectSlugs: [] };
}

function selectProjectsBySlug(
  requestedSlugs: string[],
  bySlug: Map<string, DesktopSentryProjectSummary>,
): ProjectSelection {
  const selectedProjects: DesktopSentryProjectSummary[] = [];
  const seenIds = new Set<string>();
  const missingProjectSlugs: string[] = [];

  for (const projectSlug of requestedSlugs) {
    const project = bySlug.get(projectSlug);
    if (project === undefined) {
      missingProjectSlugs.push(projectSlug);
      continue;
    }

    addSelectedProject(selectedProjects, seenIds, project);
  }

  return { selectedProjects, missingProjectIds: [], missingProjectSlugs };
}

function selectAllProjects(
  projects: DesktopSentryProjectSummary[],
): ProjectSelection {
  const selectedProjects: DesktopSentryProjectSummary[] = [];
  const seenIds = new Set<string>();

  for (const project of projects) {
    addSelectedProject(selectedProjects, seenIds, project);
  }

  return { selectedProjects, missingProjectIds: [], missingProjectSlugs: [] };
}

function buildSelectionResult(
  selection: ProjectSelection,
  requestedIds: string[],
): SentryProjectSelectionResult {
  let projectIds = selection.selectedProjects.map((project) => project.id);
  if (requestedIds.length > 0) {
    projectIds = requestedIds;
  }

  return {
    projectIds,
    projectSlugs: selection.selectedProjects.map((project) => project.slug),
    projectNames: selection.selectedProjects.map((project) => project.name),
    missingProjectIds: selection.missingProjectIds,
    missingProjectSlugs: selection.missingProjectSlugs,
  };
}

export function readConfiguredProjectIds(
  configuration:
    | ErrorSourceConfiguration
    | Record<string, unknown>
    | null
    | undefined,
): string[] {
  return normalizeStringList(configuration?.projectIds).filter((projectId) =>
    /^\d+$/.test(projectId),
  );
}

export function readConfiguredProjectSlugs(
  configuration:
    | ErrorSourceConfiguration
    | Record<string, unknown>
    | null
    | undefined,
): string[] {
  return normalizeStringList(configuration?.projectSlugs);
}

export function resolveSentryProjectSelection(
  projects: DesktopSentryProjectSummary[],
  input: {
    projectIds?: string[];
    projectSlugs?: string[];
    defaultToAll?: boolean;
  },
): SentryProjectSelectionResult {
  const requestedIds = normalizeStringList(input.projectIds).filter(
    (projectId) => /^\d+$/.test(projectId),
  );
  const requestedSlugs = normalizeStringList(input.projectSlugs);

  const byId = new Map(projects.map((project) => [project.id, project]));
  const bySlug = new Map(projects.map((project) => [project.slug, project]));

  if (requestedIds.length > 0) {
    return buildSelectionResult(
      selectProjectsById(requestedIds, byId),
      requestedIds,
    );
  }

  if (requestedSlugs.length > 0) {
    return buildSelectionResult(
      selectProjectsBySlug(requestedSlugs, bySlug),
      requestedIds,
    );
  }

  if (input.defaultToAll === true) {
    return buildSelectionResult(selectAllProjects(projects), requestedIds);
  }

  return buildSelectionResult(
    { selectedProjects: [], missingProjectIds: [], missingProjectSlugs: [] },
    requestedIds,
  );
}
