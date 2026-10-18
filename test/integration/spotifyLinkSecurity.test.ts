import request from "supertest";
import app from "../../backend/app";
import { User } from "../../backend/models/User";
import { useMemoryMongo } from "../helpers/mongo";
import { useSpotifyMock } from "../helpers/spotifyMock";
import { useEnv } from "../helpers/env";
import { useClock } from "../helpers/clock";
import { makeUser, uniqueId } from "../helpers/fixtures";

// The Spotify link flow, as plan.md ("Security: the Spotify link flow trusts a public id") says it must work. Step 3 of
// the order of work: these tests describe the TARGET design. Each is `it.failing`: it passes while the new endpoints do
// not exist (and while the old holes are open) and goes red the day the fix lands, which is the signal for
// `express-backend` to delete the `.failing` markers. A test that is still red after that has found a mismatch.
//
// The rule being tested: the link is completed by a request that carries the session of the account being linked, never
// by the bare callback.
//
//   POST /auth/spotify/link            signed in, `Origin` on the allowlist  -> 200 { url }   (Spotify's authorize URL,
//                                       state = a random single-use nonce, show_dialog=true, no user-read-email scope)
//   GET  /auth/callback                a relay: touches no account, exchanges nothing, 302 to <stored origin>/auth/callback
//                                       with code, state and error; Referrer-Policy: no-referrer
//   POST /auth/spotify/link/complete   signed in, { code, state }: the nonce must be unexpired, unused and belong to the
//                                       caller; then (and only then) the code is exchanged -> 200; any refusal -> 400
//   GET  /auth/login                   gone (404), together with the fresh-login branch of the callback
//
// Contract choices these tests make (change them here, and in plan.md, if the backend design changes): the start
// response is `{ url }`; a refused `Origin` is a 400 or a 403; every refusal by `complete` is a 400 (one status for
// "unknown", "expired", "used" and "not yours", so it cannot be used to probe which nonces exist). The allowlist is the
// comma-separated `FRONTEND_WEB_BASE`, exact origins only.
//
// Everything runs against the real app with Spotify mocked. Attackers send no Authorization header unless the test says so.

useMemoryMongo();
const spotify = useSpotifyMock();
const env = useEnv();

const WEB = "https://tunelog.test";
const WEB_2 = "https://www.tunelog.test";
const API_CALLBACK = "https://api.tunelog.test/auth/callback";
const ALLOWED = [WEB, WEB_2];

const TOKENS = { access_token: "spotify-access-token", refresh_token: "spotify-refresh-token", expires_in: 3600 };
const profileOf = (id: string) => ({ id, display_name: "Someone", images: [] }); // no email: that scope is dropped
const ATTACKER = { id: "attacker-spotify-id", display_name: "Attacker", email: "attacker@evil.test", images: [] };

beforeEach(() => {
    env.set("CLIENT_ID", "test-client-id");
    env.set("CLIENT_SECRET", "test-client-secret");
    env.set("REDIRECT_URI", API_CALLBACK);
    env.set("FRONTEND_WEB_BASE", ALLOWED.join(","));
});

// A nonce can be made to look old without waiting ten minutes: `skipAhead` moves only `Date` (test/helpers/clock.ts).
const { skipAhead } = useClock();

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────────

type Auth = Record<string, string>;

/** Starts a link for the signed-in user and returns Spotify's authorize URL and the nonce in it. */
async function startLink(auth: Auth, origin: string = WEB) {
    const res = await request(app).post("/auth/spotify/link").set(auth).set("Origin", origin);
    expect(res.status).toBe(200);
    expect(typeof res.body.url).toBe("string");
    const url = new URL(res.body.url);
    return { res, url, state: url.searchParams.get("state") ?? "" };
}

const complete = (auth: Auth, body: unknown) => request(app).post("/auth/spotify/link/complete").set(auth).send(body as object);
const relay = (query: string) => request(app).get(`/auth/callback${query}`);
const exchanges = () => spotify.tokenRequests().filter((b) => b.grant_type === "authorization_code");
const stateOf = (payload: object) => encodeURIComponent(Buffer.from(JSON.stringify(payload)).toString("base64"));

