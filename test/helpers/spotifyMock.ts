type Reply = { status: number; body: unknown } | Error;

const json = (status: number, body: unknown) =>
    new Response(status === 204 || body === undefined ? null : typeof body === "string" ? body : JSON.stringify(body), { status });

/**
 * Stands in for Spotify. Replaces the global `fetch` for each test, so no test touches the network.
 *
 *   const spotify = useSpotifyMock();
 *   spotify.on("/v1/tracks/t1", { id: "t1", name: "Song" });          // 200 with JSON
 *   spotify.on("/v1/tracks/missing", "Not found", 404);                // Spotify's error text, as a string
 *   spotify.fail("/v1/tracks/boom");                                   // fetch itself throws (network down)
 *   expect(spotify.calls("/v1/tracks/t1")).toBe(1);                    // how often the route went upstream
 *
 * A route is matched on `pathname + search` exactly as the backend builds it, e.g. "/v1/albums/a1/tracks?limit=50".
 * The client-credentials token request is answered automatically (`tokenReply` overrides it) and is not counted in `calls`.
 * `console.error` is silenced while it is installed (the routes log upstream failures on purpose).
 * Any other URL is recorded in `unmocked`, throws, and fails the test in afterEach — a missing mock is a test bug,
 * and without that check the route would swallow the throw and answer 500.
 */
export function useSpotifyMock() {
    const replies = new Map<string, Reply>();
    const log: { path: string; headers: Headers }[] = [];
    const unmocked: string[] = [];
    const holds = new Map<string, Promise<void>>();
    let tokenOverride: { status: number; body: unknown } | null = null;
    let tokenCalls = 0;
    let fallbackReply: { status: number; body: unknown } | null = null;

    beforeEach(() => {
        replies.clear();
        holds.clear();
        tokenOverride = null;
        tokenCalls = 0;
        fallbackReply = null;
        log.length = 0;
        unmocked.length = 0;

        // The routes log every upstream failure on purpose, and these tests cause plenty. Silence it so a real
        // problem is not buried; the assertions on status and body are what check the behaviour.
        jest.spyOn(console, "error").mockImplementation(() => {});

        jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
            const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url);

            if (url.hostname === "accounts.spotify.com") {
                tokenCalls++;
                if (tokenOverride) return json(tokenOverride.status, tokenOverride.body);
                return json(200, { access_token: "test-app-token", expires_in: 3600 });
            }

            const path = url.pathname + url.search;
            const reply = url.hostname === "api.spotify.com" ? (replies.get(path) ?? fallbackReply ?? undefined) : undefined;
            if (!reply) {
                unmocked.push(url.href);
                throw new Error(`Unmocked fetch in a test: ${url.href}`);
            }
            log.push({ path, headers: new Headers(init?.headers) });
            const gate = holds.get(path);
            if (gate) await gate; // the call is counted on arrival; the reply waits for release()
            if (reply instanceof Error) throw reply;
            return json(reply.status, reply.body);
        });
    });

    afterEach(() => {
        // Checked here so it fails the test that made the call, wherever the route's own catch block put the error.
        expect(unmocked).toEqual([]);
    });

    return {
        on(path: string, body: unknown, status = 200) {
            replies.set(path, { status, body });
        },
        fail(path: string, error: Error = new TypeError("fetch failed")) {
            replies.set(path, error);
        },
        /**
         * Answers EVERY api.spotify.com path that has no exact `on()` route, instead of treating it as an unmocked
         * call. For security tests that state "this must not go upstream": the call still happens and is counted today
         * (so the test can fail on `calls()`), rather than failing for the wrong reason as an unmocked fetch.
         */
        fallback(body: unknown, status = 200) {
            fallbackReply = { status, body };
        },
        /**
         * Makes Spotify's token endpoint (accounts.spotify.com) answer with this status and body for the rest of the
         * test — for the OAuth callback's "token exchange failed" path. It is a success by default.
         */
        tokenReply(status: number, body: unknown) {
            tokenOverride = { status, body };
        },
        /** How many times the token endpoint was called in this test (the app token and the OAuth exchange both use it). */
        tokenCalls() {
            return tokenCalls;
        },
        /** Holds back the reply for `path` until the returned function is called — for requests that overlap in time. */
        hold(path: string) {
            let release!: () => void;
            holds.set(path, new Promise<void>((resolve) => (release = resolve)));
            return release;
        },
        /** Upstream calls to `path`, or to anything when omitted. */
        calls(path?: string) {
            return path === undefined ? log.length : log.filter((c) => c.path === path).length;
        },
        /**
         * Every upstream call so far, as `pathname + search` in the order they arrived (the token endpoint is not
         * included). For tests that check WHICH query parameters were sent without caring about their order:
         * `new URL(p, "https://x").searchParams`.
         */
        paths() {
            return log.map((c) => c.path);
        },
        /** The headers of the most recent upstream call to `path`. */
        lastHeaders(path: string) {
            const matching = log.filter((c) => c.path === path);
            return matching[matching.length - 1]?.headers;
        },
        /** URLs that were fetched with no mock. Only a test of this helper should ever clear it. */
        unmocked,
    };
}
