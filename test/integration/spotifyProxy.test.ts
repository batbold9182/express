import request from "supertest";
import app from "../../backend/app";
import { useMemoryMongo } from "../helpers/mongo";
import { useSpotifyMock } from "../helpers/spotifyMock";
import { makeUser } from "../helpers/fixtures";

// Characterization tests for routes.ts/spotify.ts — the routes that forward a request to Spotify without caching it:
// /search, /me, /me/top/artists, /me/top/tracks and /me/player/currently-playing. Phase E moves the fetch-and-remap
// code in this file into a shared helper; these tests are what says nothing changed.

useMemoryMongo();
const spotify = useSpotifyMock();

const linkedUser = () => makeUser({ spotifyAccessToken: "linked-user-token", spotifyTokenExpiresAt: new Date(Date.now() + 3_600_000) });

describe("every proxy route needs a session token", () => {
    it.each(["/search?q=x", "/me", "/me/top/artists", "/me/top/tracks", "/me/player/currently-playing"])("GET %s", async (path) => {
        const res = await request(app).get(path);
        expect(res.status).toBe(401);
        expect(spotify.calls()).toBe(0);
    });
});

describe("GET /search", () => {
    it("is a 400 without a query", async () => {
        const { auth } = await makeUser();

        const missing = await request(app).get("/search").set(auth);
        const empty = await request(app).get("/search?q=").set(auth);

        expect(missing.status).toBe(400);
        expect(missing.body).toEqual({ error: "Missing q" });
        expect(empty.status).toBe(400);
        expect(spotify.calls()).toBe(0);
    });

    it("searches tracks, albums and artists unless told otherwise, and returns Spotify's JSON", async () => {
        const { auth } = await makeUser();
        spotify.on("/v1/search?q=daft%20punk&type=track,album,artist&limit=10&offset=0", { tracks: { items: [] }, albums: { items: [] }, artists: { items: [] } });

        const res = await request(app).get("/search?q=daft punk").set(auth);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ tracks: { items: [] }, albums: { items: [] }, artists: { items: [] } });
    });

    it("passes ?type= through", async () => {
        const { auth } = await makeUser();
        spotify.on("/v1/search?q=x&type=artist&limit=10&offset=0", { artists: { items: [{ id: "r1" }] } });

        const res = await request(app).get("/search?q=x&type=artist").set(auth);

        expect(res.body).toEqual({ artists: { items: [{ id: "r1" }] } });
    });

    it("encodes the query for Spotify", async () => {
        const { auth } = await makeUser();
        spotify.on("/v1/search?q=AC%2FDC%20%26%20co&type=track,album,artist&limit=10&offset=0", { tracks: { items: [] } });

        const res = await request(app).get(`/search?q=${encodeURIComponent("AC/DC & co")}`).set(auth);

        expect(res.status).toBe(200);
    });

    it("authenticates to Spotify with the app token for an account with no Spotify linked", async () => {
        const { auth } = await makeUser();
        spotify.on("/v1/search?q=x&type=track,album,artist&limit=10&offset=0", {});

        await request(app).get("/search?q=x").set(auth);

        expect(spotify.lastHeaders("/v1/search?q=x&type=track,album,artist&limit=10&offset=0")?.get("authorization")).toBe("Bearer test-app-token");
    });

    it("is not cached — every search goes to Spotify", async () => {
        const { auth } = await makeUser();
        spotify.on("/v1/search?q=x&type=track,album,artist&limit=10&offset=0", {});

        await request(app).get("/search?q=x").set(auth);
        await request(app).get("/search?q=x").set(auth);

        expect(spotify.calls("/v1/search?q=x&type=track,album,artist&limit=10&offset=0")).toBe(2);
    });

    // 401 and 403 become 502: they mean the Spotify token is bad, not the caller's session, and passing a 401 through
    // would log the user out of the web app.
    it.each([
        [401, 502],
        [403, 502],
        [404, 404],
        [429, 429],
        [500, 500],
    ])("answers Spotify's %i with %i and passes Spotify's text along", async (upstreamStatus, ourStatus) => {
        const { auth } = await makeUser();
        spotify.on("/v1/search?q=x&type=track,album,artist&limit=10&offset=0", "text from spotify", upstreamStatus);

        const res = await request(app).get("/search?q=x").set(auth);

        expect(res.status).toBe(ourStatus);
        expect(res.body).toEqual({ error: "text from spotify" });
    });

    it("answers 500 when the request to Spotify throws", async () => {
        const { auth } = await makeUser();
        spotify.fail("/v1/search?q=x&type=track,album,artist&limit=10&offset=0");

        const res = await request(app).get("/search?q=x").set(auth);

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Spotify request failed" });
    });
});

