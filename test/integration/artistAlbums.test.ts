import request from "supertest";
import app from "../../backend/app";
import { useMemoryMongo } from "../helpers/mongo";
import { useSpotifyMock } from "../helpers/spotifyMock";
import { makeUser, spotifyId } from "../helpers/fixtures";

// GET /artists/:id/albums stays a hand-written route in Phase E (it de-duplicates in-flight requests and remembers a
// 429), so it has its own tests. Since plan.md step 2b it forwards a CLAMPED page (limit 1-10, offset 0-1000) to Spotify
// and keeps each page under its own cache key, 429 sentinel and in-flight entry.

useMemoryMongo();
const spotify = useSpotifyMock();

// What the route must send to Spotify. The mock refuses any other URL, so a test that gets a 200 has also proved the URL.
const upstream = (id: string, group = "album", limit = 10, offset = 0) =>
    `/v1/artists/${id}/albums?include_groups=${group}&market=US&limit=${limit}&offset=${offset}`;

describe("GET /artists/:id/albums", () => {
    it("needs a session token", async () => {
        const res = await request(app).get(`/artists/${spotifyId()}/albums`);
        expect(res.status).toBe(401);
    });

    it("returns Spotify's discography, asking for the first ten albums in the US market by default", async () => {
        const { auth } = await makeUser();
        const id = spotifyId();
        spotify.on(upstream(id), { items: [{ id: "a1", name: "First" }] });

        const res = await request(app).get(`/artists/${id}/albums`).set(auth);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ items: [{ id: "a1", name: "First" }] });
        expect(spotify.calls(upstream(id))).toBe(1);
    });

    it("passes ?group= to Spotify as include_groups", async () => {
        const { auth } = await makeUser();
        const id = spotifyId();
        spotify.on(upstream(id, "single"), { items: [] });

        const res = await request(app).get(`/artists/${id}/albums?group=single`).set(auth);

        expect(res.status).toBe(200);
        expect(spotify.calls(upstream(id, "single"))).toBe(1);
    });

    it("passes Spotify's paging object through untouched, so the web can read `next` and `total`", async () => {
        const { auth } = await makeUser();
        const id = spotifyId();
        const page = { items: [{ id: "a1" }], total: 23, limit: 10, offset: 10, next: "https://api.spotify.com/v1/…", previous: null };
        spotify.on(upstream(id, "album", 10, 10), page);

        const res = await request(app).get(`/artists/${id}/albums?offset=10`).set(auth);

        expect(res.body).toEqual(page);
    });

    it("caches a discography for the same group, and keeps groups apart", async () => {
        const { auth } = await makeUser();
        const id = spotifyId();
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
            const id = spotifyId();
            spotify.on(upstream(id), "text from spotify", upstreamStatus);

            const res = await request(app).get(`/artists/${id}/albums`).set(auth);

            expect(res.status).toBe(ourStatus);
            expect(res.body).toEqual({ error: "text from spotify" });
        });

        it("does not cache an ordinary failure", async () => {
            const { auth } = await makeUser();
            const id = spotifyId();
            spotify.on(upstream(id), "broken", 500);
            await request(app).get(`/artists/${id}/albums`).set(auth);

            spotify.on(upstream(id), { items: ["ok"] });
            const res = await request(app).get(`/artists/${id}/albums`).set(auth);

            expect(res.status).toBe(200);
            expect(spotify.calls(upstream(id))).toBe(2);
        });

        it("answers 500 with the underlying error message when the request throws", async () => {
            const { auth } = await makeUser();
            const id = spotifyId();
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
            const id = spotifyId();
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
            const warm = spotifyId();
            spotify.on(upstream(warm), { items: [] });
            await request(app).get(`/artists/${warm}/albums`).set(auth); // gets the app token, so nothing below waits on it

            const id = spotifyId();
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

// ─────────────────────────────────────────────────────────────────────────────
// Plan.md step 2b: a clamped page goes to Spotify, and the clamped page is the cache key.
//
// Why the clamp matters (found by express-auditor): if the raw `?limit=` and `?offset=` made the key, then
// `?limit=1`, `?limit=2`, `?limit=3`… would each be a NEW key, bypass the 6-hour cache and the 429 sentinel, spend
// Spotify's app-wide rate limit, and grow a cache. With the clamp there are only 10 x 1001 possible pages per
// (artist, group), and junk collapses onto the default.
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /artists/:id/albums — the page it asks Spotify for (step 2b)", () => {
    // [query string, limit Spotify must receive, offset Spotify must receive]
    const clamps: [string, number, number][] = [
        ["", 10, 0],
        ["?limit=10&offset=0", 10, 0],
        ["?limit=5", 5, 0],
        ["?limit=1", 1, 0],
        ["?limit=0", 1, 0],                 // below the minimum
        ["?limit=-5", 1, 0],
        ["?limit=11", 10, 0],               // above the maximum (Dev Mode caps a page at 10)
        ["?limit=99", 10, 0],
        ["?limit=50", 10, 0],
        ["?limit=3.9", 3, 0],               // a fraction is cut, not rounded
        ["?limit=abc", 10, 0],              // junk means the default, not an error
        ["?limit=", 10, 0],
        ["?limit=Infinity", 10, 0],
        ["?limit=1&limit=2", 10, 0],        // an array means the default
        ["?limit[]=3", 10, 0],
        ["?offset=20", 10, 20],
        ["?offset=1000", 10, 1000],         // the highest offset Spotify accepts
        ["?offset=1001", 10, 1000],
        ["?offset=5000", 10, 1000],
        ["?offset=-5", 10, 0],
        ["?offset=7.9", 10, 7],
        ["?offset=abc", 10, 0],
        ["?offset=", 10, 0],
        ["?offset=Infinity", 10, 0],
        ["?offset=3&offset=4", 10, 0],
        ["?limit=4&offset=8", 4, 8],
        ["?limit=999&offset=999999", 10, 1000],
    ];

    it.each(clamps)("%j is sent to Spotify as limit=%i offset=%i", async (query, limit, offset) => {
        const { auth } = await makeUser();
        const id = spotifyId();
        spotify.on(upstream(id, "album", limit, offset), { items: [] });

        const res = await request(app).get(`/artists/${id}/albums${query}`).set(auth);

        expect(res.status).toBe(200);
        expect(spotify.calls(upstream(id, "album", limit, offset))).toBe(1);
        expect(spotify.calls()).toBe(1); // and nothing else
    });

    it("sends the limit and offset as plain numbers in the query, whatever the caller wrote", async () => {
        const { auth } = await makeUser();
        const id = spotifyId();
        spotify.on(upstream(id, "album", 10, 0), { items: [] });

        await request(app).get(`/artists/${id}/albums?limit=1e1&offset=%200`).set(auth); // 1e1 is 10; a padded 0 is 0

        const [sent] = spotify.paths();
        const params = new URL(sent, "https://spotify.test").searchParams;
        expect(params.get("limit")).toMatch(/^\d+$/);
        expect(params.get("offset")).toMatch(/^\d+$/);
        expect([...params.keys()].sort()).toEqual(["include_groups", "limit", "market", "offset"]);
    });

    it("keeps the group, the market and the page together in one call", async () => {
        const { auth } = await makeUser();
        const id = spotifyId();
        spotify.on(upstream(id, "appears_on", 10, 30), { items: [] });

        const res = await request(app).get(`/artists/${id}/albums?group=appears_on&offset=30`).set(auth);

        expect(res.status).toBe(200);
        expect(spotify.calls(upstream(id, "appears_on", 10, 30))).toBe(1);
    });
});

