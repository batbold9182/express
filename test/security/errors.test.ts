import request from "supertest";
import app from "../../backend/app";
import { useMemoryMongo } from "../helpers/mongo";
import { useSpotifyMock } from "../helpers/spotifyMock";
import { useEnv } from "../helpers/env";
import { makeUser, spotifyId, uniqueId } from "../helpers/fixtures";

// Security tests, Step 7: what the API tells a stranger when something goes wrong, and who may call it from a browser.
// See plan.md -> "Security tests". Each test states the SECURE behaviour. Where the hole is open it is `it.failing`: it passes
// today and goes red the day the fix lands, at which point `express-backend` removes the marker and it becomes the permanent
// guard. Plain `it` is a guard that holds either way.
//
//   [M4]  Raw errors reach the client. Review and list 400s carry `detail` (a Mongoose error with its schema keys), and the
//         OAuth token-exchange error carries `detail: tokens` (Spotify's own error body).
//   [L4]  CORS is open (`Access-Control-Allow-Origin: *`), and there is no global error handler, so a thrown error is an HTML
//         page naming the error class and the file paths of the stack (Express hides the stack only when NODE_ENV=production;
//         these tests run with NODE_ENV=test, so the answer must be safe whatever NODE_ENV is).
//
// The numbers and rules (plan.md): CORS allows only `FRONTEND_WEB_BASE` (a comma-separated list of exact origins); a request with
// no `Origin` is unaffected, because the share-page functions and the mobile app are server-side callers that send none. (CORS
// is weak protection for a bearer-token API: keep it, but never let it block a legitimate caller.) Env validation at boot needs
// the function to exist first and is written with the fix.

useMemoryMongo();
const spotify = useSpotifyMock();
const env = useEnv();