// Plan.md step 2b: /search always sends a clamped page (limit 1-10, default 10; offset 0-1000, default 0), because
// Spotify's own default for search is 5. Search is still not cached and still uses the caller's token (D8, deferred).
describe("GET /search — paging (step 2b)", () => {
    const search = (q: string, type: string, limit: number, offset: number) => `/v1/search?q=${q}&type=${type}&limit=${limit}&offset=${offset}`;

    // [query string added to /search?q=x, limit Spotify must receive, offset Spotify must receive]
    const clamps: [string, number, number][] = [
        ["", 10, 0],
        ["&limit=10&offset=0", 10, 0],
        ["&limit=5", 5, 0],
        ["&limit=0", 1, 0],
        ["&limit=-5", 1, 0],
        ["&limit=11", 10, 0],
        ["&limit=99", 10, 0],
        ["&limit=3.9", 3, 0],
        ["&limit=abc", 10, 0],
        ["&limit=", 10, 0],
        ["&limit=1&limit=2", 10, 0],
        ["&limit[]=3", 10, 0],
        ["&offset=10", 10, 10],
        ["&offset=1000", 10, 1000],
        ["&offset=1001", 10, 1000],
        ["&offset=5000", 10, 1000],
        ["&offset=-5", 10, 0],
        ["&offset=7.9", 10, 7],
        ["&offset=abc", 10, 0],
        ["&offset=", 10, 0],
        ["&offset=3&offset=4", 10, 0],
        ["&limit=4&offset=8", 4, 8],
        ["&limit=999&offset=999999", 10, 1000],
    ];

    it.each(clamps)("/search?q=x%s is sent to Spotify as limit=%i offset=%i", async (query, limit, offset) => {
        const { auth } = await makeUser();
        spotify.on(search("x", "track,album,artist", limit, offset), { tracks: { items: [] } });

        const res = await request(app).get(`/search?q=x${query}`).set(auth);

        expect(res.status).toBe(200);
        expect(spotify.calls(search("x", "track,album,artist", limit, offset))).toBe(1);
        expect(spotify.calls()).toBe(1);
    });

    it("pages one type at a time, the way the web's Show more button asks", async () => {
        const { auth } = await makeUser();
        spotify.on(search("daft%20punk", "track", 10, 10), { tracks: { items: [{ id: "t11" }], total: 26, offset: 10, limit: 10 } });

        const res = await request(app).get("/search?q=daft punk&type=track&offset=10&limit=10").set(auth);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ tracks: { items: [{ id: "t11" }], total: 26, offset: 10, limit: 10 } });
    });

    it("keeps the query encoded when it pages", async () => {
        const { auth } = await makeUser();
        spotify.on(search("AC%2FDC%20%26%20co", "album", 10, 20), { albums: { items: [] } });

        const res = await request(app).get(`/search?q=${encodeURIComponent("AC/DC & co")}&type=album&offset=20`).set(auth);

        expect(res.status).toBe(200);
    });

    it("cannot be given a second parameter through limit or offset", async () => {
        const { auth } = await makeUser();
        spotify.on(search("x", "track,album,artist", 10, 0), { tracks: { items: [] } });

        const res = await request(app).get("/search?q=x&limit=5%26type%3Dplaylist&offset=1%26market%3DXX").set(auth);

        expect(res.status).toBe(200);
        const [sent] = spotify.paths();
        const params = new URL(sent, "https://spotify.test").searchParams;
        expect([...params.keys()].sort()).toEqual(["limit", "offset", "q", "type"]);
    });

    it("still refuses a missing query or a bad type before any paging, and sends nothing", async () => {
        const { auth } = await makeUser();
        spotify.fallback({ tracks: { items: [] } });

        const noQuery = await request(app).get("/search?offset=10").set(auth);
        const badType = await request(app).get("/search?q=x&type=playlist&offset=10").set(auth);

        expect(noQuery.status).toBe(400);
        expect(badType.status).toBe(400);
        expect(spotify.calls()).toBe(0);
    });

    it("is not cached at any page — each request goes to Spotify", async () => {
        const { auth } = await makeUser();
        spotify.on(search("x", "track", 10, 10), { tracks: { items: [] } });

        await request(app).get("/search?q=x&type=track&offset=10").set(auth);
        await request(app).get("/search?q=x&type=track&offset=10").set(auth);

        expect(spotify.calls(search("x", "track", 10, 10))).toBe(2);
    });

    // A decision, not a goal: the user kept today's token for /search for now (plan.md D8 asks for the app token only,
    // together with the bounded cache). When D8 lands this flips to "Bearer test-app-token".
    it("uses the caller's own Spotify token when one is linked (D8 not applied yet)", async () => {
        const { auth } = await linkedUser();
        spotify.on(search("x", "track,album,artist", 10, 0), {});

        await request(app).get("/search?q=x").set(auth);

        expect(spotify.lastHeaders(search("x", "track,album,artist", 10, 0))?.get("authorization")).toBe("Bearer linked-user-token");
    });

    it("passes Spotify's 429 on when a later page is refused", async () => {
        const { auth } = await makeUser();
        spotify.on(search("x", "track", 10, 10), "slow down", 429);

        const res = await request(app).get("/search?q=x&type=track&offset=10").set(auth);

        expect(res.status).toBe(429);
        expect(res.body).toEqual({ error: "slow down" });
    });
});

