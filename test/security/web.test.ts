import fs from "fs";
import path from "path";
import handler from "../../web/api/r";
import ogHandler from "../../web/api/og";
import { fakeReq, fakeRes } from "../helpers/fakeHttp";

// Security tests, Step 8: the web side. See plan.md -> "Security tests" and "Web: what is left". Each test states the SECURE
// behaviour. They were written as `it.failing` while the holes were open; `express-web` fixed the share pages (L3) on
// 2026-11-06 and the leftover file (L5) was deleted, so those are plain, permanent guards. M6 (the login callback) was
// fixed by the web half of the Spotify link fix on 2026-11-13: nothing in this file is expected to fail any more.
//
//   [L3]  The share pages (`web/api/r.ts`, the page a shared link opens, and `web/api/og.ts`, its preview image) crash for a
//         review with no `score` (`review.score.toFixed` is unguarded, and the API accepts such a review), pass the id from the
//         URL into an API path unvalidated (`../users/x` reaches other endpoints), and `og.ts` has the server fetch whatever
//         `albumArt` was stored (the image is rendered by Vercel's server).
//   [L5]  Leftover files: `backend/set-password.js` is tracked and says "Delete this file when you're done".
//   [L6]  The session token lives in `localStorage`, which any XSS can read. React escapes text and there is no
//         `dangerouslySetInnerHTML` today; a guard fails if one is ever added.
//   [M6]  "Login CSRF": `AuthCallback.tsx` signs the browser in from `access_token` and `spotify_id` in the address, so anyone can
//         link a victim to a callback they started themselves. It goes away with the Spotify link fix (plan.md step 4).
//
// The rules (security.md and plan.md): a review id is 24 hex characters; the cover image of a share card may only come from
// `https://i.scdn.co/`; a page that has to describe a review with no score says so without a score rather than failing.
// `og.ts` is run with `@vercel/og` replaced by a stand-in that keeps the element it was asked to draw, so a test can look at it.

jest.mock(
    "@vercel/og",
    () => ({
        ImageResponse: class {
            element: unknown;
            options: unknown;
            constructor(element: unknown, options: unknown) {
                this.element = element;
                this.options = options;
            }
        },
    }),
    { virtual: true },
);

const REVIEW_ID = "507f1f77bcf86cd799439011";
const GENERIC_TITLE = "express — rate music, build your taste";

/** Stands in for the API and for the web's own `/index.html`. Returns the URLs that were fetched. */
function mockFetch(review: unknown) {
    const calls: string[] = [];
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = String(input);
        calls.push(url);
        if (url.includes("/reviews/")) return review === null ? new Response("{}", { status: 404 }) : new Response(JSON.stringify(review));
        if (url.endsWith("/index.html")) return new Response("<html><head><title>placeholder</title></head><body></body></html>");
        throw new Error("unexpected fetch: " + url);
    });
    return calls;
}
const askedTheApi = (calls: string[]) => calls.some((url) => url.includes("/reviews/"));

const review = (over: Record<string, unknown> = {}) => ({ trackName: "Song One", artistName: "Artist A", score: 8.5, text: "great", userId: { displayName: "Ann" }, ...over });

// What a caller can put where a review id belongs.
const badIds: [string, string][] = [
    ["a climb to another endpoint", "../users/me"],
    ["a deeper climb", "../../../etc/passwd"],
    ["a good id followed by a path", `${REVIEW_ID}/../..`],
    ["a good id followed by a query", `${REVIEW_ID}?x=1`],
    ["too short", "abc"],
    ["25 characters", "a".repeat(25)],
    ["24 characters that are not hex", "x".repeat(24)],
];

// ─────────────────────────────────────────────────────────────────────────────
// [L3] the share page: GET /r/:id
// ─────────────────────────────────────────────────────────────────────────────