describe("GET /artists/:id/albums — one cache entry per clamped page (step 2b)", () => {
    it("gives every page its own answer and caches each one", async () => {
        const { auth } = await makeUser();
        const id = spotifyId();
        spotify.on(upstream(id, "album", 10, 0), { items: ["page 1"] });
        spotify.on(upstream(id, "album", 10, 10), { items: ["page 2"] });
        spotify.on(upstream(id, "album", 10, 20), { items: ["page 3"] });

        const first = await request(app).get(`/artists/${id}/albums`).set(auth);
        const second = await request(app).get(`/artists/${id}/albums?offset=10`).set(auth);
        const third = await request(app).get(`/artists/${id}/albums?offset=20`).set(auth);
        const firstAgain = await request(app).get(`/artists/${id}/albums`).set(auth);
        const secondAgain = await request(app).get(`/artists/${id}/albums?offset=10`).set(auth);

        expect(first.body).toEqual({ items: ["page 1"] });
        expect(second.body).toEqual({ items: ["page 2"] });
        expect(third.body).toEqual({ items: ["page 3"] });
        expect(firstAgain.body).toEqual({ items: ["page 1"] });
        expect(secondAgain.body).toEqual({ items: ["page 2"] });
        expect(spotify.calls()).toBe(3); // three pages fetched once each
    });

    it("treats a different limit as a different page", async () => {
        const { auth } = await makeUser();
        const id = spotifyId();
        spotify.on(upstream(id, "album", 10, 0), { items: ["ten"] });
        spotify.on(upstream(id, "album", 5, 0), { items: ["five"] });

        const ten = await request(app).get(`/artists/${id}/albums`).set(auth);
        const five = await request(app).get(`/artists/${id}/albums?limit=5`).set(auth);

        expect(ten.body).toEqual({ items: ["ten"] });
        expect(five.body).toEqual({ items: ["five"] });
    });

    it("keeps the same offset of two groups apart", async () => {
        const { auth } = await makeUser();
        const id = spotifyId();
        spotify.on(upstream(id, "album", 10, 10), { items: ["album page 2"] });
        spotify.on(upstream(id, "single", 10, 10), { items: ["single page 2"] });

        const albums = await request(app).get(`/artists/${id}/albums?offset=10`).set(auth);
        const singles = await request(app).get(`/artists/${id}/albums?group=single&offset=10`).set(auth);

        expect(albums.body).toEqual({ items: ["album page 2"] });
        expect(singles.body).toEqual({ items: ["single page 2"] });
    });

    it("keeps two artists apart at the same page", async () => {
        const { auth } = await makeUser();
        const a = spotifyId();
        const b = spotifyId();
        spotify.on(upstream(a), { items: ["a"] });
        spotify.on(upstream(b), { items: ["b"] });

        const ra = await request(app).get(`/artists/${a}/albums`).set(auth);
        const rb = await request(app).get(`/artists/${b}/albums`).set(auth);

        expect(ra.body).toEqual({ items: ["a"] });
        expect(rb.body).toEqual({ items: ["b"] });
    });

    // This is the auditor's cache-bypass finding, closed: no spelling of the same page reaches Spotify twice.
    it("answers every spelling of the same page from one upstream call", async () => {
        const { auth } = await makeUser();
        const id = spotifyId();
        spotify.on(upstream(id, "album", 10, 0), { items: [{ id: "a1" }] });

        const spellings = ["", "?limit=10", "?limit=99", "?limit=11&offset=0", "?limit=abc&offset=-5", "?offset=", "?limit[]=3&offset=abc", "?limit=0.5e2"];
        const bodies = [];
        for (const query of spellings) bodies.push((await request(app).get(`/artists/${id}/albums${query}`).set(auth)).body);

        bodies.forEach((body) => expect(body).toEqual({ items: [{ id: "a1" }] }));
        expect(spotify.calls(upstream(id, "album", 10, 0))).toBe(1);
        expect(spotify.calls()).toBe(1);
    });

    it("answers every offset past the maximum from one upstream call", async () => {
        const { auth } = await makeUser();
        const id = spotifyId();
        spotify.on(upstream(id, "album", 10, 1000), { items: [] });

        for (const offset of [1000, 1001, 5000, 999999]) {
            const res = await request(app).get(`/artists/${id}/albums?offset=${offset}`).set(auth);
            expect(res.status).toBe(200);
        }

        expect(spotify.calls(upstream(id, "album", 10, 1000))).toBe(1);
        expect(spotify.calls()).toBe(1);
    });

    it("does not let junk make new keys: 40 different junk limits and offsets cost one upstream call", async () => {
        const { auth } = await makeUser();
        const id = spotifyId();
        spotify.on(upstream(id, "album", 10, 0), { items: [] });

        for (let i = 0; i < 40; i++) {
            await request(app).get(`/artists/${id}/albums?limit=zz${i}&offset=yy${i}`).set(auth);
        }

        expect(spotify.calls()).toBe(1);
    });

    it("does not cache a failed later page, so the next click can try again", async () => {
        const { auth } = await makeUser();
        const id = spotifyId();
        spotify.on(upstream(id, "album", 10, 10), "broken", 500);
        const failed = await request(app).get(`/artists/${id}/albums?offset=10`).set(auth);

        spotify.on(upstream(id, "album", 10, 10), { items: ["recovered"] });
        const retried = await request(app).get(`/artists/${id}/albums?offset=10`).set(auth);

        expect(failed.status).toBe(500);
        expect(retried.status).toBe(200);
        expect(retried.body).toEqual({ items: ["recovered"] });
    });
});

