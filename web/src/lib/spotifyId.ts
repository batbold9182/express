// A Spotify id is exactly 22 letters or digits — the same rule the backend enforces on its Spotify
// routes. Pure on purpose (no imports, no `import.meta`) so the root Jest suite can load it.
//
// The catalog pages take the id from the address bar. Checking it before any request means a
// crafted link (`/song/..%2Fusers%2Fme`, which the router decodes to `../users/me`) can never steer
// the app into calling some other endpoint with the user's session; such a page just says "not found".

export const isSpotifyId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9]{22}$/.test(v);
