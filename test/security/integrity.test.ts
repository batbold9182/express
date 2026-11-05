import request from "supertest";
import { Types } from "mongoose";
import app from "../../backend/app";
import { User } from "../../backend/models/User";
import { Review } from "../../backend/models/review";
import { Notification } from "../../backend/models/Notifications";
import { useMemoryMongo } from "../helpers/mongo";
import { makeUser, makeLegacyReview, spotifyId, uniqueId } from "../helpers/fixtures";

// Security tests, Step 6: data integrity. See plan.md -> "Security tests". Each test states the SECURE behaviour. Where the
// hole is open it is `it.failing`: it passes today and goes red the day the fix lands, at which point `express-backend`
// removes the marker and it becomes the permanent guard. Plain `it` is a guard that holds either way.
//
//   [M3]  Duplicate reviews. "Already reviewed" is a read, then a write, with no unique index: ten simultaneous posts stored
//         eight reviews.
//   [M5]  Follow state lags up to four minutes. `req.user.following` is cached by the auth middleware and drives `isFollowing`
//         on the profile, the follower and following lists and search, so it is stale right after a follow or an unfollow.
//   [M8]  Missing limits: a 10,000-character displayName and a 2,000-item list are accepted, and five follow / unfollow
//         cycles made five notifications.
//
// The tests state BEHAVIOUR, not how it is built, so they hold whatever the index looks like (plan.md: production first gets a
// backfill of `type` on old reviews and a dedupe, then three partial unique indexes, one per type; `$exists: false` cannot go in a
// partial index, and a unique index will not build over existing duplicates). One contract choice: when two requests race for
// the same review, the loser gets the same 409 "You already reviewed this ..." that a later request gets.
//
// The numbers (plan.md): displayName 1 to 50 characters; a list at most 100 items; at most one unread follow notification per
// follower per person.

useMemoryMongo();

/** Waits for fire-and-forget work, such as the notification a follow sends after it has already answered. */
const settle = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

type Auth = Record<string, string>;

// ─────────────────────────────────────────────────────────────────────────────
// [M3] one review per user per thing
// ─────────────────────────────────────────────────────────────────────────────