describe("GET /artists/:id/albums — a rate limit is remembered per page (step 2b)", () => {
    it("is remembered for every spelling of the page that was refused", async () => {
        const { auth } = await makeUser();
        const id = spotifyId();
        spotify.on(upstream(id, "album", 10, 0), "slow down", 429);

        const first = await request(app).get(`/artists/${id}/albums`).set(auth);
        const sameClamped = await request(app).get(`/artists/${id}/albums?limit=99&offset=-5`).set(auth);
        const junk = await request(app).get(`/artists/${id}/albums?limit=abc`).set(auth);

        expect(first.status).toBe(429);
        expect(sameClamped.status).toBe(429);
        expect(junk.status).toBe(429);
        expect(sameClamped.body).toEqual({ error: "Rate limited by Spotify, try again shortly" });
        expect(spotify.calls(upstream(id, "album", 10, 0))).toBe(1);
    });

    // Per page by design: the page that was refused is not asked again, but the user is not locked out of the rest.
    it("does not block a different page", async () => {
        const { auth } = await makeUser();
        const id = spotifyId();
        spotify.on(upstream(id, "album", 10, 10), "slow down", 429);
        spotify.on(upstream(id, "album", 10, 20), { items: ["page 3"] });

        const refused = await request(app).get(`/artists/${id}/albums?offset=10`).set(auth);
        const other = await request(app).get(`/artists/${id}/albums?offset=20`).set(auth);

        expect(refused.status).toBe(429);
        expect(other.status).toBe(200);
        expect(other.body).toEqual({ items: ["page 3"] });
    });

    it("does not block the same page of another group", async () => {
        const { auth } = await makeUser();
        const id = spotifyId();
        spotify.on(upstream(id, "album", 10, 0), "slow down", 429);
        spotify.on(upstream(id, "single", 10, 0), { items: ["single"] });

        const refused = await request(app).get(`/artists/${id}/albums`).set(auth);
        const other = await request(app).get(`/artists/${id}/albums?group=single`).set(auth);

        expect(refused.status).toBe(429);
        expect(other.status).toBe(200);
    });
});

