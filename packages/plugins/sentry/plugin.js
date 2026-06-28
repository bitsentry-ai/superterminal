const SENTRY_API_BASE = "https://sentry.io/api/0";
const DEFAULT_ISSUES_LIMIT = 50;
const DEFAULT_EVENTS_LIMIT = 50;
const MAX_ISSUES_LIMIT = 100;
const MAX_EVENTS_LIMIT = 100;

function readString(value, fallback = "") {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return fallback;
}

function readStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function requireString(value, fieldName) {
  const normalized = readString(value);
  if (normalized.length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  return normalized;
}

function boundedInteger(value, fallback, max) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.min(max, Math.trunc(value)));
  }

  return fallback;
}

function readApiBase(auth) {
  const configured = readString(auth.apiBase, readString(auth.baseUrl));
  if (configured.length === 0) {
    return SENTRY_API_BASE;
  }

  const normalized = configured.replace(/\/+$/, "");
  if (normalized.endsWith("/api/0")) {
    return normalized;
  }

  return `${normalized}/api/0`;
}

function authHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };
}

function parseJsonArray(payload) {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.filter(
    (item) => item !== null && typeof item === "object" && !Array.isArray(item),
  );
}

function parseErrorBody(raw) {
  if (raw.length === 0) {
    return "Unknown Sentry API error";
  }

  try {
    const parsed = JSON.parse(raw);
    const detail = readString(parsed?.detail);
    if (detail.length > 0) {
      return detail;
    }

    const error = readString(parsed?.error);
    if (error.length > 0) {
      return error;
    }
  } catch {
    // Keep the original response body below.
  }

  return raw.slice(0, 300);
}

function getQuotedLinkValue(segment, key) {
  const match = segment.match(new RegExp(`${key}="([^"]+)"`, "i"));
  const value = match?.[1];
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return undefined;
}

function withOptionalNextCursor(cursor, hasMore) {
  if (cursor !== null && cursor !== undefined && cursor.length > 0) {
    return { nextCursor: cursor, hasMore };
  }

  return { hasMore };
}

function parseCursorFromLinkUrl(segment, hasMore) {
  const urlMatch = segment.match(/<([^>]+)>/);
  const url = urlMatch?.[1];
  if (typeof url !== "string" || url.length === 0) {
    return { hasMore };
  }

  try {
    return withOptionalNextCursor(new URL(url).searchParams.get("cursor"), hasMore);
  } catch {
    return { hasMore };
  }
}

function parseCursorFromLinkSegment(segment) {
  const hasMore =
    getQuotedLinkValue(segment, "results")?.toLowerCase() === "true";
  const cursor = getQuotedLinkValue(segment, "cursor");
  if (cursor !== undefined) {
    return { nextCursor: cursor, hasMore };
  }

  return parseCursorFromLinkUrl(segment, hasMore);
}

function parseNextCursor(linkHeader) {
  if (linkHeader === null || linkHeader.length === 0) {
    return { hasMore: false };
  }

  for (const segment of linkHeader.split(",").map((part) => part.trim())) {
    if (/rel="next"/i.test(segment)) {
      return parseCursorFromLinkSegment(segment);
    }
  }

  return { hasMore: false };
}

function buildLastSeenQuery(since, until) {
  const clauses = [];
  const normalizedSince = readString(since);
  const normalizedUntil = readString(until);
  if (normalizedSince.length > 0) {
    clauses.push(`lastSeen:>=${normalizedSince}`);
  }
  if (normalizedUntil.length > 0) {
    clauses.push(`lastSeen:<=${normalizedUntil}`);
  }

  return clauses.join(" ");
}

function buildIssuesUrl({ apiBase, orgSlug, projectIds, cursor, limit, query }) {
  const url = new URL(
    `${apiBase}/organizations/${encodeURIComponent(orgSlug)}/issues/`,
  );
  url.searchParams.set("limit", String(limit));

  const normalizedCursor = readString(cursor);
  if (normalizedCursor.length > 0) {
    url.searchParams.set("cursor", normalizedCursor);
  }

  for (const projectId of readStringArray(projectIds)) {
    if (/^\d+$/.test(projectId)) {
      url.searchParams.append("project", projectId);
    }
  }

  const normalizedQuery = readString(query);
  if (normalizedQuery.length > 0) {
    url.searchParams.set("query", normalizedQuery);
  }

  return url;
}

