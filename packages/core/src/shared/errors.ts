export function getErrorMessage(
  error: unknown,
  fallback = 'Unknown error',
): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message !== '') {
      return message;
    }
  }

  if (typeof error === 'string') {
    const message = error.trim();
    if (message !== '') {
      return message;
    }
  }

  return fallback;
}

export function getErrorStack(error: unknown): string | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  return error.stack;
}
