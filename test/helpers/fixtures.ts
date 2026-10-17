import { Types } from "mongoose";
import { User } from "../../backend/models/User";
import { Review } from "../../backend/models/review";
import { invalidateToken } from "../../backend/middleware/auth";

let counter = 0;

/**
 * A Spotify-style id that no other call in this test file has used.
 *
 * Use one per test: `routes.ts/_cache.ts` is a module-level Map with no reset, so reusing an id would serve one
 * test's data to the next.
 */
export const uniqueId = (prefix: string) => `${prefix}-${++counter}`;

/**
 * A well-formed Spotify id (22 letters and digits) that no other call in this test file has used. Use it for the id in a
 * route that goes to Spotify (`/tracks/:id`, `/albums/:id`, `/artists/:id`): those routes are to refuse anything that
 * is not 22 base-62 characters, so a test id such as `x-5` would stop working the day that check lands.
 */
export const spotifyId = () => (String(++counter) + "AbCdEfGhIjKlMnOpQrStUv").slice(0, 22);

/** A user in the test database, plus the `Authorization` header that `requireAuth` accepts for them. */
export async function makeUser(overrides: Record<string, unknown> = {}) {
    const n = ++counter;
    const token = `test-token-${n}-${Math.random().toString(36).slice(2)}`;
    const user = await User.create({
        spotifyId: `test-user-${n}`,
        displayName: `Test User ${n}`,
        email: `user${n}@test.local`,
        accessToken: token,
        ...overrides,
    });
    return { user, token, auth: { Authorization: `Bearer ${token}` } };
}

/**
 * Makes a user's session look old: their `tokenExpiresAt` moves into the past, and the auth middleware's 4-minute
 * cache of the token is dropped so the next request reads the database. (Call it before the user's first request, or
 * after — either works.) Whether the app then refuses the token is what a security test checks.
 */
export async function expireSession(userId: Types.ObjectId, token: string, agoMs = 24 * 60 * 60 * 1000) {
    await User.updateOne({ _id: userId }, { tokenExpiresAt: new Date(Date.now() - agoMs) });
    invalidateToken(token);
}

/** A review made through the model, so the schema's defaults apply (`type` defaults to 'track'). */
export function makeReview(userId: Types.ObjectId, overrides: Record<string, unknown> = {}) {
    return Review.create({
        userId,
        type: "track",
        spotifyTrackId: uniqueId("track"),
        trackName: "Song",
        artistName: "Artist",
        score: 7,
        ...overrides,
    });
}

/**
 * A review saved before `type` existed: no `type` field at all. It goes through the raw collection because
 * the schema's `default: 'track'` would add one. The track routes still have to match these.
 */
export async function makeLegacyReview(userId: Types.ObjectId, overrides: Record<string, unknown> = {}) {
    const doc = {
        userId,
        spotifyTrackId: uniqueId("track"),
        trackName: "Old Song",
        artistName: "Old Artist",
        score: 6,
        likes: [],
        comments: [],
        createdAt: new Date(),
        ...overrides,
    };
    const { insertedId } = await Review.collection.insertOne(doc);
    return insertedId;
}