/** What the OLD callback does when Spotify says the person who just authorised is `profile`. No session, no cookies. */
const oldStyleCallback = (query: string, profile: object) => {
    spotify.on("/v1/me", profile);
    return request(app).get(`/auth/callback?code=${uniqueId("code")}${query}`);
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Start: POST /auth/spotify/link
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe("POST /auth/spotify/link (starting a link)", () => {
    it.failing("needs a session", async () => {
        const res = await request(app).post("/auth/spotify/link").set("Origin", WEB);

        expect(res.status).toBe(401);
    });

    it.failing("returns Spotify's authorize URL: this app's client, the backend callback, a chosen account, no email scope", async () => {
        const { auth } = await makeUser();

        const { url } = await startLink(auth);

        expect(`${url.origin}${url.pathname}`).toBe("https://accounts.spotify.com/authorize");
        expect(url.searchParams.get("client_id")).toBe("test-client-id");
        expect(url.searchParams.get("response_type")).toBe("code");
        expect(url.searchParams.get("redirect_uri")).toBe(API_CALLBACK);
        expect(url.searchParams.get("show_dialog")).toBe("true"); // the person picks the Spotify account on purpose
        const scopes = (url.searchParams.get("scope") ?? "").split(" ");
        expect(scopes).not.toContain("user-read-email"); // nothing needs it once the login branch is gone
        expect(scopes).toContain("user-top-read");
        expect(scopes).toContain("user-read-currently-playing");
    });

    it.failing("uses a random, URL-safe nonce as `state`, never anything that names the account", async () => {
        const { user, auth } = await makeUser();

        const { state } = await startLink(auth);

        expect(state).toMatch(/^[A-Za-z0-9_-]{32,}$/); // 32 random bytes is 43 characters of base64url, 64 of hex
        expect(state).not.toContain(user.spotifyId as string);
        expect(state).not.toContain(String(user._id));
        expect(Buffer.from(state, "base64").toString("utf8")).not.toContain("{"); // not the old base64 JSON
    });

    it.failing("gives a new nonce every time, to everyone", async () => {
        const a = await makeUser();
        const b = await makeUser();

        const states = [(await startLink(a.auth)).state, (await startLink(a.auth)).state, (await startLink(b.auth)).state];

        expect(new Set(states).size).toBe(3);
    });

    // Where the nonce sends the browser afterwards is the Origin of this request, so it must be one of ours. Exact
    // origins only: a wildcard such as *.vercel.app would let any attacker-owned Vercel app be the target.
    describe("the Origin allowlist (FRONTEND_WEB_BASE)", () => {
        const refused: [string, string | null][] = [
            ["no Origin header at all", null],
            ["another site", "https://evil.example"],
            ["the right host over http", "http://tunelog.test"],
            ["a lookalike that starts with ours", "https://tunelog.test.evil.example"],
            ["our host on another port", "https://tunelog.test:8443"],
            ["a subdomain nobody listed", "https://sub.tunelog.test"],
            ["a Vercel preview deploy", "https://tunelog-git-branch-someone.vercel.app"],
            ["localhost", "http://localhost:5173"],
            ["the string null (a sandboxed page)", "null"],
        ];

        it.failing.each(refused)("refuses %s, and returns no URL", async (_label, origin) => {
            const { auth } = await makeUser();
            const req = request(app).post("/auth/spotify/link").set(auth);
            const res = await (origin === null ? req : req.set("Origin", origin));

            expect([400, 403]).toContain(res.status);
            expect(res.body.url).toBeUndefined();
        });

        it.failing.each(ALLOWED)("accepts the listed origin %s", async (origin) => {
            const { auth } = await makeUser();

            const { res } = await startLink(auth, origin);

            expect(res.status).toBe(200);
        });

        it.failing("refuses everything when no origin is configured, rather than trusting the request", async () => {
            env.set("FRONTEND_WEB_BASE", undefined);
            const { auth } = await makeUser();

            const res = await request(app).post("/auth/spotify/link").set(auth).set("Origin", WEB);

            expect([400, 403, 500, 503]).toContain(res.status);
            expect(res.body.url).toBeUndefined();
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The callback is a relay: GET /auth/callback
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe("GET /auth/callback (a relay that touches no account)", () => {
    it.failing("sends the browser on to the origin stored with the nonce, carrying code and state", async () => {
        const { auth } = await makeUser();
        const { state } = await startLink(auth, WEB_2);

        const res = await relay(`?code=the-code&state=${state}`);

        expect(res.status).toBe(302);
        const target = new URL(res.headers.location);
        expect(target.origin).toBe(WEB_2);
        expect(target.pathname).toBe("/auth/callback");
        expect(target.searchParams.get("code")).toBe("the-code");
        expect(target.searchParams.get("state")).toBe(state);
    });

    it.failing("passes Spotify's error on, so a refusal reaches the page", async () => {
        const { auth } = await makeUser();
        const { state } = await startLink(auth);

        const res = await relay(`?error=access_denied&state=${state}`);

        expect(res.status).toBe(302);
        const target = new URL(res.headers.location);
        expect(target.origin).toBe(WEB);
        expect(target.searchParams.get("error")).toBe("access_denied");
        expect(target.searchParams.get("state")).toBe(state);
    });

    it.failing("changes no account and exchanges nothing, even for a valid nonce", async () => {
        const { user, auth } = await makeUser();
        const { state } = await startLink(auth);
        spotify.tokenReply(200, TOKENS);
        spotify.on("/v1/me", profileOf("someone-spotify-id"));

        await relay(`?code=the-code&state=${state}`);

        expect(exchanges()).toHaveLength(0);
        expect(spotify.calls("/v1/me")).toBe(0);
        const after = await User.findById(user._id);
        expect(after?.realSpotifyId).toBeUndefined();
    });

    it.failing("sets Referrer-Policy: no-referrer, so the code does not travel on in a Referer header", async () => {
        const { auth } = await makeUser();
        const { state } = await startLink(auth);

        const res = await relay(`?code=the-code&state=${state}`);

        expect(res.headers["referrer-policy"]).toBe("no-referrer");
    });

    // The target is what was stored when the nonce was made — nothing in the callback request can change it.
    it.failing("takes the target from the stored origin only, whatever else the request says", async () => {
        const { auth } = await makeUser();
        const { state } = await startLink(auth);

        const res = await relay(
            `?code=the-code&state=${state}&redirect=${encodeURIComponent("https://evil.example/collect")}&origin=https://evil.example&next=https://evil.example`,
        )
            .set("Origin", "https://evil.example")
            .set("Referer", "https://evil.example/page")
            .set("X-Forwarded-Host", "evil.example");

        expect(res.status).toBe(302);
        expect(new URL(res.headers.location).origin).toBe(WEB);
    });

    // State from before the deploy (base64 JSON), attacker input, or a nonce that never existed: a fixed, safe answer.
    describe("an unknown or hostile state", () => {
        const hostile: [string, string][] = [
            ["the old base64 JSON, with a redirect to the attacker", stateOf({ redirect: "https://evil.example/collect" })],
            ["the old base64 JSON, naming a victim to link", stateOf({ linkId: "someones-handle" })],
            ["a plain URL, the old mobile format", encodeURIComponent(Buffer.from("https://evil.example/auth/success").toString("base64"))],
            ["a nonce that was never issued", "A".repeat(43)],
            ["no state at all", ""],
        ];

        it.failing.each(hostile)("%s: goes nowhere the request names, and carries no session token", async (_label, state) => {
            spotify.on("/v1/me", ATTACKER);
            const res = await request(app).get(`/auth/callback?code=${uniqueId("code")}${state ? `&state=${state}` : ""}`);

            const location = res.headers.location ?? "";
            const safe = res.status === 400 || ALLOWED.some((origin) => location.startsWith(`${origin}/`));
            expect(safe).toBe(true);
            expect(location).not.toContain("evil.example");
            expect(location).not.toContain("access_token=");
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The old entry points, and what the original report showed
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe("the unauthenticated entry points are gone", () => {
    it.failing.each(["/auth/login", "/auth/login?redirect=https://evil.example/auth/success", "/auth/login?linkId=someones-handle"])(
        "GET %s no longer exists",
        async (path) => {
            const res = await request(app).get(path);

            expect(res.status).toBe(404);
        },
    );

    // 1. The report's first attack. The victim's spotifyId is public: it is in profile URLs and in every review's author block.
    it.failing("a callback naming a victim's handle does not attach the visitor's Spotify identity to that account", async () => {
        const victim = await makeUser();

        await oldStyleCallback(`&state=${stateOf({ linkId: victim.user.spotifyId })}`, ATTACKER);

        const after = await User.findById(victim.user._id);
        expect(after?.realSpotifyId).toBeUndefined();
    });

    // The legacy mobile path: the victim's session token in `state`.
    it.failing("a callback carrying a victim's session token in `state` does not link either", async () => {
        const victim = await makeUser();

        await oldStyleCallback(`&state=${stateOf({ linkToken: victim.token })}`, ATTACKER);

        const after = await User.findById(victim.user._id);
        expect(after?.realSpotifyId).toBeUndefined();
    });

    // 5. The same hole pointed the other way: the attacker starts a link for THEIR account and hands the Spotify address to
    // the victim. Their Spotify identity must not end up on the attacker's account just because the victim approved it.
    it.failing("a callback cannot attach a victim's Spotify identity to the attacker's account", async () => {
        const attacker = await makeUser();
        const victimsSpotify = { id: "victim-spotify-id", display_name: "Victim", email: "victim@spotify.test", images: [] };

        await oldStyleCallback(`&state=${stateOf({ linkId: attacker.user.spotifyId })}`, victimsSpotify);

        const after = await User.findById(attacker.user._id);
        expect(after?.realSpotifyId).toBeUndefined();
    });

    // 2 and 4. Signing in with Spotify is not a way in any more: a callback never makes an account or mints a session.
    it.failing("a callback with no state is not a login: no account is made and no session token is issued", async () => {
        const before = await User.countDocuments();

        const res = await oldStyleCallback("", ATTACKER);

        expect(res.headers.location ?? "").not.toContain("access_token=");
        expect(await User.countDocuments()).toBe(before);
    });

    it.failing("cannot be chained into a login as the victim", async () => {
        const victim = await makeUser();
        await oldStyleCallback(`&state=${stateOf({ linkId: victim.user.spotifyId })}`, ATTACKER);

        const login = await oldStyleCallback("", ATTACKER);

        expect(login.headers.location ?? "").not.toContain(`spotify_id=${victim.user.spotifyId}`);
        const after = await User.findById(victim.user._id);
        const stillIn = await request(app).get("/users/me").set(victim.auth);
        expect(stillIn.status).toBe(200); // the victim's own session is untouched
    });

    // 3. The open redirect: a victim who approves a crafted link has their fresh session token sent to the attacker.
    it.failing("a redirect in `state` is not followed", async () => {
        const victim = await makeUser();
        const victimsSpotifyProfile = { id: "victim-spotify-id", display_name: "Victim", email: victim.user.email, images: [] };

        const res = await oldStyleCallback(`&state=${stateOf({ redirect: "https://evil.example/collect" })}`, victimsSpotifyProfile);

        expect(res.headers.location ?? "").not.toMatch(/^https:\/\/evil\.example/);
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Linking happens here: POST /auth/spotify/link/complete
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe("POST /auth/spotify/link/complete (the authenticated half)", () => {
    const farFuture = () => new Date(Date.now() + 3_600_000);

    it.failing("needs a session", async () => {
        const res = await request(app).post("/auth/spotify/link/complete").send({ code: "c", state: "s" });

        expect(res.status).toBe(401);
        expect(exchanges()).toHaveLength(0);
    });

    describe("links the account of the caller", () => {
        it.failing("stores the Spotify identity and tokens on the caller, and nothing else about the account", async () => {
            const { user, auth } = await makeUser();
            const { state } = await startLink(auth);
            spotify.tokenReply(200, TOKENS);
            spotify.on("/v1/me", profileOf("linked-spotify-id"));

            const res = await complete(auth, { code: "the-code", state });

            expect(res.status).toBe(200);
            const after = await User.findById(user._id);
            expect(after?.realSpotifyId).toBe("linked-spotify-id");
            expect(after?.spotifyAccessToken).toBe("spotify-access-token");
            expect(after?.refreshToken).toBe("spotify-refresh-token");
            expect(after?.spotifyId).toBe(user.spotifyId); // the public handle never changes
            expect((await request(app).get("/users/me").set(auth)).status).toBe(200); // the session is the one the browser already holds
            expect(JSON.stringify(res.body)).not.toContain("spotify-access-token"); // no Spotify token comes back to the page
        });

        it.failing("exchanges the code with the same redirect_uri the authorize request used (the backend callback)", async () => {
            const { auth } = await makeUser();
            const { url, state } = await startLink(auth);
            spotify.tokenReply(200, TOKENS);
            spotify.on("/v1/me", profileOf("linked-spotify-id"));

            await complete(auth, { code: "the-code", state });

            expect(exchanges()).toHaveLength(1);
            expect(exchanges()[0]).toMatchObject({ code: "the-code", redirect_uri: url.searchParams.get("redirect_uri"), client_id: "test-client-id" });
            expect(exchanges()[0].redirect_uri).toBe(API_CALLBACK);
        });

        it.failing("works from the very beginning: start, relay, then complete with what the relay passed on", async () => {
            const { user, auth } = await makeUser();
            const { state } = await startLink(auth);
            spotify.tokenReply(200, TOKENS);
            spotify.on("/v1/me", profileOf("linked-spotify-id"));

            const relayed = await relay(`?code=the-code&state=${state}`);
            const target = new URL(relayed.headers.location);
            const res = await complete(auth, { code: target.searchParams.get("code"), state: target.searchParams.get("state") });

            expect(res.status).toBe(200);
            expect((await User.findById(user._id))?.realSpotifyId).toBe("linked-spotify-id");
        });

        // The person who linked before loses the link, and their cached copy must stop saying "connected" at once
        // (the auth middleware hands out the same object for 4 minutes).
        it.failing("releases the previous owner of that Spotify identity, and their cached session sees it immediately", async () => {
            const previous = await makeUser({ realSpotifyId: "shared-spotify-id", spotifyAccessToken: "old-token", spotifyTokenExpiresAt: farFuture(), refreshToken: "old-refresh" });
            const warm = await request(app).get("/users/me").set(previous.auth); // puts the previous owner in the cache
            expect(warm.body.spotifyLinked).toBe(true);

            const { auth } = await makeUser();
            const { state } = await startLink(auth);
            spotify.tokenReply(200, TOKENS);
            spotify.on("/v1/me", profileOf("shared-spotify-id"));
            const res = await complete(auth, { code: "the-code", state });

            expect(res.status).toBe(200);
            expect((await User.findById(previous.user._id))?.realSpotifyId).toBeUndefined();
            const now = await request(app).get("/users/me").set(previous.auth);
            expect(now.body.spotifyLinked).toBe(false);
        });
    });

    // Every refusal is a 400 and, above all, happens BEFORE the code is exchanged or any Spotify call is made.
    describe("refuses", () => {
        const noSpotifyCall = () => {
            expect(exchanges()).toHaveLength(0);
            expect(spotify.calls("/v1/me")).toBe(0);
        };

        it.failing("a nonce that was never issued", async () => {
            const { user, auth } = await makeUser();
            spotify.tokenReply(200, TOKENS);
            spotify.on("/v1/me", profileOf("linked-spotify-id"));

            const res = await complete(auth, { code: "the-code", state: "A".repeat(43) });

            expect(res.status).toBe(400);
            noSpotifyCall();
            expect((await User.findById(user._id))?.realSpotifyId).toBeUndefined();
        });

        // The link someone else hands you: the attacker starts a link for their own account and gives the Spotify address to
        // the victim. The victim is signed in, but the nonce belongs to the attacker, so completing it must fail.
        it.failing("a nonce that belongs to another user (the link handed to a victim)", async () => {
            const attacker = await makeUser();
            const victim = await makeUser();
            const { state } = await startLink(attacker.auth);
            spotify.tokenReply(200, TOKENS);
            spotify.on("/v1/me", profileOf("victim-spotify-id"));

            const res = await complete(victim.auth, { code: "the-victims-code", state });

            expect(res.status).toBe(400);
            noSpotifyCall();
            expect((await User.findById(attacker.user._id))?.realSpotifyId).toBeUndefined();
            expect((await User.findById(victim.user._id))?.realSpotifyId).toBeUndefined();
        });

        it.failing("a nonce that has expired (ten minutes)", async () => {
            const { user, auth } = await makeUser();
            const { state } = await startLink(auth);
            spotify.tokenReply(200, TOKENS);
            spotify.on("/v1/me", profileOf("linked-spotify-id"));

            skipAhead(11 * 60_000);
            const res = await complete(auth, { code: "the-code", state });
            jest.useRealTimers();

            expect(res.status).toBe(400);
            noSpotifyCall();
            expect((await User.findById(user._id))?.realSpotifyId).toBeUndefined();
        });

        it.failing("a nonce that was already used", async () => {
            const { auth } = await makeUser();
            const { state } = await startLink(auth);
            spotify.tokenReply(200, TOKENS);
            spotify.on("/v1/me", profileOf("linked-spotify-id"));
            const first = await complete(auth, { code: "the-code", state });

            const second = await complete(auth, { code: "another-code", state });

            expect(first.status).toBe(200);
            expect(second.status).toBe(400);
            expect(exchanges()).toHaveLength(1);
        });

        // The nonce is consumed atomically (a delete that matches it), not "read, then delete", so two requests racing
        // for it cannot both succeed.
        it.failing("the second of two simultaneous requests with the same nonce", async () => {
            const { auth } = await makeUser();
            const { state } = await startLink(auth);
            spotify.tokenReply(200, TOKENS);
            spotify.on("/v1/me", profileOf("linked-spotify-id"));

            const results = await Promise.all([complete(auth, { code: "code-a", state }), complete(auth, { code: "code-b", state })]);

            expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
            expect(exchanges()).toHaveLength(1);
        });

        const badBodies: [string, unknown][] = [
            ["an empty body", {}],
            ["a missing state", { code: "the-code" }],
            ["a missing code", { state: "A".repeat(43) }],
            ["a number as the code", { code: 123, state: "A".repeat(43) }],
            ["an array as the code", { code: ["the-code"], state: "A".repeat(43) }],
            ["an operator object as the state", { code: "the-code", state: { $ne: null } }],
            ["an array as the state", { code: "the-code", state: ["A".repeat(43)] }],
            ["empty strings", { code: "", state: "" }],
        ];

        it.failing.each(badBodies)("%s, before any lookup", async (_label, body) => {
            const { auth } = await makeUser();
            spotify.tokenReply(200, TOKENS);
            spotify.on("/v1/me", profileOf("linked-spotify-id"));

            const res = await complete(auth, body);

            expect(res.status).toBe(400);
            noSpotifyCall();
        });

        it.failing("a code Spotify refuses: nothing is linked", async () => {
            const { user, auth } = await makeUser();
            const { state } = await startLink(auth);
            spotify.tokenReply(400, { error: "invalid_grant" });

            const res = await complete(auth, { code: "a-stale-code", state });

            expect([400, 502]).toContain(res.status);
            expect((await User.findById(user._id))?.realSpotifyId).toBeUndefined();
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The helper the expiry test relies on
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe("the test clock", () => {
    // Not a security test: it proves `skipAhead` moves `Date` and nothing else, so the app and its database still work.
    it("skipAhead moves the clock forward and the app keeps working", async () => {
        const { auth } = await makeUser();
        const before = Date.now();

        skipAhead(11 * 60_000);
        const res = await request(app).get("/users/me").set(auth);
        const after = Date.now();
        jest.useRealTimers();

        expect(res.status).toBe(200);
        expect(after - before).toBeGreaterThanOrEqual(11 * 60_000);
    });
});