describe("[L3] web/api/r.ts, the page a shared link opens", () => {
    async function open(id: string, body: unknown) {
        const calls = mockFetch(body);
        const res = fakeRes();
        await handler(fakeReq({ query: { id } }), res);
        return { res, calls, html: String(res.body) };
    }

    // The API accepts a review with no score, so this is a review anyone can post. One of them must not break the page.
    it.each([
        ["no score", undefined],
        ["a null score", null],
    ])("[L3] describes a review with %s instead of failing", async (_label, score) => {
        mockFetch(review({ score }));
        const res = fakeRes();

        await handler(fakeReq({ query: { id: REVIEW_ID } }), res);

        expect(res.statusCode).toBe(200);
        expect(String(res.body)).toContain("Song One");
        expect(String(res.body)).not.toMatch(/undefined|NaN|null\/10/);
    });

    it.each(badIds)("[L3] never sends %s to the API", async (_label, id) => {
        const { res, calls, html } = await open(id, review());

        expect(askedTheApi(calls)).toBe(false);
        expect(res.statusCode).toBe(200);
        expect(html).toContain(GENERIC_TITLE); // the page still opens, as for a review that does not exist
    });

    it("asks the API for a well-formed id, and uses what comes back", async () => {
        const { calls, html } = await open(REVIEW_ID, review());

        expect(calls.filter((url) => url.includes("/reviews/"))).toEqual([expect.stringMatching(new RegExp(`/reviews/${REVIEW_ID}$`))]);
        expect(html).toContain("Song One");
        expect(html).toContain("8.5/10");
    });

    it("still opens, with the generic page, for a review that does not exist", async () => {
        const { res, html } = await open(REVIEW_ID, null);

        expect(res.statusCode).toBe(200);
        expect(html).toContain(GENERIC_TITLE);
    });

    // The names on a review are other people's text, written into HTML attributes.
    it("escapes what a review says before putting it in the page", async () => {
        const { html } = await open(REVIEW_ID, review({ trackName: '"><script>alert(1)</script>', text: "<img src=x onerror=alert(1)>" }));

        expect(html).not.toContain("<script>alert(1)");
        expect(html).not.toContain("<img src=x");
        expect(html).toContain("&lt;script&gt;");
    });

    it("escapes an id that is not an id, in case it is ever echoed", async () => {
        const { html } = await open('"><script>alert(1)</script>', review());

        expect(html).not.toContain("<script>alert(1)");
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [L3] the preview image: GET /api/og/:id
// ─────────────────────────────────────────────────────────────────────────────

describe("[L3] web/api/og.ts, the preview image", () => {
    type Drawn = { element: unknown; options: { width: number; height: number } };

    async function draw(id: string, body: unknown) {
        const calls = mockFetch(body);
        const result = (await ogHandler(new Request(`https://app.test/api/og?id=${encodeURIComponent(id)}`))) as unknown as Drawn;
        return { calls, drawn: JSON.stringify(result.element), result };
    }

    it.each([
        ["no score", undefined],
        ["a null score", null],
    ])("[L3] draws a review with %s instead of failing", async (_label, score) => {
        const { drawn } = await draw(REVIEW_ID, review({ score }));

        expect(drawn).toContain("Song One");
    });

    // The image is rendered by Vercel's server, which fetches the cover from the address stored on the review.
    it.each([
        ["another site", "https://evil.example/cover.png"],
        ["our host over http", "http://i.scdn.co/image/ab67616d0000b273"],
        ["a lookalike that starts with ours", "https://i.scdn.co.evil.example/cover.png"],
        ["a data URL", "data:image/png;base64,AAAA"],
        ["a protocol-relative address", "//evil.example/cover.png"],
        ["an internal address", "http://169.254.169.254/latest/meta-data/"],
    ])("[L3] does not draw a cover from %s", async (_label, albumArt) => {
        const { drawn } = await draw(REVIEW_ID, review({ albumArt }));

        expect(drawn).not.toContain(albumArt);
        expect(drawn).toContain("Song One"); // the card is still drawn, with a placeholder where the cover would be
    });

    it("draws a cover from Spotify's image host", async () => {
        const albumArt = "https://i.scdn.co/image/ab67616d0000b273";

        const { drawn } = await draw(REVIEW_ID, review({ albumArt }));

        expect(drawn).toContain(albumArt);
    });

    it.each(badIds)("[L3] never sends %s to the API", async (_label, id) => {
        const { calls, drawn } = await draw(id, review());

        expect(askedTheApi(calls)).toBe(false);
        expect(drawn).not.toContain("Song One"); // the plain "express" card, as for a review that does not exist
    });

    it("asks the API for a well-formed id", async () => {
        const { calls, drawn } = await draw(REVIEW_ID, review());

        expect(calls.filter((url) => url.includes("/reviews/"))).toEqual([expect.stringMatching(new RegExp(`/reviews/${REVIEW_ID}$`))]);
        expect(drawn).toContain("Song One");
    });

    it("draws the plain card for a review that does not exist", async () => {
        const { drawn } = await draw(REVIEW_ID, null);

        expect(drawn).toContain("express");
        expect(drawn).not.toContain("Song One");
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [L5] leftovers, [L6] no way to inject HTML, [M6] the login callback
// ─────────────────────────────────────────────────────────────────────────────

const repo = path.resolve(__dirname, "../..");

describe("[L5] leftover files", () => {
    // Deleted by the user on 2026-11-06 (plan.md, order of work, step 9).
    it("[L5] backend/set-password.js, a one-off that sets any account's password, does not exist", () => {
        expect(fs.existsSync(path.join(repo, "backend", "set-password.js"))).toBe(false);
    });
});

/** Every source file under a folder, except dependencies and build output. */
function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return ["node_modules", "dist", ".vercel"].includes(entry.name) ? [] : sourceFiles(full);
        return /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [full] : [];
    });
}

describe("[L6] nothing injects HTML into the web app", () => {
    // React escapes text. These are the ways around that; the token in localStorage is only safe while none is used.
    const unsafe: [string, RegExp][] = [
        ["dangerouslySetInnerHTML", /dangerouslySetInnerHTML/],
        ["innerHTML", /\.(inner|outer)HTML\s*=/],
        ["insertAdjacentHTML", /insertAdjacentHTML\s*\(/],
        ["document.write", /document\.write(ln)?\s*\(/],
        ["eval", /\beval\s*\(/],
        ["new Function", /new\s+Function\s*\(/],
    ];

    it.each(unsafe)("%s is not used in web/src or web/api", (_label, pattern) => {
        const used = [...sourceFiles(path.join(repo, "web", "src")), ...sourceFiles(path.join(repo, "web", "api"))]
            .filter((file) => pattern.test(fs.readFileSync(file, "utf8")))
            .map((file) => path.relative(repo, file));

        expect(used).toEqual([]);
    });
});

describe("[M6] the login callback page", () => {
    // Until 2026-11-13 `AuthCallback.tsx` took `access_token` and `spotify_id` from the address and signed the browser in, so a
    // link someone else built could sign a victim into the attacker's account ("login CSRF"). The Spotify link fix replaced
    // the page: it completes a link this tab started and nothing else. What it decides is tested as a pure function in
    // test/unit/spotifyLink.test.ts; this looks at the page itself, so the old behaviour cannot come back unnoticed.
    const source = () => fs.readFileSync(path.join(repo, "web", "src", "pages", "AuthCallback.tsx"), "utf8");

    it("[M6] does not read a session token from the address", () => {
        expect(source()).not.toMatch(/['"]access_token['"]/);
        expect(source()).not.toMatch(/['"]spotify_id['"]/);
    });

    it("[M6] does not sign anyone in", () => {
        expect(source()).not.toMatch(/saveToken|useAuth/);
    });

    it("decides through readLinkCallback, the tested function", () => {
        expect(source()).toMatch(/readLinkCallback\(/);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Security headers: web/vercel.json (plan.md, "Web: what is left", item 3)
// ─────────────────────────────────────────────────────────────────────────────

// `vercel.json` is the only place these headers are set, and Vite's dev server ignores it, so the real check is a Vercel preview
// (the user does it before production). What a test CAN do is stop a later edit from quietly weakening the policy or breaking the
// connection between the cover rule in `web/api/_share.ts` and what the browser may load.
describe("security headers in web/vercel.json", () => {
    const config = JSON.parse(fs.readFileSync(path.join(repo, "web", "vercel.json"), "utf8")) as {
        rewrites: { source: string; destination: string }[];
        headers: { source: string; headers: { key: string; value: string }[] }[];
    };
    const everything = config.headers.find((h) => h.source === "/(.*)");
    const header = (name: string) => everything?.headers.find((h) => h.key.toLowerCase() === name.toLowerCase())?.value;

    /** "default-src 'self'; img-src 'self' https://i.scdn.co" -> { "default-src": ["'self'"], "img-src": ["'self'", "https://i.scdn.co"] } */
    function directives(csp: string) {
        const out: Record<string, string[]> = {};
        for (const part of csp.split(";")) {
            const [name, ...sources] = part.trim().split(/\s+/);
            if (name) out[name] = sources;
        }
        return out;
    }
    const csp = () => directives(header("Content-Security-Policy") ?? "");

    it("sends a Content-Security-Policy on every path", () => {
        expect(everything).toBeDefined();
        expect(header("Content-Security-Policy")).toBeDefined();
    });

    it.each([
        ["default-src", ["'self'"]],
        ["script-src", ["'self'"]],
        ["object-src", ["'none'"]],
        ["base-uri", ["'self'"]],
        ["form-action", ["'self'"]],
        ["frame-ancestors", ["'none'"]],
    ])("%s is exactly %j", (directive, expected) => {
        expect(csp()[directive]).toEqual(expected);
    });

    // The session token is in localStorage, so a script that runs in the page can read it: scripts come from our own origin only.
    it.each(["default-src", "script-src", "style-src", "connect-src", "img-src", "font-src"])("%s allows no wildcard, no scheme-wide source and no inline or eval", (directive) => {
        const sources = csp()[directive] ?? [];

        expect(sources.length).toBeGreaterThan(0);
        for (const source of sources) {
            expect(source).not.toMatch(/^\*$|^https?:$|unsafe-inline|unsafe-eval|unsafe-hashes/);
        }
    });

    // Where the page may send data: our own origin and the API, nothing else, and only over https.
    it("connect-src is our origin plus exact https hosts", () => {
        const [self, ...others] = csp()["connect-src"];

        expect(self).toBe("'self'");
        expect(others.length).toBeGreaterThan(0);
        for (const source of others) expect(source).toMatch(/^https:\/\/[a-z0-9.-]+$/);
    });

    // Images: every source is ours, a data or blob URL, or an exact https host (a leading *. only for Spotify's and Facebook's CDNs).
    // This also means a review's `albumArt` from any other site is not loaded in a viewer's browser (the tracking-pixel half of
    // security.md's "reviews can contain any data").
    it("img-src names only trusted hosts", () => {
        for (const source of csp()["img-src"]) {
            expect(source).toMatch(/^('self'|data:|blob:|https:\/\/(\*\.)?[a-z0-9.-]+)$/);
        }
        expect(csp()["img-src"].filter((s) => s.startsWith("https://*."))).toEqual(["https://*.spotifycdn.com", "https://*.fbcdn.net"]);
    });

    // `safeCover` (web/api/_share.ts) lets the preview image draw covers from i.scdn.co, and the app shows them too.
    it("img-src allows the one host the cover rule allows", () => {
        expect(csp()["img-src"]).toContain("https://i.scdn.co");
    });

    it.each([
        ["X-Frame-Options", "DENY"],
        ["Referrer-Policy", "no-referrer"],
        ["X-Content-Type-Options", "nosniff"],
    ])("%s is %s", (name, value) => {
        expect(header(name)).toBe(value);
    });

    it("denies the camera, the microphone and the location", () => {
        const policy = header("Permissions-Policy") ?? "";

        for (const feature of ["camera", "microphone", "geolocation"]) expect(policy).toContain(`${feature}=()`);
    });

    // The rewrites are what make /r/:id and the preview image work; the headers were added next to them, not instead of them.
    it("still rewrites the share page, its image and the single-page app", () => {
        expect(config.rewrites).toEqual([
            { source: "/api/og/:id", destination: "/api/og?id=:id" },
            { source: "/r/:id", destination: "/api/r?id=:id" },
            { source: "/(.*)", destination: "/index.html" },
        ]);
    });
});
