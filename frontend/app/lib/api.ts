const BASE = process.env.EXPO_PUBLIC_API_BASE;

type RefreshConfig = {
  spotifyId: string;
  onNewToken: (token: string, expiresAt: number) => void;
  onAuthFailure: () => void;
};

let _refresh: RefreshConfig | null = null;
let _refreshPromise: Promise<string | null> | null = null;

export function configureRefresh(cfg: RefreshConfig) {
  _refresh = cfg;
}

async function tryRefresh(): Promise<string | null> {
  if (!_refresh) return null;
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...NGROK },
        body: JSON.stringify({ spotifyId: _refresh!.spotifyId }),
      });
      if (!res.ok) return null;
      const { access_token, expires_in } = await res.json();
      const expiresAt = Date.now() + (expires_in ?? 3600) * 1000;
      _refresh!.onNewToken(access_token, expiresAt);
      return access_token;
    } catch {
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}

const NGROK = { 'ngrok-skip-browser-warning': '1' };

async function get(path: string, token: string, signal?: AbortSignal) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, ...NGROK },
    signal,
  });
  if (res.status === 401) {
    const newToken = await tryRefresh();
    if (!newToken) { _refresh?.onAuthFailure(); throw new Error('401'); }
    const retry = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${newToken}`, ...NGROK },
      signal,
    });
    if (!retry.ok) throw new Error(`${retry.status} ${path}`);
    return retry.json();
  }
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

async function post(path: string, token: string, body: object) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...NGROK },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    const newToken = await tryRefresh();
    if (!newToken) { _refresh?.onAuthFailure(); throw new Error('401'); }
    const retry = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${newToken}`, 'Content-Type': 'application/json', ...NGROK },
      body: JSON.stringify(body),
    });
    if (!retry.ok) throw new Error(`${retry.status} ${path}`);
    return retry.json();
  }
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

async function put(path: string, token: string, body: object) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...NGROK },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    const newToken = await tryRefresh();
    if (!newToken) { _refresh?.onAuthFailure(); throw new Error('401'); }
    const retry = await fetch(`${BASE}${path}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${newToken}`, 'Content-Type': 'application/json', ...NGROK },
      body: JSON.stringify(body),
    });
    if (!retry.ok) throw new Error(`${retry.status} ${path}`);
    return retry.json();
  }
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

async function del(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, ...NGROK },
  });
  if (res.status === 401) {
    const newToken = await tryRefresh();
    if (!newToken) { _refresh?.onAuthFailure(); throw new Error('401'); }
    const retry = await fetch(`${BASE}${path}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${newToken}`, ...NGROK },
    });
    if (!retry.ok) throw new Error(`${retry.status} ${path}`);
    return retry.json();
  }
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

export const api = { get, post, put, del };
