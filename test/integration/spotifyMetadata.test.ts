import request from "supertest";
import app from "../../backend/app";
import { useMemoryMongo } from "../helpers/mongo";
import { useSpotifyMock } from "../helpers/spotifyMock";
import { makeUser, spotifyId } from "../helpers/fixtures";

// Characterization tests: they pin what these routes do TODAY, so the Phase E refactor can be checked against them.
// If one fails after a change, either the change broke a route or the behaviour was meant to change — decide which.

useMemoryMongo();
const spotify = useSpotifyMock();

// The four handlers that fetch one Spotify resource, cache it for a day and hand it back.
const routes = [
    { name: "GET /tracks/:id",        path: (id: string) => `/tracks/${id}`,        upstream: (id: string) => `/v1/tracks/${id}`,              failure: "Failed to fetch track" },
    { name: "GET /albums/:id",        path: (id: string) => `/albums/${id}`,        upstream: (id: string) => `/v1/albums/${id}`,              failure: "Failed to fetch album" },
    { name: "GET /albums/:id/tracks", path: (id: string) => `/albums/${id}/tracks`, upstream: (id: string) => `/v1/albums/${id}/tracks?limit=50`, failure: "Failed to fetch tracks" },
    { name: "GET /artists/:id",       path: (id: string) => `/artists/${id}`,       upstream: (id: string) => `/v1/artists/${id}`,              failure: "Failed to fetch artist" },
];

describe.each(routes)("$name", ({ path, upstream, failure }) => {
    describe("authentication", () => {
        it("needs a session token", async () => {
            const res = await request(app).get(path(spotifyId()));
            expect(res.status).toBe(401);
            expect(res.body).toEqual({ error: "Missing token" });
            expect(spotify.calls()).toBe(0);
        });

        it("turns away a token that belongs to nobody", async () => {
            const res = await request(app).get(path(spotifyId())).set("Authorization", "Bearer not-a-real-token");
            expect(res.status).toBe(401);
            expect(res.body).toEqual({ error: "Invalid token" });
            expect(spotify.calls()).toBe(0);
        });
    });

    describe("the upstream call", () => {
        it("returns Spotify's JSON unchanged", async () => {
            const { auth } = await makeUser();
            const id = spotifyId();
            spotify.on(upstream(id), { id, name: "Thing", nested: { a: [1, 2, 3] } });

            const res = await request(app).get(path(id)).set(auth);

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ id, name: "Thing", nested: { a: [1, 2, 3] } });
        });

        it("authenticates to Spotify with the app token, never the caller's own session token", async () => {
            const { auth, token } = await makeUser();
            const id = spotifyId();
            spotify.on(upstream(id), { id });

            await request(app).get(path(id)).set(auth);

            const sent = spotify.lastHeaders(upstream(id))?.get("authorization");
            expect(sent).toBe("Bearer test-app-token");
            expect(sent).not.toContain(token);
        });

        // (This block used to pin "uses the caller's own Spotify token when they have linked an account". That was the
        // path by which one user's private /me data reached another through the shared cache — security finding H5 — so the
        // opposite is now stated in test/security/spotify.test.ts ("never uses a linked user's own Spotify token for data
        // that goes into the shared cache"), and the pin is gone.)
    });

    describe("caching", () => {
        it("serves a repeat request from the cache without asking Spotify again", async () => {
            const { auth } = await makeUser();
            const id = spotifyId();
            spotify.on(upstream(id), { id, name: "Cached" });

            const first = await request(app).get(path(id)).set(auth);
            const second = await request(app).get(path(id)).set(auth);

            expect(second.status).toBe(200);
            expect(second.body).toEqual(first.body);
            expect(spotify.calls(upstream(id))).toBe(1);
        });

        it("shares the cache between users — it is Spotify metadata, not personal data", async () => {
            const a = await makeUser();
            const b = await makeUser();
            const id = spotifyId();
            spotify.on(upstream(id), { id });

            await request(app).get(path(id)).set(a.auth);
            await request(app).get(path(id)).set(b.auth);

            expect(spotify.calls(upstream(id))).toBe(1);
        });

        it("keeps one cache entry per id", async () => {
            const { auth } = await makeUser();
            const [one, two] = [spotifyId(), spotifyId()];
            spotify.on(upstream(one), { id: one });
            spotify.on(upstream(two), { id: two });

            const r1 = await request(app).get(path(one)).set(auth);
            const r2 = await request(app).get(path(two)).set(auth);

            expect(r1.body).toEqual({ id: one });
            expect(r2.body).toEqual({ id: two });
        });

        it("does not cache a failure, so the next request tries Spotify again", async () => {
            const { auth } = await makeUser();
            const id = spotifyId();

            spotify.on(upstream(id), "Not found", 404);
            const failed = await request(app).get(path(id)).set(auth);
            expect(failed.status).toBe(404);

            spotify.on(upstream(id), { id, name: "Back" });
            const recovered = await request(app).get(path(id)).set(auth);
            expect(recovered.status).toBe(200);
            expect(recovered.body).toEqual({ id, name: "Back" });
            expect(spotify.calls(upstream(id))).toBe(2);
        });
    });

    describe("when Spotify answers with an error", () => {
        // 401 and 403 become 502: they mean OUR Spotify token is bad, not that the caller's session is. Passing a 401
        // through would make the web client log the user out.
        it.each([
            [401, 502],
            [403, 502],
            [404, 404],
            [429, 429],
            [500, 500],
            [503, 503],
        ])("answers Spotify's %i with %i and passes Spotify's text along", async (upstreamStatus, ourStatus) => {
            const { auth } = await makeUser();
            const id = spotifyId();
            spotify.on(upstream(id), "text from spotify", upstreamStatus);

            const res = await request(app).get(path(id)).set(auth);

            expect(res.status).toBe(ourStatus);
            expect(res.body).toEqual({ error: "text from spotify" });
        });

        it("answers 500 with this route's own message when the request to Spotify throws", async () => {
            const { auth } = await makeUser();
            const id = spotifyId();
            spotify.fail(upstream(id));

            const res = await request(app).get(path(id)).set(auth);

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ error: failure });
        });

        it("answers 500 the same way when Spotify's reply is not JSON", async () => {
            const { auth } = await makeUser();
            const id = spotifyId();
            spotify.on(upstream(id), "<html>gateway hiccup</html>");

            const res = await request(app).get(path(id)).set(auth);

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ error: failure });
        });
    });
});
