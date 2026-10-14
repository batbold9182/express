/**
 * When a failed query is worth asking again.
 *
 * One retry: enough to rescue a Render cold start (the first attempt times out, the second hits a
 * warm server), not enough to stack 30-second timeouts into minutes of spinner. A 4xx — including a
 * 401 — will not get better by repeating it, and a cancelled request is not a failure at all.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const e = error as { status?: number; name?: string } | null | undefined;
  if (e?.name === 'AbortError') return false;
  if (typeof e?.status === 'number' && e.status >= 400 && e.status < 500) return false;
  return failureCount < 1;
}