describe("GET /artists/:id/albums — overlapping requests share a call per page (step 2b)", () => {
    // A first request gets the app token, so the later ones do not wait on it (and the 150 ms below is enough).
    async function warmUp() {
        const { auth } = await makeUser();
        const warm = spotifyId();
        spotify.on(upstream(warm), { items: [] });
        await request(app).get(`/artists/${warm}/albums`).set(auth);
        return auth;
    }
    const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

    it("share one call when they are the same page spelled differently", async () => {
        const auth = await warmUp();
        const id = spotifyId();
        spotify.on(upstream(id, "album", 10, 0), { items: ["shared"] });
        const release = spotify.hold(upstream(id, "album", 10, 0));

        const plain = request(app).get(`/artists/${id}/albums`).set(auth).then((r) => r);
        const junk = request(app).get(`/artists/${id}/albums?limit=99&offset=abc`).set(auth).then((r) => r);
        await settle();
        release();
        const [a, b] = await Promise.all([plain, junk]);

        expect(a.body).toEqual({ items: ["shared"] });
        expect(b.body).toEqual({ items: ["shared"] });
        expect(spotify.calls(upstream(id, "album", 10, 0))).toBe(1);
    });

    it("make one call per page when they are different pages, each with its own answer", async () => {
        const auth = await warmUp();
        const id = spotifyId();
        spotify.on(upstream(id, "album", 10, 0), { items: ["page 1"] });
        spotify.on(upstream(id, "album", 10, 10), { items: ["page 2"] });
        const release1 = spotify.hold(upstream(id, "album", 10, 0));
        const release2 = spotify.hold(upstream(id, "album", 10, 10));

        const one = request(app).get(`/artists/${id}/albums`).set(auth).then((r) => r);
        const two = request(app).get(`/artists/${id}/albums?offset=10`).set(auth).then((r) => r);
        await settle();
        release1();
        release2();
        const [a, b] = await Promise.all([one, two]);

        expect(a.body).toEqual({ items: ["page 1"] });
        expect(b.body).toEqual({ items: ["page 2"] });
        expect(spotify.calls(upstream(id, "album", 10, 0))).toBe(1);
        expect(spotify.calls(upstream(id, "album", 10, 10))).toBe(1);
    });

    it("all get the 429 when the shared call is refused, and Spotify is asked once", async () => {
        const auth = await warmUp();
        const id = spotifyId();
        spotify.on(upstream(id, "album", 10, 0), "slow down", 429);
        const release = spotify.hold(upstream(id, "album", 10, 0));

        const a = request(app).get(`/artists/${id}/albums`).set(auth).then((r) => r);
        const b = request(app).get(`/artists/${id}/albums?limit=11`).set(auth).then((r) => r);
        await settle();
        release();
        const [ra, rb] = await Promise.all([a, b]);

        expect(ra.status).toBe(429);
        expect(rb.status).toBe(429);
        expect(spotify.calls(upstream(id, "album", 10, 0))).toBe(1);
    });
});
