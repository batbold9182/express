/* eslint-disable @typescript-eslint/no-explicit-any */
export const API_BASE = import.meta.env.VITE_API_BASE as string;
const BASE = API_BASE;

let _token: string | null = null;
let _onAuthFailure: (() => void) | null = null;

/**
 * `status` is set for HTTP failures; `code` is set when no response arrived at all —
 * the request ran out of time, or the network/server was unreachable.
 */
export type ApiError = Error & { status?: number; code?: 'timeout' | 'network'; body?: { error?: string } };

// Render's free tier cold-starts in 30-60s. This is long enough not to punish a normally slow
// request, short enough that a hung one surfaces an error instead of spinning forever.
export const REQUEST_TIMEOUT_MS = 30_000;

export function configureApi(token: string | null, onAuthFailure: () => void) {
  _token = token;
  _onAuthFailure = onAuthFailure;
}

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

async function request<T = any>(method: string, path: string, body?: object, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = {};
  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  if (body) headers['Content-Type'] = 'application/json';

  // Our own controller, so the timeout and a caller's signal (Search aborts superseded queries)
  // can both cancel the request without either swallowing the other.
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, REQUEST_TIMEOUT_MS);
  const onCallerAbort = () => ctrl.abort();
  if (signal?.aborted) ctrl.abort();
  else signal?.addEventListener('abort', onCallerAbort, { once: true });

  // A timeout and an unreachable server both surface as an abort / TypeError from fetch. Tag them;
  // a caller's own abort passes through untouched so existing `e.name === 'AbortError'` checks hold.
  const classify = (e: unknown): unknown => {
    if (timedOut) return Object.assign(new Error(`timeout ${path}`), { code: 'timeout' }) as ApiError;
    if (signal?.aborted) return e;
    if (e instanceof TypeError) return Object.assign(new Error(`network ${path}`), { code: 'network' }) as ApiError;
    return e;
  };

  try {
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
    } catch (e) { throw classify(e); }

    if (res.status === 401) {
      _onAuthFailure?.();
      throw new Error('401');
    }
    if (res.status === 204) return null as T;
    if (!res.ok) {
      // Keep the old message shape, but carry the status and parsed body so callers
      // can show the server's own error text instead of a generic failure.
      const err = new Error(`${res.status} ${path}`) as ApiError;
      err.status = res.status;
      try { err.body = await res.json(); } catch { /* non-JSON error body */ }
      throw err;
    }
    // The timer stays armed through the body read: a response that stalls mid-stream times out too.
    try { return await res.json(); } catch (e) { throw classify(e); }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}

export const api = {
  get:  <T = any>(path: string, signal?: AbortSignal) => request<T>('GET',    path, undefined, signal),
  post: <T = any>(path: string, body: object)         => request<T>('POST',   path, body),
  put:  <T = any>(path: string, body: object)         => request<T>('PUT',    path, body),
  del:  <T = any>(path: string)                       => request<T>('DELETE', path),
};
