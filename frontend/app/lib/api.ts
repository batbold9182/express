const BASE = "http://127.0.0.1:3000";

async function get(path: string, token: string) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return res.json();
}

export const api = { get };
