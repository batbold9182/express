/* eslint-disable @typescript-eslint/no-explicit-any */
export const API_BASE = import.meta.env.VITE_API_BASE as string;
const BASE = API_BASE;

let _token: string | null = null;
let _onAuthFailure: (() => void) | null = null;

export type ApiError = Error & { status?: number; body?: { error?: string } };

export function configureApi(token: string | null, onAuthFailure: () => void) {
  _token = token;
  _onAuthFailure = onAuthFailure;
}

async function request<T = any>(method: string, path: string, body?: object, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = {};
  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

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
  return res.json();
}

export const api = {
  get:  <T = any>(path: string, signal?: AbortSignal) => request<T>('GET',    path, undefined, signal),
  post: <T = any>(path: string, body: object)         => request<T>('POST',   path, body),
  put:  <T = any>(path: string, body: object)         => request<T>('PUT',    path, body),
  del:  <T = any>(path: string)                       => request<T>('DELETE', path),
};
