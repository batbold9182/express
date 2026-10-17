import request from "supertest";
import app from "../../backend/app";
import { useMemoryMongo } from "../helpers/mongo";
import { useSpotifyMock } from "../helpers/spotifyMock";
import { makeUser, spotifyId } from "../helpers/fixtures";

// Security tests, Step 2: what the routes do with the Spotify ids and parameters a caller sends. See plan.md ->
// "Security tests". Each test states the SECURE behaviour. These were written as `it.failing` while the holes were
// open; the fix was applied on 2026-10-17 (plan.md, step 2) and the markers were removed, so every test here is now
// a plain, permanent guard. (A new hole is recorded the same way: write the test as `it.failing`, and remove the
// marker when it is fixed.)
//
//   [H5]  A Spotify id goes into the Spotify URL unvalidated, so an encoded `../me` reaches other Spotify endpoints
//         with the caller's own token, and the answer is cached for everyone for 24 hours.
//   [M2]  `time_range`, `type` and `group` go into the Spotify URL unvalidated.

useMemoryMongo();
const spotify = useSpotifyMock();

const inAnHour = () => new Date(Date.now() + 3_600_000);

// ─────────────────────────────────────────────────────────────────────────────
// [H5] the id in the path
// ─────────────────────────────────────────────────────────────────────────────

// The routes that fetch one Spotify resource and cache it for everyone.
const routes = [
    { name: "GET /tracks/:id",        path: (id: string) => `/tracks/${id}`,        upstream: (id: string) => `/v1/tracks/${id}` },
    { name: "GET /albums/:id",        path: (id: string) => `/albums/${id}`,        upstream: (id: string) => `/v1/albums/${id}` },
    { name: "GET /albums/:id/tracks", path: (id: string) => `/albums/${id}/tracks`, upstream: (id: string) => `/v1/albums/${id}/tracks?limit=50` },
    { name: "GET /artists/:id",       path: (id: string) => `/artists/${id}`,       upstream: (id: string) => `/v1/artists/${id}` },
    { name: "GET /artists/:id/albums", path: (id: string) => `/artists/${id}/albums`, upstream: (id: string) => `/v1/artists/${id}/albums?include_groups=album&market=US&limit=10&offset=0` },
];

// What a caller can put where a Spotify id belongs (as it appears in the URL). A real id is 22 letters and digits.
const malformedIds: [string, string][] = [
    ["an encoded ../ that climbs to /me", "..%2Fme"],
    ["a double-encoded traversal", "%252e%252e%252fme"],
    ["too short", "abc"],
    ["23 characters", "a".repeat(23)],
    ["a space", "has%20a%20space"],
    ["a query string", "abc%3Fx%3D1"],
];

describe.each(routes)("$name", ({ path, upstream }) => {
    malformedIds.forEach(([label, bad]) => {
        it(`[H5] refuses an id that is ${label}, and sends nothing to Spotify`, async () => {
            const { auth } = await makeUser();
            spotify.fallback({ leaked: "this should never have been requested" });

            const res = await request(app).get(path(bad)).set(auth);

            expect(res.status).toBe(400);
            expect(spotify.calls()).toBe(0);
        });
    });

    it("[H5] still serves a well-formed 22-character id", async () => {
        const { auth } = await makeUser();
        const id = spotifyId();
        spotify.on(upstream(id), { id, name: "Thing" });

        const res = await request(app).get(path(id)).set(auth);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ id, name: "Thing" });
    });

    // The answer goes into a cache shared by every user. A personal token can make it personal (a market, a
    // restriction), so shared catalogue data is fetched with the app token only. NB: this deliberately contradicts the
    // pinned "uses the caller's own Spotify token when linked" in spotifyMetadata.test.ts — when this goes green,
    // flip that one.
    it("[H5] never uses a linked user's own Spotify token for data that goes into the shared cache", async () => {
        const { auth } = await makeUser({ spotifyAccessToken: "private-user-token", spotifyTokenExpiresAt: inAnHour() });
        const id = spotifyId();
        spotify.on(upstream(id), { id });

        await request(app).get(path(id)).set(auth);

        expect(spotify.lastHeaders(upstream(id))?.get("authorization")).toBe("Bearer test-app-token");
    });
});

describe("[H5] one user's private Spotify data and another user", () => {
    // `/albums/..%2Fme%2Ftop%2Fartists` becomes `/v1/me/top/artists`, fetched with the caller's personal token and cached
    // under one key for 24 hours. (A path no other test in this file requests: the server's cache is module-level and
    // has no reset, so an id used earlier would already be cached with someone else's answer.)
    it("never reaches the other user through an id that climbs to /me/top/artists", async () => {
        const a = await makeUser({ spotifyAccessToken: "A-private-token", spotifyTokenExpiresAt: inAnHour() });
        const b = await makeUser();
        spotify.on("/v1/me/top/artists", { items: [{ id: "A-private-artist", name: "a-private@example.com" }] });

        const ra = await request(app).get("/albums/..%2Fme%2Ftop%2Fartists").set(a.auth);
        const rb = await request(app).get("/albums/..%2Fme%2Ftop%2Fartists").set(b.auth);

        expect(JSON.stringify(ra.body)).not.toContain("a-private@example.com");
        expect(JSON.stringify(rb.body)).not.toContain("a-private@example.com");
    });
});

