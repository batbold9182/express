import request from "supertest";
import app from "../../backend/app";
import { useMemoryMongo } from "../helpers/mongo";
import { useSpotifyMock } from "../helpers/spotifyMock";
import { makeUser, uniqueId } from "../helpers/fixtures";

// GET /artists/:id/albums stays a hand-written route in Phase E (it de-duplicates in-flight requests and remembers a
// 429), so it has its own tests. They pin today's behaviour, including the cache keys the plan leaves alone.

useMemoryMongo();
const spotify = useSpotifyMock();

const upstream = (id: string, group = "album") => `/v1/artists/${id}/albums?include_groups=${group}&market=US`;

describe("GET /artists/:id/albums", () => {
    it("needs a session token", async () => {
        const res = await request(app).get(`/artists/${uniqueId("r")}/albums`);
        expect(res.status).toBe(401);
    });

    it("returns Spotify's discography, asking for albums in the US market by default", async () => {
        const { auth } = await makeUser();
        const id = uniqueId("r");
        spotify.on(upstream(id), { items: [{ id: "a1", name: "First" }] });

        const res = await request(app).get(`/artists/${id}/albums`).set(auth);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ items: [{ id: "a1", name: "First" }] });
        expect(spotify.calls(upstream(id))).toBe(1);
    });

    it("passes ?group= to Spotify as include_groups", async () => {
        const { auth } = await makeUser();
        const id = uniqueId("r");
        spotify.on(upstream(id, "single"), { items: [] });

        const res = await request(app).get(`/artists/${id}/albums?group=single`).set(auth);

        expect(res.status).toBe(200);
        expect(spotify.calls(upstream(id, "single"))).toBe(1);
    });

    // Known limit: Client Credentials rejects an explicit limit, so Spotify's default page is always used.
    it("never forwards limit or offset to Spotify", async () => {
        const { auth } = await makeUser();
        const id = uniqueId("r");
        spotify.on(upstream(id), { items: [] });

        const res = await request(app).get(`/artists/${id}/albums?limit=50&offset=20`).set(auth);

        expect(res.status).toBe(200);
        expect(spotify.calls(upstream(id))).toBe(1); // the URL had neither, or the mock would have refused it
    });

    it("caches a discography for the same group, and keeps groups apart", async () => {
        const { auth } = await makeUser();
        const id = uniqueId("r");
        spotify.on(upstream(id), { items: ["album"] });
        spotify.on(upstream(id, "single"), { items: ["single"] });

        await request(app).get(`/artists/${id}/albums`).set(auth);
        const again = await request(app).get(`/artists/${id}/albums`).set(auth);
        const singles = await request(app).get(`/artists/${id}/albums?group=single`).set(auth);

        expect(again.body).toEqual({ items: ["album"] });
        expect(singles.body).toEqual({ items: ["single"] });
        expect(spotify.calls(upstream(id))).toBe(1);
        expect(spotify.calls(upstream(id, "single"))).toBe(1);
    });

    describe("errors from Spotify", () => {
        it.each([
            [401, 502],
            [403, 502],
            [404, 404],
            [500, 500],
        ])("answers Spotify's %i with %i and passes the text along", async (upstreamStatus, ourStatus) => {
            const { auth } = await makeUser();
            const id = uniqueId("r");
            spotify.on(upstream(id), "text from spotify", upstreamStatus);

            const res = await request(app).get(`/artists/${id}/albums`).set(auth);

            expect(res.status).toBe(ourStatus);
            expect(res.body).toEqual({ error: "text from spotify" });
        });

        it("does not cache an ordinary failure", async () => {
            const { auth } = await makeUser();
            const id = uniqueId("r");
            spotify.on(upstream(id), "broken", 500);
            await request(app).get(`/artists/${id}/albums`).set(auth);

            spotify.on(upstream(id), { items: ["ok"] });
            const res = await request(app).get(`/artists/${id}/albums`).set(auth);

            expect(res.status).toBe(200);
            expect(spotify.calls(upstream(id))).toBe(2);
        });

        it("answers 500 with the underlying error message when the request throws", async () => {
            const { auth } = await makeUser();
            const id = uniqueId("r");
            spotify.fail(upstream(id), new TypeError("socket hang up"));

            const res = await request(app).get(`/artists/${id}/albums`).set(auth);

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ error: "socket hang up" });
        });
    });

    // Spotify rate-limits this endpoint often. The 429 is remembered briefly (Retry-After, 10s when absent) so the
    // next requests are refused here instead of each one asking Spotify and being refused there.
    describe("a rate limit (429)", () => {
        it("is passed on, then remembered so the next request does not reach Spotify", async () => {
            const { auth } = await makeUser();
            const id = uniqueId("r");
            spotify.on(upstream(id), "slow down", 429);

            const first = await request(app).get(`/artists/${id}/albums`).set(auth);
            const second = await request(app).get(`/artists/${id}/albums`).set(auth);

            expect(first.status).toBe(429);
            expect(first.body).toEqual({ error: "slow down" });
            expect(second.status).toBe(429);
            expect(second.body).toEqual({ error: "Rate limited by Spotify, try again shortly" });
            expect(spotify.calls(upstream(id))).toBe(1);
        });
    });

    describe("requests that overlap", () => {
        it("share one request to Spotify", async () => {
            const { auth } = await makeUser();
            const warm = uniqueId("r");
            spotify.on(upstream(warm), { items: [] });
            await request(app).get(`/artists/${warm}/albums`).set(auth); // gets the app token, so nothing below waits on it

            const id = uniqueId("r");
            spotify.on(upstream(id), { items: ["shared"] });
            const release = spotify.hold(upstream(id));

            const a = request(app).get(`/artists/${id}/albums`).set(auth).then((r) => r);
            const b = request(app).get(`/artists/${id}/albums`).set(auth).then((r) => r);
            await new Promise((resolve) => setTimeout(resolve, 150)); // both are now inside the handler
            release();
            const [ra, rb] = await Promise.all([a, b]);

            expect(ra.status).toBe(200);
            expect(rb.status).toBe(200);
            expect(ra.body).toEqual({ items: ["shared"] });
            expect(rb.body).toEqual({ items: ["shared"] });
            expect(spotify.calls(upstream(id))).toBe(1);
        });
    });
});
