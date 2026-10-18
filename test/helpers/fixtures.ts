import crypto from "crypto";
import { Types } from "mongoose";
import { User } from "../../backend/models/User";
import { Review } from "../../backend/models/review";
import * as authMiddleware from "../../backend/middleware/auth";

let counter = 0;

// plan.md "Session hashing (D1)": today a session token is stored as it was issued, in `accessToken`; after that change it is
// stored as its SHA-256 in `sessionHash` and the auth cache is dropped by user (`invalidateUser`) instead of by token. The
// fixtures below work on both sides of the change, so that the day it lands ~800 tests do not turn red at once. They tell
// the two apart by whether the middleware exports `invalidateUser`. (Both names come from the design; if the backend names
// them differently, this is the one place to change.)
const sessionApi = authMiddleware as unknown as { invalidateToken?: (token: string) => void; invalidateUser?: (userId: string) => void };
const sessionsAreHashed = typeof sessionApi.invalidateUser === "function";

/** The SHA-256 of a session token, as the hashed-sessions design stores it. */
export const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

/** How a session token is kept on the user document in this version of the backend. */
const storedSession = (token: string) => (sessionsAreHashed ? { sessionHash: sha256(token) } : { accessToken: token });

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

/**
 * A user in the test database, plus the `Authorization` header that `requireAuth` accepts for them. The session lasts
 * 30 days unless `tokenExpiresAt` is overridden, because a backend that enforces expiry must not refuse every fixture.
 */
export async function makeUser(overrides: Record<string, unknown> = {}) {
    const n = ++counter;
    const token = `test-token-${n}-${Math.random().toString(36).slice(2)}`;
    const user = await User.create({
        spotifyId: `test-user-${n}`,
        displayName: `Test User ${n}`,
        email: `user${n}@test.local`,
        ...storedSession(token),
        tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ...overrides,
    });
    return { user, token, auth: { Authorization: `Bearer ${token}` } };
}

/**
 * Makes a user's session look old: their `tokenExpiresAt` moves into the past, and the auth middleware's 4-minute
 * cache is dropped so the next request reads the database. (Call it before the user's first request, or
 * after — either works.) Whether the app then refuses the token is what a security test checks.
 */
export async function expireSession(userId: Types.ObjectId, token: string, agoMs = 24 * 60 * 60 * 1000) {
    await User.updateOne({ _id: userId }, { tokenExpiresAt: new Date(Date.now() - agoMs) });
    if (sessionApi.invalidateUser) sessionApi.invalidateUser(String(userId));
    else sessionApi.invalidateToken?.(token);
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
