/* eslint-disable @typescript-eslint/no-explicit-any */
export const API_BASE = import.meta.env.VITE_API_BASE as string;
const BASE = API_BASE;

let _token: string | null = null;
let _onAuthFailure: (() => void) | null = null;

import type { ApiError } from './errors';
export { isNotFound, describeError, type ApiError } from './errors';

// Render's free tier cold-starts in 30-60s. This is long enough not to punish a normally slow
// request, short enough that a hung one surfaces an error instead of spinning forever.
const REQUEST_TIMEOUT_MS = 30_000;

export function configureApi(token: string | null, onAuthFailure: () => void) {
  _token = token;
  _onAuthFailure = onAuthFailure;
}

/**
 * `anonymous` is for the signed-out screens (sign in, register, forgot / reset password): no
 * session header, and a 401 is an ordinary failure ("wrong password") rather than a logout.
 */
async function request<T = any>(method: string, path: string, body?: object, signal?: AbortSignal, anonymous = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (_token && !anonymous) headers['Authorization'] = `Bearer ${_token}`;
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

    if (res.status === 401 && !anonymous) {
      _onAuthFailure?.();
      // The status is carried so a retry policy can see that asking again won't help.
      throw Object.assign(new Error('401'), { status: 401 }) as ApiError;
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

/** The signed-out screens' client: same timeout and typed errors, never sends or ends a session. */
export const publicApi = {
  post: <T = any>(path: string, body: object) => request<T>('POST', path, body, undefined, true),
};
