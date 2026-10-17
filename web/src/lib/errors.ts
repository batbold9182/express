// What a failed request is and what to tell the user about it. Pure on purpose: no `import.meta`
// and no imports, so the root Jest suite can load it (`api.ts` and `queries/client.ts` cannot be).
// `api.ts` and `queries/client.ts` re-export these, so callers import from wherever they already do.

/**
 * `status` is set for HTTP failures; `code` is set when no response arrived at all —
 * the request ran out of time, or the network/server was unreachable.
 */
export type ApiError = Error & { status?: number; code?: 'timeout' | 'network'; body?: { error?: string } };

/**
 * True for a real "that doesn't exist" — as opposed to the request failing. Spotify answers a
 * malformed id with 400 rather than 404, and the proxy routes pass that through.
 */
export const isNotFound = (e: unknown) => {
  const status = (e as ApiError | null)?.status;
  return status === 404 || status === 400;
};

/** One user-facing sentence for a failed request. */
export function describeError(e: unknown): string {
  const { code, status } = (e ?? {}) as ApiError;
  if (code === 'timeout')  return 'The server is taking too long to respond.';
  if (code === 'network')  return "Can't reach the server. Check your connection.";
  if (status === 429)      return 'Too many requests — wait a moment and try again.';
  if (status && status >= 500) return 'Something went wrong on our side.';
  return 'Something went wrong.';
}

/** What a failed mutation says. A 4xx usually carries the server's own explanation ("You already reviewed this track"). */
export function mutationMessage(error: unknown): string {
  const { status, body } = (error ?? {}) as ApiError;
  if (status && status >= 400 && status < 500 && body?.error) return body.error;
  return describeError(error);
}