describe("[M3] one review per user per track, album or artist", () => {
    const subjects = [
        { name: "track", id: "spotifyTrackId" },
        { name: "album", id: "spotifyAlbumId" },
        { name: "artist", id: "spotifyArtistId" },
    ] as const;

    const post = (auth: Auth, type: string, idField: string, id: string) =>
        request(app).post("/reviews").set(auth).send({ type, trackName: "Name", artistName: "Artist", score: 5, [idField]: id });

    describe.each(subjects)("a $name", ({ name, id: idField }) => {
        // Twenty at once, so the read-then-write gap cannot be missed. Ten stored eight when this was first probed.
        it.failing(`[M3] twenty simultaneous reviews of one ${name} store exactly one`, async () => {
            const { user, auth } = await makeUser();
            const id = spotifyId();

            const results = await Promise.all(Array.from({ length: 20 }, () => post(auth, name, idField, id)));

            expect(await Review.countDocuments({ userId: user._id })).toBe(1);
            expect(results.filter((r) => r.status === 201)).toHaveLength(1);
            expect(results.filter((r) => r.status !== 201).every((r) => r.status === 409)).toBe(true);
        });

        // The route is not the only way in. The database itself must refuse the second one.
        it.failing(`[M3] the database refuses a second review of the same ${name} by the same user`, async () => {
            const { user } = await makeUser();
            const id = spotifyId();
            const doc = { userId: user._id, type: name, [idField]: id, trackName: "Name", artistName: "Artist", score: 5 };
            await Review.create(doc);

            await expect(Review.create(doc)).rejects.toBeTruthy();
        });

        it(`a later request for the same ${name} is the ordinary 409`, async () => {
            const { auth } = await makeUser();
            const id = spotifyId();
            expect((await post(auth, name, idField, id)).status).toBe(201);

            const again = await post(auth, name, idField, id);

            expect(again.status).toBe(409);
        });
    });

    // The pitfalls of an index that is too wide. A track review also carries its album's and artist's ids, so the same id
    // legitimately appears on several of one user's reviews, and the unique rule has to be per type.
    describe("what stays allowed", () => {
        it("two users may review the same track", async () => {
            const a = await makeUser();
            const b = await makeUser();
            const id = spotifyId();

            expect((await post(a.auth, "track", "spotifyTrackId", id)).status).toBe(201);
            expect((await post(b.auth, "track", "spotifyTrackId", id)).status).toBe(201);
        });

        it("one user may review two different tracks", async () => {
            const { auth } = await makeUser();

            expect((await post(auth, "track", "spotifyTrackId", spotifyId())).status).toBe(201);
            expect((await post(auth, "track", "spotifyTrackId", spotifyId())).status).toBe(201);
        });

        it("a track review, another track on the same album, and a review of that album can all exist", async () => {
            const { auth } = await makeUser();
            const album = spotifyId();
            const track = (n: string) => request(app).post("/reviews").set(auth).send({ type: "track", trackName: n, artistName: "Artist", score: 5, spotifyTrackId: spotifyId(), spotifyAlbumId: album });

            expect((await track("one")).status).toBe(201);
            expect((await track("two")).status).toBe(201);
            expect((await post(auth, "album", "spotifyAlbumId", album)).status).toBe(201);
        });

        it("an artist review and a track review that carries the same artist id can both exist", async () => {
            const { auth } = await makeUser();
            const artist = spotifyId();

            const track = await request(app).post("/reviews").set(auth).send({ type: "track", trackName: "Song", artistName: "Artist", score: 5, spotifyTrackId: spotifyId(), spotifyArtistId: artist });
            const review = await post(auth, "artist", "spotifyArtistId", artist);

            expect(track.status).toBe(201);
            expect(review.status).toBe(201);
        });

        // A review saved before `type` existed has no `type` at all, and still counts as a review of that track.
        it("a review from before `type` existed still blocks a second review of the same track", async () => {
            const { user, auth } = await makeUser();
            const id = spotifyId();
            await makeLegacyReview(user._id, { spotifyTrackId: id });

            const res = await post(auth, "track", "spotifyTrackId", id);

            expect(res.status).toBe(409);
        });

        it("deleting a review frees the slot", async () => {
            const { auth } = await makeUser();
            const id = spotifyId();
            const first = await post(auth, "track", "spotifyTrackId", id);
            expect(first.status).toBe(201);
            expect((await request(app).delete(`/reviews/${first.body._id}`).set(auth)).status).toBe(200);

            const again = await post(auth, "track", "spotifyTrackId", id);

            expect(again.status).toBe(201);
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [M5] follow state is fresh
// ─────────────────────────────────────────────────────────────────────────────

describe("[M5] right after a follow or an unfollow, every list says so", () => {
    const profile = (viewer: Auth, handle: string) => request(app).get(`/users/${handle}`).set(viewer);
    const follow = (viewer: Auth, handle: string) => request(app).post(`/users/${handle}/follow`).set(viewer);
    const unfollow = (viewer: Auth, handle: string) => request(app).delete(`/users/${handle}/follow`).set(viewer);
    /** The viewer makes a request, which is what puts them in the auth middleware's 4-minute cache. */
    const warm = (viewer: Auth) => request(app).get("/users/me").set(viewer);
    /** Someone's follows, written straight to the database as an earlier session would have left them. */
    const alreadyFollows = (follower: unknown, target: unknown) => User.updateOne({ _id: follower }, { $addToSet: { following: target } });

    it.failing("[M5] the profile of someone just followed says isFollowing", async () => {
        const a = await makeUser();
        const b = await makeUser();
        await warm(a.auth);

        expect((await follow(a.auth, b.user.spotifyId as string)).status).toBe(200);
        const res = await profile(a.auth, b.user.spotifyId as string);

        expect(res.body.isFollowing).toBe(true);
    });

    it.failing("[M5] the profile of someone just unfollowed says it is no longer so", async () => {
        const a = await makeUser();
        const b = await makeUser();
        await alreadyFollows(a.user._id, b.user._id);
        expect((await profile(a.auth, b.user.spotifyId as string)).body.isFollowing).toBe(true); // and now cached

        expect((await unfollow(a.auth, b.user.spotifyId as string)).status).toBe(200);
        const res = await profile(a.auth, b.user.spotifyId as string);

        expect(res.body.isFollowing).toBe(false);
    });

    it.failing("[M5] a following list marks someone just followed", async () => {
        const a = await makeUser();
        const b = await makeUser();
        const c = await makeUser();
        await alreadyFollows(b.user._id, c.user._id); // b follows c, so c is in b's list
        await warm(a.auth);

        await follow(a.auth, c.user.spotifyId as string);
        const res = await request(app).get(`/users/${b.user.spotifyId}/following`).set(a.auth);

        expect(res.body).toHaveLength(1);
        expect(res.body[0].isFollowing).toBe(true);
    });

    it.failing("[M5] a followers list marks someone just followed", async () => {
        const a = await makeUser();
        const b = await makeUser();
        const d = await makeUser();
        await alreadyFollows(d.user._id, b.user._id); // d follows b, so d is in b's followers
        await warm(a.auth);

        await follow(a.auth, d.user.spotifyId as string);
        const res = await request(app).get(`/users/${b.user.spotifyId}/followers`).set(a.auth);

        expect(res.body).toHaveLength(1);
        expect(res.body[0].isFollowing).toBe(true);
    });

    it.failing("[M5] search marks someone just followed", async () => {
        const a = await makeUser();
        const dana = await makeUser({ displayName: "Dana Findable" });
        await warm(a.auth);

        await follow(a.auth, dana.user.spotifyId as string);
        const res = await request(app).get("/users/search?q=Findable").set(a.auth);

        expect(res.body).toHaveLength(1);
        expect(res.body[0].isFollowing).toBe(true);
    });

    it("the follower count is fresh at once", async () => {
        const a = await makeUser();
        const b = await makeUser();

        await follow(a.auth, b.user.spotifyId as string);
        const res = await profile(b.auth, b.user.spotifyId as string);

        expect(res.body.followerCount).toBe(1);
    });

    it("following twice does not count twice", async () => {
        const a = await makeUser();
        const b = await makeUser();

        await follow(a.auth, b.user.spotifyId as string);
        await follow(a.auth, b.user.spotifyId as string);

        expect((await profile(b.auth, b.user.spotifyId as string)).body.followerCount).toBe(1);
    });

    it("nobody can follow themselves", async () => {
        const a = await makeUser();

        expect((await follow(a.auth, a.user.spotifyId as string)).status).toBe(400);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [M8] limits
// ─────────────────────────────────────────────────────────────────────────────

describe("[M8] displayName is 1 to 50 characters", () => {
    const register = (displayName: string) => request(app).post("/auth/register").send({ email: `${uniqueId("name")}@x.test`, displayName, password: "correct-horse-battery" });

    it.each([
        ["one character", "A"],
        ["fifty characters", "n".repeat(50)],
    ])("accepts %s", async (_label, name) => {
        expect((await register(name)).status).toBe(200);
    });

    it.failing.each([
        ["fifty-one characters", "n".repeat(51)],
        ["ten thousand characters", "n".repeat(10_000)],
    ])("[M8] refuses %s, and creates no account", async (_label, name) => {
        const before = await User.countDocuments();

        const res = await register(name);

        expect(res.status).toBe(400);
        expect(await User.countDocuments()).toBe(before);
    });
});

describe("[M8] a list has at most 100 items", () => {
    const items = (n: number) => Array.from({ length: n }, (_, i) => ({ rank: i + 1, trackName: `Song ${i}`, artistName: "Artist", spotifyTrackId: spotifyId(), type: "track" }));

    it("accepts a list of 100", async () => {
        const { auth } = await makeUser();

        const res = await request(app).post("/lists").set(auth).send({ title: "Mine", items: items(100) });

        expect(res.status).toBe(201);
    });

    it.failing("[M8] refuses a new list of 101, and stores none", async () => {
        const { user, auth } = await makeUser();

        const res = await request(app).post("/lists").set(auth).send({ title: "Mine", items: items(101) });

        expect(res.status).toBe(400);
        const stored = (await request(app).get(`/users/${user.spotifyId}/lists`)).body;
        expect(stored).toHaveLength(0);
    });

    it.failing("[M8] refuses growing a list to 101, and leaves it as it was", async () => {
        const { auth } = await makeUser();
        const made = await request(app).post("/lists").set(auth).send({ title: "Mine", items: items(3) });
        expect(made.status).toBe(201);

        const res = await request(app).put(`/lists/${made.body._id}`).set(auth).send({ items: items(101) });

        expect(res.status).toBe(400);
        const after = await request(app).get(`/lists/${made.body._id}`);
        expect(after.body.items).toHaveLength(3);
    });
});

describe("[M8] follow notifications", () => {
    const follow = (viewer: Auth, handle: string) => request(app).post(`/users/${handle}/follow`).set(viewer);
    const unfollow = (viewer: Auth, handle: string) => request(app).delete(`/users/${handle}/follow`).set(viewer);
    const unreadFollows = (recipient: Types.ObjectId) => Notification.countDocuments({ recipientId: recipient, type: "follow", read: false });

    // Following and unfollowing in a loop is a way to fill someone's notifications. One unread per follower per person.
    it.failing("[M8] five follow / unfollow cycles leave one unread notification, not five", async () => {
        const a = await makeUser();
        const b = await makeUser();

        for (let i = 0; i < 5; i++) {
            await follow(a.auth, b.user.spotifyId as string);
            await unfollow(a.auth, b.user.spotifyId as string);
        }
        await settle();

        expect(await unreadFollows(b.user._id)).toBe(1);
        const list = await request(app).get("/notifications").set(b.auth);
        expect(list.body.unreadCount).toBe(1);
    });

    it("two different followers each notify", async () => {
        const a = await makeUser();
        const c = await makeUser();
        const b = await makeUser();

        await follow(a.auth, b.user.spotifyId as string);
        await follow(c.auth, b.user.spotifyId as string);
        await settle();

        expect(await unreadFollows(b.user._id)).toBe(2);
    });

    it("a follow after the earlier notification was read notifies again", async () => {
        const a = await makeUser();
        const b = await makeUser();
        await follow(a.auth, b.user.spotifyId as string);
        await settle();
        expect((await request(app).post("/notifications/read-all").set(b.auth)).status).toBe(200);
        await unfollow(a.auth, b.user.spotifyId as string);

        await follow(a.auth, b.user.spotifyId as string);
        await settle();

        expect(await unreadFollows(b.user._id)).toBe(1);
    });
});