describe("[H5] Spotify ids in a review's body", () => {
    // They are stored and later turned into links, so they get the same check.
    const review = (over: Record<string, unknown>) => ({ type: "track", trackName: "Song", artistName: "Artist", score: 5, ...over });

    it("accepts well-formed ids", async () => {
        const { auth } = await makeUser();

        const res = await request(app).post("/reviews").set(auth).send(review({ spotifyTrackId: spotifyId(), spotifyAlbumId: spotifyId(), spotifyArtistId: spotifyId() }));

        expect(res.status).toBe(201);
    });

    // The frozen mobile app (rate.tsx) posts '' for an id it does not have, so '' counts as absent, not as malformed.
    it("accepts an empty id, which means the id is absent", async () => {
        const { auth } = await makeUser();

        const res = await request(app).post("/reviews").set(auth).send(review({ spotifyTrackId: spotifyId(), spotifyAlbumId: "", spotifyArtistId: "" }));

        expect(res.status).toBe(201);
    });

    it("[H5] refuses a malformed spotifyTrackId", async () => {
        const { auth } = await makeUser();
        const res = await request(app).post("/reviews").set(auth).send(review({ spotifyTrackId: "not a spotify id" }));
        expect(res.status).toBe(400);
    });

    it("[H5] refuses a malformed spotifyAlbumId", async () => {
        const { auth } = await makeUser();
        const res = await request(app).post("/reviews").set(auth).send(review({ spotifyTrackId: spotifyId(), spotifyAlbumId: "../x" }));
        expect(res.status).toBe(400);
    });

    it("[H5] refuses a malformed spotifyArtistId", async () => {
        const { auth } = await makeUser();
        const res = await request(app).post("/reviews").set(auth).send(review({ spotifyTrackId: spotifyId(), spotifyArtistId: "x".repeat(40) }));
        expect(res.status).toBe(400);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [M2] parameters that go into the Spotify URL
// ─────────────────────────────────────────────────────────────────────────────

describe("[M2] time_range on the top-items routes", () => {
    const topRoutes = [
        { name: "/me/top/artists", upstream: (range: string) => `/v1/me/top/artists?limit=5&time_range=${range}` },
        { name: "/me/top/tracks",  upstream: (range: string) => `/v1/me/top/tracks?limit=10&time_range=${range}` },
    ];

    describe.each(topRoutes)("GET $name", ({ name, upstream }) => {
        // `short_term%26limit%3D50` decodes to `short_term&limit=50`: a second, caller-chosen parameter on our request.
        [
            ["a second parameter smuggled in with an encoded &", "short_term%26limit%3D50"],
            ["not one of Spotify's three values", "nonsense"],
            ["empty", ""],
        ].forEach(([label, bad]) => {
            it(`[M2] refuses a time_range that is ${label}, and sends nothing to Spotify`, async () => {
                const { auth } = await makeUser({ spotifyAccessToken: "linked", spotifyTokenExpiresAt: inAnHour() });
                spotify.fallback({ items: [] });

                const res = await request(app).get(`${name}?time_range=${bad}`).set(auth);

                expect(res.status).toBe(400);
                expect(spotify.calls()).toBe(0);
            });
        });

        it.each(["short_term", "medium_term", "long_term"])("[M2] passes %s through", async (range) => {
            const { auth } = await makeUser({ spotifyAccessToken: "linked", spotifyTokenExpiresAt: inAnHour() });
            spotify.on(upstream(range), { items: [] });

            const res = await request(app).get(`${name}?time_range=${range}`).set(auth);

            expect(res.status).toBe(200);
            expect(spotify.calls(upstream(range))).toBe(1);
        });
    });
});

describe("[M2] type on /search", () => {
    [
        ["a second parameter smuggled in with an encoded &", "track%26limit%3D1"],
        ["a type the app does not use", "playlist"],
        ["a mix with a type the app does not use", "show,episode"],
        ["one valid type and one made up", "track,foo"],
        ["empty", ""],
    ].forEach(([label, bad]) => {
        it(`[M2] refuses a type that is ${label}, and sends nothing to Spotify`, async () => {
            const { auth } = await makeUser();
            spotify.fallback({ tracks: { items: [] } });

            const res = await request(app).get(`/search?q=x&type=${bad}`).set(auth);

            expect(res.status).toBe(400);
            expect(spotify.calls()).toBe(0);
        });
    });

    it.each(["track", "album,artist", "track,album,artist"])("[M2] passes type=%s through", async (type) => {
        const { auth } = await makeUser();
        spotify.on(`/v1/search?q=x&type=${type}&limit=10&offset=0`,{ tracks: { items: [] } });

        const res = await request(app).get("/search").query({ q: "x", type }).set(auth);

        expect(res.status).toBe(200);
    });
});

describe("[M2] group on /artists/:id/albums", () => {
    [
        ["a second parameter smuggled in with an encoded &", "album%26limit%3D50"],
        ["not one of Spotify's four groups", "foo"],
        ["empty", ""],
    ].forEach(([label, bad]) => {
        it(`[M2] refuses a group that is ${label}, and sends nothing to Spotify`, async () => {
            const { auth } = await makeUser();
            spotify.fallback({ items: [] });

            const res = await request(app).get(`/artists/${spotifyId()}/albums?group=${bad}`).set(auth);

            expect(res.status).toBe(400);
            expect(spotify.calls()).toBe(0);
        });
    });

    it.each(["album", "single", "compilation", "appears_on"])("[M2] passes group=%s through", async (group) => {
        const { auth } = await makeUser();
        const id = spotifyId();
        spotify.on(`/v1/artists/${id}/albums?include_groups=${group}&market=US&limit=10&offset=0`, { items: [] });

        const res = await request(app).get(`/artists/${id}/albums?group=${group}`).set(auth);

        expect(res.status).toBe(200);
    });
});