function retryDelay(response, fallbackMs) {
  const header = response.headers.get("retry-after");
  if (header === null || header.length === 0) {
    return fallbackMs;
  }

  const retryAfterSeconds = Number(header);
  if (Number.isFinite(retryAfterSeconds)) {
    return Math.max(500, retryAfterSeconds * 1_000);
  }

  return fallbackMs;
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldRetry(response, attempt, maxAttempts) {
  return (response.status === 429 || response.status >= 500) && attempt < maxAttempts;
}

async function requestSentry(url, init, maxAttempts = 5) {
  let attempt = 0;
  let delayMs = 1_000;

  while (attempt < maxAttempts) {
    attempt += 1;
    const response = await fetch(url, init);
    if (response.ok) {
      return response;
    }

    if (!shouldRetry(response, attempt, maxAttempts)) {
      const body = await response.text().catch(() => "");
      throw new Error(`Sentry API ${String(response.status)}: ${parseErrorBody(body)}`);
    }

    await wait(retryDelay(response, delayMs));
    delayMs = Math.min(delayMs * 2, 30_000);
  }

  throw new Error("Sentry API request failed after retries");
}

async function listOrganizations({ auth }) {
  const accessToken = requireString(auth.accessToken, "accessToken");
  const apiBase = readApiBase(auth);
  const response = await requestSentry(`${apiBase}/organizations/`, {
    headers: authHeaders(accessToken),
  });
  const organizations = parseJsonArray(await response.json()).map((item) => {
    const slug = readString(item.slug, readString(item.id));
    return {
      slug,
      name: readString(item.name, slug),
    };
  });

  return {
    status: 200,
    summary: `Fetched ${String(organizations.length)} Sentry organizations.`,
    data: organizations,
  };
}

async function listProjects({ auth, input }) {
  const accessToken = requireString(auth.accessToken, "accessToken");
  const orgSlug = requireString(input.orgSlug, "orgSlug");
  const apiBase = readApiBase(auth);
  const response = await requestSentry(
    `${apiBase}/organizations/${encodeURIComponent(orgSlug)}/projects/`,
    {
      headers: authHeaders(accessToken),
    },
  );
  const projects = parseJsonArray(await response.json()).map((item) => {
    const id = readString(item.id);
    const slug = readString(item.slug, id);
    return {
      id,
      slug,
      name: readString(item.name, slug),
      organizationId: orgSlug,
    };
  });

  return {
    status: 200,
    summary: `Fetched ${String(projects.length)} Sentry projects.`,
    data: projects,
  };
}

async function queryIssues({ auth, input }) {
  return fetchIssues({
    auth,
    input: {
      ...input,
      query: readString(input.query),
    },
  });
}

async function listIssues({ auth, input }) {
  return fetchIssues({
    auth,
    input: {
      ...input,
      query: buildLastSeenQuery(input.since, input.until),
    },
  });
}

async function fetchIssues({ auth, input }) {
  const accessToken = requireString(auth.accessToken, "accessToken");
  const orgSlug = requireString(input.orgSlug, "orgSlug");
  const apiBase = readApiBase(auth);
  const limit = boundedInteger(input.limit, DEFAULT_ISSUES_LIMIT, MAX_ISSUES_LIMIT);
  const url = buildIssuesUrl({
    apiBase,
    orgSlug,
    projectIds: input.projectIds,
    cursor: input.cursor,
    limit,
    query: input.query,
  });
  const response = await requestSentry(url.toString(), {
    headers: authHeaders(accessToken),
  });
  const issues = parseJsonArray(await response.json());
  const page = parseNextCursor(response.headers.get("link"));

  return {
    status: 200,
    summary: `Fetched ${String(issues.length)} Sentry issues.`,
    data: {
      issues,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    },
  };
}

async function listIssueEvents({ auth, input }) {
  const accessToken = requireString(auth.accessToken, "accessToken");
  const orgSlug = requireString(input.orgSlug, "orgSlug");
  const issueId = requireString(input.issueId, "issueId");
  const apiBase = readApiBase(auth);
  const limit = boundedInteger(input.limit, DEFAULT_EVENTS_LIMIT, MAX_EVENTS_LIMIT);
  const url = new URL(
    `${apiBase}/organizations/${encodeURIComponent(orgSlug)}/issues/${encodeURIComponent(issueId)}/events/`,
  );
  url.searchParams.set("limit", String(limit));

  const cursor = readString(input.cursor);
  if (cursor.length > 0) {
    url.searchParams.set("cursor", cursor);
  }

  const since = readString(input.since);
  if (since.length > 0) {
    url.searchParams.set("start", since);
  }

  const until = readString(input.until);
  if (until.length > 0) {
    url.searchParams.set("end", until);
  }

  const response = await requestSentry(url.toString(), {
    headers: authHeaders(accessToken),
  });
  const events = parseJsonArray(await response.json());
  const page = parseNextCursor(response.headers.get("link"));

  return {
    status: 200,
    summary: `Fetched ${String(events.length)} Sentry events.`,
    data: {
      events,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    },
  };
}

exports.plugin = {
  id: "sentry",
  name: "Sentry",
  version: "0.1.0",
  description: "Queries Sentry organizations, projects, issues, and events.",
  metadata: {
    errorSource: {
      sourceType: "sentry",
      setupFields: [
        {
          key: "authToken",
          target: "authToken",
          storage: "accessTokenRef",
          label: "Sentry auth token",
          description: "User auth token or OAuth access token for Sentry.",
          required: true,
          control: "password",
        },
        {
          key: "organizationSlug",
          target: "organizationSlug",
          storage: "configuration",
          configurationKey: "orgSlug",
          label: "Organization slug",
          placeholder: "acme",
          required: true,
          control: "text",
        },
        {
          key: "projectSlugs",
          target: "projectSlugs",
          storage: "configuration",
          configurationKey: "projectSlugs",
          label: "Project slugs",
          placeholder: "api\nworker",
          required: false,
          control: "multiline_list",
        },
      ],
      providerActions: {
        listOrganizations: "list_organizations",
        listProjects: "list_projects",
        queryIssues: "query_issues",
        listIssues: "list_issues",
        listIssueEvents: "list_issue_events",
      },
      oauth: {
        envClientIdName: "SENTRY_CLIENT_ID",
        envClientSecretName: "SENTRY_CLIENT_SECRET",
        envRedirectUriName: "SENTRY_REDIRECT_URI",
        defaultRedirectUri: "http://127.0.0.1:48174/oauth/sentry/callback",
        scopes: ["org:read", "project:read", "event:read"],
      },
    },
  },
  auth: {
    fields: [
      {
        key: "accessToken",
        label: "Sentry access token",
        type: "string",
        required: true,
        secret: true,
      },
      {
        key: "baseUrl",
        label: "Sentry base URL",
        type: "string",
        required: false,
      },
    ],
  },
  actions: [
    {
      id: "list_organizations",
      title: "List Sentry organizations",
      description: "List organizations accessible to the Sentry token.",
      riskLevel: "read",
      fields: [],
      execute: listOrganizations,
    },
    {
      id: "list_projects",
      title: "List Sentry projects",
      description: "List projects for a Sentry organization.",
      riskLevel: "read",
      fields: [
        {
          key: "orgSlug",
          label: "Organization slug",
          type: "string",
          required: true,
        },
      ],
      execute: listProjects,
    },
    {
      id: "query_issues",
      title: "Query Sentry issues",
      description: "Query issues for one or more Sentry projects.",
      riskLevel: "read",
      fields: [
        {
          key: "orgSlug",
          label: "Organization slug",
          type: "string",
          required: true,
        },
        {
          key: "projectIds",
          label: "Project IDs",
          type: "string_array",
          required: false,
          defaultValue: [],
        },
        {
          key: "query",
          label: "Query",
          type: "string",
          required: false,
          defaultValue: "",
        },
        {
          key: "limit",
          label: "Limit",
          type: "number",
          required: false,
          defaultValue: DEFAULT_ISSUES_LIMIT,
        },
        {
          key: "cursor",
          label: "Cursor",
          type: "string",
          required: false,
        },
      ],
      execute: queryIssues,
    },
    {
      id: "list_issues",
      title: "List Sentry issues",
      description: "List issues bounded by last-seen timestamps.",
      riskLevel: "read",
      fields: [
        {
          key: "orgSlug",
          label: "Organization slug",
          type: "string",
          required: true,
        },
        {
          key: "projectIds",
          label: "Project IDs",
          type: "string_array",
          required: false,
          defaultValue: [],
        },
        {
          key: "limit",
          label: "Limit",
          type: "number",
          required: false,
          defaultValue: DEFAULT_ISSUES_LIMIT,
        },
        {
          key: "cursor",
          label: "Cursor",
          type: "string",
          required: false,
        },
        {
          key: "since",
          label: "Since",
          type: "string",
          required: false,
        },
        {
          key: "until",
          label: "Until",
          type: "string",
          required: false,
        },
      ],
      execute: listIssues,
    },
    {
      id: "list_issue_events",
      title: "List Sentry issue events",
      description: "List events for a Sentry issue.",
      riskLevel: "read",
      fields: [
        {
          key: "orgSlug",
          label: "Organization slug",
          type: "string",
          required: true,
        },
        {
          key: "issueId",
          label: "Issue ID",
          type: "string",
          required: true,
        },
        {
          key: "limit",
          label: "Limit",
          type: "number",
          required: false,
          defaultValue: DEFAULT_EVENTS_LIMIT,
        },
        {
          key: "cursor",
          label: "Cursor",
          type: "string",
          required: false,
        },
        {
          key: "since",
          label: "Since",
          type: "string",
          required: false,
        },
        {
          key: "until",
          label: "Until",
          type: "string",
          required: false,
        },
      ],
      execute: listIssueEvents,
    },
  ],
  triggers: [],
};