describe("GET /me (the user's Spotify profile)", () => {
    it("is a 502 for an account with no Spotify linked — the web reads that as 'not connected'", async () => {
        const { auth } = await makeUser();

        const res = await request(app).get("/me").set(auth);

        expect(res.status).toBe(502);
        expect(res.body).toEqual({ error: "Spotify not linked" });
        expect(spotify.calls()).toBe(0);
    });

    it("returns the profile, using the user's own Spotify token", async () => {
        const { auth } = await linkedUser();
        spotify.on("/v1/me", { id: "spotify-user", display_name: "Linked" });

        const res = await request(app).get("/me").set(auth);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ id: "spotify-user", display_name: "Linked" });
        expect(spotify.lastHeaders("/v1/me")?.get("authorization")).toBe("Bearer linked-user-token");
    });

    it("remaps Spotify's 401 to 502", async () => {
        const { auth } = await linkedUser();
        spotify.on("/v1/me", "token expired", 401);

        const res = await request(app).get("/me").set(auth);

        expect(res.status).toBe(502);
        expect(res.body).toEqual({ error: "token expired" });
    });
});

describe.each([
    { route: "/me/top/artists", upstream: (range: string) => `/v1/me/top/artists?limit=5&time_range=${range}` },
    { route: "/me/top/tracks",  upstream: (range: string) => `/v1/me/top/tracks?limit=10&time_range=${range}` },
])("GET $route", ({ route, upstream }) => {
    it("is an empty list, not an error, for an account with no Spotify linked", async () => {
        const { auth } = await makeUser();

        const res = await request(app).get(route).set(auth);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ items: [] });
        expect(spotify.calls()).toBe(0);
    });

    it("asks Spotify for the medium term by default", async () => {
        const { auth } = await linkedUser();
        spotify.on(upstream("medium_term"), { items: [{ id: "x" }] });

        const res = await request(app).get(route).set(auth);

        expect(res.body).toEqual({ items: [{ id: "x" }] });
        expect(spotify.lastHeaders(upstream("medium_term"))?.get("authorization")).toBe("Bearer linked-user-token");
    });

    it("passes ?time_range= through", async () => {
        const { auth } = await linkedUser();
        spotify.on(upstream("short_term"), { items: [] });

        const res = await request(app).get(`${route}?time_range=short_term`).set(auth);

        expect(res.status).toBe(200);
        expect(spotify.calls(upstream("short_term"))).toBe(1);
    });

    it("remaps Spotify's 403 to 502", async () => {
        const { auth } = await linkedUser();
        spotify.on(upstream("medium_term"), "forbidden", 403);

        const res = await request(app).get(route).set(auth);

        expect(res.status).toBe(502);
    });
});

describe("GET /me/player/currently-playing", () => {
    const path = "/v1/me/player/currently-playing";

    it("is null for an account with no Spotify linked", async () => {
        const { auth } = await makeUser();

        const res = await request(app).get("/me/player/currently-playing").set(auth);

        expect(res.status).toBe(200);
        expect(res.body).toBeNull();
        expect(spotify.calls()).toBe(0);
    });

    it("returns what is playing", async () => {
        const { auth } = await linkedUser();
        spotify.on(path, { is_playing: true, item: { id: "t1", name: "Song" } });

        const res = await request(app).get("/me/player/currently-playing").set(auth);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ is_playing: true, item: { id: "t1", name: "Song" } });
    });

    // Spotify answers 204 when nothing is playing; 404 when there is no active device. Both mean "nothing playing".
    it.each([204, 404])("is null when Spotify answers %i", async (status) => {
        const { auth } = await linkedUser();
        spotify.on(path, undefined, status);

        const res = await request(app).get("/me/player/currently-playing").set(auth);

        expect(res.status).toBe(200);
        expect(res.body).toBeNull();
    });

    // CURRENT BEHAVIOUR: unlike the other proxy routes this one does not remap errors — an error body from Spotify is
    // returned as a plain 200, and the web's `playableTrack` treats it as "nothing playing". Pinned so the Phase E
    // refactor does not change it by accident.
    it("returns a Spotify error body with status 200, not a remapped error (current behaviour)", async () => {
        const { auth } = await linkedUser();
        spotify.on(path, { error: { status: 401, message: "The access token expired" } }, 401);

        const res = await request(app).get("/me/player/currently-playing").set(auth);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ error: { status: 401, message: "The access token expired" } });
    });

    it("answers 500 when the request to Spotify throws", async () => {
        const { auth } = await linkedUser();
        spotify.fail(path);

        const res = await request(app).get("/me/player/currently-playing").set(auth);

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Spotify request failed" });
    });
});
