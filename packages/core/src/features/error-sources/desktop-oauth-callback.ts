export const OAUTH_CALLBACK_CHANNEL = "bitsentry:oauth:callback";

export interface OAuthCallbackPayload {
  url: string;
  code: string | null;
  state: string | null;
  valid: boolean;
  error?: string;
  receivedAt: string;
}

function hasOauthCallbackPath(parsedUrl: URL): boolean {
  const host = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname.toLowerCase();
  return (
    (host === "oauth" && pathname === "/callback") ||
    pathname === "/oauth/callback"
  );
}

function invalidOAuthCallbackPayload({
  rawUrl,
  receivedAt,
  error,
  code = null,
  state = null,
}: {
  rawUrl: string;
  receivedAt: string;
  error: string;
  code?: string | null;
  state?: string | null;
}): OAuthCallbackPayload {
  return {
    url: rawUrl,
    code,
    state,
    valid: false,
    error,
    receivedAt,
  };
}

function getSearchParam(
  searchParams: URLSearchParams,
  key: string,
): string | null {
  const value = searchParams.get(key);
  if (value === null) return null;

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  return trimmed;
}

export function parseDesktopOAuthCallbackUrl(
  rawUrl: string,
  protocolScheme: string,
  receivedAt = new Date().toISOString(),
): OAuthCallbackPayload {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== `${protocolScheme}:`) {
      return invalidOAuthCallbackPayload({
        rawUrl,
        receivedAt,
        error: `Unsupported protocol: ${parsed.protocol}`,
      });
    }

    if (!hasOauthCallbackPath(parsed)) {
      return invalidOAuthCallbackPayload({
        rawUrl,
        receivedAt,
        error: `Unsupported deep link path: ${parsed.hostname.toLowerCase()}${parsed.pathname.toLowerCase()}`,
      });
    }

    const code = getSearchParam(parsed.searchParams, "code");
    const state = getSearchParam(parsed.searchParams, "state");
    if (code === null || state === null) {
      return invalidOAuthCallbackPayload({
        rawUrl,
        receivedAt,
        code,
        state,
        error: "OAuth callback is missing code or state query parameter",
      });
    }

    return {
      url: rawUrl,
      code,
      state,
      valid: true,
      receivedAt,
    };
  } catch {
    return invalidOAuthCallbackPayload({
      rawUrl,
      receivedAt,
      error: "Malformed callback URL",
    });
  }
}

export function extractDesktopDeepLinkFromArgv(
  argv: string[],
  protocolScheme: string,
): string | null {
  for (const arg of argv) {
    const value = arg.trim();
    if (value.toLowerCase().startsWith(`${protocolScheme}://`)) {
      return value;
    }
  }
  return null;
}

export interface DesktopOAuthCallbackBindings {
  protocolScheme: string;
  parseOAuthCallbackUrl(
    rawUrl: string,
    receivedAt?: string,
  ): OAuthCallbackPayload;
  extractDeepLinkFromArgv(argv: string[]): string | null;
}

export function createDesktopOAuthCallbackBindings(
  protocolScheme: string,
): DesktopOAuthCallbackBindings {
  return {
    protocolScheme,
    parseOAuthCallbackUrl(
      rawUrl: string,
      receivedAt = new Date().toISOString(),
    ): OAuthCallbackPayload {
      return parseDesktopOAuthCallbackUrl(rawUrl, protocolScheme, receivedAt);
    },
    extractDeepLinkFromArgv(argv: string[]): string | null {
      return extractDesktopDeepLinkFromArgv(argv, protocolScheme);
    },
  };
}