// What a stack or an internal error gives away.
const LEAKS = /SyntaxError|TypeError|ReferenceError|PayloadTooLargeError|ValidationError|ValidatorError|CastError|node_modules|\bat \S+ \(|\.js:\d+|\.ts:\d+/;

// ─────────────────────────────────────────────────────────────────────────────
// [M4] no raw error detail
// ─────────────────────────────────────────────────────────────────────────────

describe("[M4] a failed request tells the client what went wrong, not how the server is built", () => {
    // The status stays, and so does a short plain message in `error`.
    const plain = (body: Record<string, unknown>) => {
        expect(typeof body.error).toBe("string");
        expect((body.error as string).length).toBeGreaterThan(0);
        expect(body.detail).toBeUndefined();
        expect(JSON.stringify(body)).not.toMatch(LEAKS);
    };

    it.failing("[M4] a review the database refuses has no `detail`", async () => {
        const { auth } = await makeUser();

        // No trackName: the schema requires one, so Mongoose rejects it and the route answers 400.
        const res = await request(app).post("/reviews").set(auth).send({ type: "track", spotifyTrackId: spotifyId(), artistName: "Artist", score: 5 });

        expect(res.status).toBe(400);
        plain(res.body);
    });

    it.failing("[M4] a list the database refuses has no `detail`", async () => {
        const { auth } = await makeUser();

        // A title over the 80 characters the schema allows.
        const res = await request(app).post("/lists").set(auth).send({ title: "t".repeat(81), items: [] });

        expect(res.status).toBe(400);
        plain(res.body);
    });

    // Spotify's own error body (which can name the client or the grant) must not be handed on to whoever made the request.
    it.failing("[M4] a failed Spotify token exchange does not return Spotify's error", async () => {
        spotify.tokenReply(400, { error: "invalid_grant", error_description: "Authorization code expired for client 123" });

        const res = await request(app).get(`/auth/callback?code=${uniqueId("code")}`);

        expect(res.body?.detail).toBeUndefined();
        expect(JSON.stringify(res.body ?? {})).not.toMatch(/invalid_grant|expired for client/);
        expect(res.text ?? "").not.toMatch(/invalid_grant|expired for client/);
    });

    it("an ordinary review still works", async () => {
        const { auth } = await makeUser();

        const res = await request(app).post("/reviews").set(auth).send({ type: "track", spotifyTrackId: spotifyId(), trackName: "Song", artistName: "Artist", score: 5 });

        expect(res.status).toBe(201);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [L4] a thrown error is JSON with no stack
// ─────────────────────────────────────────────────────────────────────────────

describe("[L4] errors the routes do not catch", () => {
    const answersSafely = (res: { status: number; headers: Record<string, string>; text: string; body: unknown }, statuses: number[]) => {
        expect(statuses).toContain(res.status);
        expect(res.headers["content-type"]).toMatch(/json/);
        expect(typeof (res.body as { error?: unknown }).error).toBe("string");
        expect(res.text).not.toMatch(LEAKS);
    };

    // express.json() throws a SyntaxError, and without an error handler of our own Express answers with an HTML page that
    // names it and lists the stack.
    it.failing("[L4] a body that is not valid JSON is a JSON 400 with no stack", async () => {
        const res = await request(app).post("/auth/email-login").set("Content-Type", "application/json").send("{not json");

        answersSafely(res, [400]);
    });

    it.failing("[L4] a body over the size limit is a JSON 413 with no stack", async () => {
        const res = await request(app).post("/auth/email-login").send({ email: "a@x.test", password: "x".repeat(200_000) });

        answersSafely(res, [413]);
    });

    // An async handler that throws (here `text.trim` on an object): Express 5 passes it to the default handler, which prints it.
    it.failing("[L4] a handler that throws is a JSON error with no stack", async () => {
        const { auth } = await makeUser();

        const res = await request(app).post("/feedback").set(auth).send({ type: "bug", text: { not: "a string" } });

        answersSafely(res, [400, 500]);
    });

    it("an ordinary feedback post still works", async () => {
        const { auth } = await makeUser();

        const res = await request(app).post("/feedback").set(auth).send({ type: "bug", text: "It broke" });

        expect(res.status).toBe(201);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [L4] CORS: only our own web origins
// ─────────────────────────────────────────────────────────────────────────────

describe("[L4] CORS", () => {
    const WEB = "https://tunelog.test";
    const WEB_2 = "https://www.tunelog.test";
    const ALLOWED = [WEB, WEB_2];

    /**
     * An instance of the app built AFTER the allowlist is in the environment, so the test does not care whether the backend
     * reads `FRONTEND_WEB_BASE` when it starts or on every request. (It is a second, never-connected copy of the app: these
     * tests only look at headers, and `/health` answers 503 on it, which is fine.)
     */
    function appWith(allowlist: string | undefined) {
        env.set("FRONTEND_WEB_BASE", allowlist);
        let fresh!: typeof app;
        jest.isolateModules(() => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            fresh = require("../../backend/app").default;
        });
        return fresh;
    }

    // The answer is either no CORS header at all or one of our own origins: never `*` and never the caller's own.
    const grantedTo = (res: { headers: Record<string, string> }) => res.headers["access-control-allow-origin"];
    const nothingForStrangers = (res: { headers: Record<string, string> }) => expect([undefined, ...ALLOWED]).toContain(grantedTo(res));

    const strangers: [string, string][] = [
        ["another site", "https://evil.example"],
        ["the right host over http", "http://tunelog.test"],
        ["a lookalike that starts with ours", "https://tunelog.test.evil.example"],
        ["our host on another port", "https://tunelog.test:8443"],
        ["a subdomain nobody listed", "https://sub.tunelog.test"],
        ["a Vercel preview deploy", "https://tunelog-git-branch-someone.vercel.app"],
        ["the string null (a sandboxed page)", "null"],
    ];

    it.failing.each(strangers)("[L4] a page from %s gets no permission to read answers", async (_label, origin) => {
        const res = await request(appWith(ALLOWED.join(","))).get("/health").set("Origin", origin);

        nothingForStrangers(res);
    });

    it.failing.each(strangers)("[L4] a preflight from %s is not approved", async (_label, origin) => {
        const res = await request(appWith(ALLOWED.join(",")))
            .options("/reviews")
            .set("Origin", origin)
            .set("Access-Control-Request-Method", "POST")
            .set("Access-Control-Request-Headers", "authorization,content-type");

        nothingForStrangers(res);
    });

    it.failing.each(ALLOWED)("[L4] our own origin %s is allowed, by name", async (origin) => {
        const res = await request(appWith(ALLOWED.join(","))).get("/health").set("Origin", origin);

        expect(grantedTo(res)).toBe(origin);
        expect(res.headers["vary"] ?? "").toMatch(/Origin/i); // so a cache does not hand one origin's answer to another
    });

    it.failing("[L4] our own origin's preflight is approved, and Authorization may be sent", async () => {
        const res = await request(appWith(ALLOWED.join(",")))
            .options("/reviews")
            .set("Origin", WEB)
            .set("Access-Control-Request-Method", "POST")
            .set("Access-Control-Request-Headers", "authorization,content-type");

        expect(grantedTo(res)).toBe(WEB);
        expect((res.headers["access-control-allow-headers"] ?? "").toLowerCase()).toContain("authorization");
    });

    it.failing("[L4] with no origin configured, nobody is trusted", async () => {
        const res = await request(appWith(undefined)).get("/health").set("Origin", "https://evil.example");

        expect(grantedTo(res)).toBeUndefined();
    });

    // Server-side callers (the share-page functions, the mobile app) send no Origin, and CORS must never block them.
    it("a request with no Origin works as it always did", async () => {
        const res = await request(app).get("/health");

        expect(res.status).toBe(200);
    });
});
