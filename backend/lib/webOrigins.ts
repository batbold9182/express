/**
 * The web app's origins: `FRONTEND_WEB_BASE`, a comma-separated list of exact origins (`https://app.example`).
 * No wildcards and no paths: an entry that is not exactly an origin is dropped, so a typo admits nothing.
 * Read on every call, so a changed environment (and the tests) take effect at once.
 */
export function webOrigins(): string[] {
  return (process.env.FRONTEND_WEB_BASE ?? '')
    .split(',')
    .map(s => s.trim().replace(/\/+$/, ''))
    .filter(s => {
      try { return new URL(s).origin === s; } catch { return false; }
    });
}
