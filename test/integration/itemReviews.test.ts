import request from "supertest";
import { Types } from "mongoose";
import app from "../../backend/app";
import { Review } from "../../backend/models/review";
import { useMemoryMongo } from "../helpers/mongo";
import { makeUser, makeReview, makeLegacyReview, uniqueId } from "../helpers/fixtures";

// Characterization tests for the three review lists: GET /tracks/:id/reviews, /albums/:id/reviews and
// /artists/:id/reviews. They pin what the routes do TODAY so the Phase E refactor can be checked against them.

useMemoryMongo();

type Kind = "track" | "album" | "artist";
const kinds = [
    { kind: "track" as Kind,  base: "/tracks",  field: "spotifyTrackId",  other: "album" as Kind },
    { kind: "album" as Kind,  base: "/albums",  field: "spotifyAlbumId",  other: "track" as Kind },
    { kind: "artist" as Kind, base: "/artists", field: "spotifyArtistId", other: "track" as Kind },
];

describe.each(kinds)("GET $base/:id/reviews", ({ kind, base, field, other }) => {
    const isTrack = kind === "track";
    const url = (id: string, query = "") => `${base}/${id}/reviews${query}`;

    // A review of this kind for `id`. A track review gets a spotifyTrackId from the fixture; the others must not.
    const reviewOf = (userId: Types.ObjectId, id: string, overrides: Record<string, unknown> = {}) =>
        makeReview(userId, { type: kind, spotifyTrackId: undefined, [field]: id, ...overrides });

    describe("authentication", () => {
        it("needs a session token", async () => {
            const res = await request(app).get(url(uniqueId("x")));
            expect(res.status).toBe(401);
            expect(res.body).toEqual({ error: "Missing token" });
        });
    });

    describe("the response", () => {
        it("is empty, with no average, for something nobody has reviewed", async () => {
            const { user, auth } = await makeUser();

            const res = await request(app).get(url(uniqueId("x"))).set(auth);

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                reviews: [],
                avgScore: null,
                myId: String(user._id),
                total: 0,
                hasMore: false,
                ...(isTrack ? { distribution: Array(10).fill(0) } : {}),
            });
        });

        it("has a score distribution on tracks only", async () => {
            const { user, auth } = await makeUser();
            const id = uniqueId("x");
            await reviewOf(user._id, id);

            const res = await request(app).get(url(id)).set(auth);

            if (isTrack) expect(res.body).toHaveProperty("distribution");
            else expect(res.body).not.toHaveProperty("distribution");
        });

        it("averages every score, rounded to one decimal", async () => {
            const { user, auth } = await makeUser();
            const id = uniqueId("x");
            for (const score of [7, 8, 8]) await reviewOf(user._id, id, { score }); // 23 / 3 = 7.666…

            const res = await request(app).get(url(id)).set(auth);

            expect(res.body.avgScore).toBe(7.7);
            expect(res.body.total).toBe(3);
        });

        it("leaves a review with no score out of the average but still counts it", async () => {
            const { user, auth } = await makeUser();
            const id = uniqueId("x");
            await reviewOf(user._id, id, { score: 8 });
            await reviewOf(user._id, id, { score: undefined });

            const res = await request(app).get(url(id)).set(auth);

            expect(res.body.avgScore).toBe(8);
            expect(res.body.total).toBe(2);
        });

        it("lists the newest review first", async () => {
            const { user, auth } = await makeUser();
            const id = uniqueId("x");
            await reviewOf(user._id, id, { text: "oldest", createdAt: new Date("2024-01-01") });
            await reviewOf(user._id, id, { text: "newest", createdAt: new Date("2024-03-01") });
            await reviewOf(user._id, id, { text: "middle", createdAt: new Date("2024-02-01") });

            const res = await request(app).get(url(id)).set(auth);

            expect(res.body.reviews.map((r: { text: string }) => r.text)).toEqual(["newest", "middle", "oldest"]);
        });

        it("tells the caller who they are, as myId", async () => {
            const me = await makeUser();
            const someoneElse = await makeUser();
            const id = uniqueId("x");
            await reviewOf(someoneElse.user._id, id);

            const res = await request(app).get(url(id)).set(me.auth);

            expect(res.body.myId).toBe(String(me.user._id));
        });

        it("shows each author's public details and nothing private", async () => {
            const { user, auth } = await makeUser();
            const id = uniqueId("x");
            await reviewOf(user._id, id);

            const res = await request(app).get(url(id)).set(auth);

            const author = res.body.reviews[0].userId;
            expect(author).toMatchObject({ _id: String(user._id), displayName: user.displayName, spotifyId: user.spotifyId });
            for (const secret of ["email", "accessToken", "refreshToken", "passwordHash", "spotifyAccessToken"]) {
                expect(author).not.toHaveProperty(secret);
            }
        });
    });

    describe("paging", () => {
        it("pages with offset and limit, and says when there is more", async () => {
            const { user, auth } = await makeUser();
            const id = uniqueId("x");
            for (let i = 1; i <= 5; i++) await reviewOf(user._id, id, { text: `r${i}`, createdAt: new Date(2024, 0, i) });

            const p1 = await request(app).get(url(id, "?limit=2&offset=0")).set(auth);
            const p2 = await request(app).get(url(id, "?limit=2&offset=2")).set(auth);
            const p3 = await request(app).get(url(id, "?limit=2&offset=4")).set(auth);

            expect(p1.body.reviews.map((r: { text: string }) => r.text)).toEqual(["r5", "r4"]);
            expect(p2.body.reviews.map((r: { text: string }) => r.text)).toEqual(["r3", "r2"]);
            expect(p3.body.reviews.map((r: { text: string }) => r.text)).toEqual(["r1"]);
            expect([p1.body.hasMore, p2.body.hasMore, p3.body.hasMore]).toEqual([true, true, false]);
            expect([p1.body.total, p2.body.total, p3.body.total]).toEqual([5, 5, 5]); // total is the whole list, not the page
        });

        it("says there is no more on an exactly full last page", async () => {
            const { user, auth } = await makeUser();
            const id = uniqueId("x");
            for (let i = 0; i < 4; i++) await reviewOf(user._id, id);

            const res = await request(app).get(url(id, "?limit=2&offset=2")).set(auth);

            expect(res.body.reviews).toHaveLength(2);
            expect(res.body.hasMore).toBe(false);
        });

        it("returns 20 by default and never more than 50", async () => {
            const { user, auth } = await makeUser();
            const id = uniqueId("x");
            await Review.insertMany(
                Array.from({ length: 55 }, (_, i) => ({
                    userId: user._id, type: kind, [field]: id, trackName: "S", artistName: "A", score: 5, createdAt: new Date(2024, 0, 1, 0, 0, i),
                })),
            );

            const byDefault = await request(app).get(url(id)).set(auth);
            const greedy = await request(app).get(url(id, "?limit=500")).set(auth);

            expect(byDefault.body.reviews).toHaveLength(20);
            expect(greedy.body.reviews).toHaveLength(50);
            expect(greedy.body.hasMore).toBe(true);
            expect(greedy.body.total).toBe(55);
        });

        it("treats a nonsense offset or limit as if it were not there", async () => {
            const { user, auth } = await makeUser();
            const id = uniqueId("x");
            await reviewOf(user._id, id);

            const res = await request(app).get(url(id, "?offset=abc&limit=xyz")).set(auth);

            expect(res.status).toBe(200);
            expect(res.body.reviews).toHaveLength(1);
        });
    });

    describe("which reviews belong on the page", () => {
        it("includes only reviews of this id", async () => {
            const { user, auth } = await makeUser();
            const id = uniqueId("x");
            await reviewOf(user._id, id, { text: "mine" });
            await reviewOf(user._id, uniqueId("x"), { text: "someone else's subject" });

            const res = await request(app).get(url(id)).set(auth);

            expect(res.body.reviews.map((r: { text: string }) => r.text)).toEqual(["mine"]);
        });

        // Scores are per type (plan.md → Scope Decisions): an album's page lists album reviews only, and the same for
        // songs and artists. A review of another type that happens to carry this id does not count toward this page.
        it(`ignores a '${other}' review even when it carries this ${kind} id`, async () => {
            const { user, auth } = await makeUser();
            const id = uniqueId("x");
            await reviewOf(user._id, id, { text: "the real one" });
            await makeReview(user._id, { type: other, [field]: id, text: `a ${other} review that carries the id` });

            const res = await request(app).get(url(id)).set(auth);

            expect(res.body.reviews.map((r: { text: string }) => r.text)).toEqual(["the real one"]);
            expect(res.body.total).toBe(1);
        });

        if (isTrack) {
            // Reviews saved before `type` existed have no `type` field at all; the track page still shows them.
            it("includes old reviews that have no type", async () => {
                const { user, auth } = await makeUser();
                const id = uniqueId("x");
                await makeLegacyReview(user._id, { spotifyTrackId: id, text: "from before types existed", score: 6 });
                await reviewOf(user._id, id, { text: "modern", score: 8 });

                const res = await request(app).get(url(id)).set(auth);

                expect(res.body.reviews.map((r: { text: string }) => r.text).sort()).toEqual(["from before types existed", "modern"]);
                expect(res.body.avgScore).toBe(7);
            });

            it("buckets scores from 1 to 10 by rounding; a 0 lands in no bucket", async () => {
                const { user, auth } = await makeUser();
                const id = uniqueId("x");
                for (const score of [10, 7.4, 7.5, 0, 1]) await reviewOf(user._id, id, { score });

                const res = await request(app).get(url(id)).set(auth);

                // 10 -> bucket 10, 7.4 -> 7, 7.5 -> 8, 1 -> 1; 0 rounds to bucket 0, which does not exist
                expect(res.body.distribution).toEqual([1, 0, 0, 0, 0, 0, 1, 1, 0, 1]);
                expect(res.body.avgScore).toBe(5.2); // (10 + 7.4 + 7.5 + 0 + 1) / 5 = 5.18, and the 0 still counts
                expect(res.body.total).toBe(5);
            });
        }
    });

    describe("reviews whose author was deleted", () => {
        // A deleted account leaves its reviews behind. They are dropped from the list...
        it("drops them from the list", async () => {
            const { user, auth } = await makeUser();
            const id = uniqueId("x");
            await reviewOf(user._id, id, { text: "kept" });
            await reviewOf(new Types.ObjectId(), id, { text: "orphan" });

            const res = await request(app).get(url(id)).set(auth);

            expect(res.body.reviews.map((r: { text: string }) => r.text)).toEqual(["kept"]);
        });

        // ...but still counted in `total` and the average, and — CURRENT BEHAVIOUR, which Phase E Step 3 changes on
        // purpose (decision 2) — `hasMore` is worked out from the page AFTER they are dropped, so it says there is
        // more when the only thing left is the orphan.
        it("still counts them in total and the average (current behaviour)", async () => {
            const { user, auth } = await makeUser();
            const id = uniqueId("x");
            await reviewOf(user._id, id, { score: 10 });
            await reviewOf(new Types.ObjectId(), id, { score: 0 });

            const res = await request(app).get(url(id)).set(auth);

            expect(res.body.total).toBe(2);
            expect(res.body.avgScore).toBe(5);
        });

        it("reports hasMore = true past the last real review (current behaviour, to be fixed in Step 3)", async () => {
            const { user, auth } = await makeUser();
            const id = uniqueId("x");
            await reviewOf(user._id, id, { createdAt: new Date("2024-02-01") });
            await reviewOf(new Types.ObjectId(), id, { createdAt: new Date("2024-01-01") }); // the orphan is last

            const res = await request(app).get(url(id)).set(auth);

            expect(res.body.reviews).toHaveLength(1);
            expect(res.body.hasMore).toBe(true);
        });

        it("drops a comment whose author was deleted but keeps the review and the other comments", async () => {
            const { user, auth } = await makeUser();
            const id = uniqueId("x");
            await reviewOf(user._id, id, {
                comments: [
                    { userId: user._id, text: "from a real user" },
                    { userId: new Types.ObjectId(), text: "from a deleted user" },
                ],
            });

            const res = await request(app).get(url(id)).set(auth);

            expect(res.body.reviews).toHaveLength(1);
            expect(res.body.reviews[0].comments.map((c: { text: string }) => c.text)).toEqual(["from a real user"]);
            expect(res.body.reviews[0].comments[0].userId).toMatchObject({ displayName: user.displayName });
        });
    });
});
