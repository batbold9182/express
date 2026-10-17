import request from "supertest";
import mongoose from "mongoose";
import app from "../../backend/app";
import { User } from "../../backend/models/User";
import { Review } from "../../backend/models/review";
import { useMemoryMongo } from "../helpers/mongo";
import { useSpotifyMock } from "../helpers/spotifyMock";
import { makeUser, makeReview, makeLegacyReview, uniqueId, spotifyId } from "../helpers/fixtures";

// These test the test tools: that a route test can rely on them. The route tests themselves live beside this file.
useMemoryMongo();
const spotify = useSpotifyMock();

describe("in-memory database", () => {
    it("is a real, connected, local database", () => {
        expect(mongoose.connection.readyState).toBe(1);
        expect(mongoose.connection.host).toBe("127.0.0.1");
    });

    // Jest runs the tests in a file in order, so these two prove the afterEach clean-up as a pair.
    it("accepts data (1/2)", async () => {
        await makeUser();
        expect(await User.countDocuments()).toBe(1);
    });

    it("starts the next test empty (2/2)", async () => {
        expect(await User.countDocuments()).toBe(0);
    });
});

describe("fixtures", () => {
    it("creates users with distinct handles, emails and tokens", async () => {
        const a = await makeUser();
        const b = await makeUser();
        expect(a.user.spotifyId).not.toBe(b.user.spotifyId);
        expect(a.user.email).not.toBe(b.user.email);
        expect(a.token).not.toBe(b.token);
    });

    it("makes a legacy review with no `type`, unlike one made through the model", async () => {
        const { user } = await makeUser();
        const legacyId = await makeLegacyReview(user._id);
        const modern = await makeReview(user._id);

        const raw = await Review.collection.findOne({ _id: legacyId });
        expect(raw).not.toHaveProperty("type");
        expect(modern.type).toBe("track");
    });

    it("hands out ids that never repeat", () => {
        expect(uniqueId("t")).not.toBe(uniqueId("t"));
    });
});

describe("authenticated requests through the real app", () => {
    it("lets a fixture user through and serves the mocked Spotify response", async () => {
        const { auth } = await makeUser();
        const id = spotifyId();
        spotify.on(`/v1/tracks/${id}`, { id, name: "Song" });

        const res = await request(app).get(`/tracks/${id}`).set(auth);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ id, name: "Song" });
        expect(spotify.calls(`/v1/tracks/${id}`)).toBe(1);
        expect(spotify.lastHeaders(`/v1/tracks/${id}`)?.get("authorization")).toBe("Bearer test-app-token");
    });

    it("turns away a request with no token", async () => {
        const res = await request(app).get(`/tracks/${spotifyId()}`);
        expect(res.status).toBe(401);
        expect(spotify.calls()).toBe(0);
    });
});

describe("Spotify mock", () => {
    it("refuses a call it was not told about, and records it so the test fails", async () => {
        await expect(fetch("https://api.spotify.com/v1/tracks/nobody-mocked-this")).rejects.toThrow(/Unmocked fetch/);
        expect(spotify.unmocked).toEqual(["https://api.spotify.com/v1/tracks/nobody-mocked-this"]);
        spotify.unmocked.length = 0; // this test provoked it on purpose; without this the afterEach check would fail it
    });

    it("can fail the network call itself", async () => {
        spotify.fail("/v1/tracks/down");
        await expect(fetch("https://api.spotify.com/v1/tracks/down")).rejects.toThrow(TypeError);
    });
});
