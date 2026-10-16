import request from "supertest";
import app from "../../backend/app";
import { User } from "../../backend/models/User";
import { useMemoryMongo } from "../helpers/mongo";
import { useSpotifyMock } from "../helpers/spotifyMock";
import { makeUser, uniqueId } from "../helpers/fixtures";

// KNOWN VULNERABILITIES in routes.ts/auth.ts (GET /auth/login and GET /auth/callback). See plan.md → "Spotify link
// takeover". Each test states the SECURE behaviour and is marked `it.failing`: it passes today because the hole is
// open, and goes red the day the hole is fixed — at which point delete the `.failing`, and it becomes the permanent guard.
//
// These run against the real app with Spotify mocked, as an attacker would: no Authorization header anywhere.

useMemoryMongo();
const spotify = useSpotifyMock();

const ATTACKER = { id: "attacker-spotify-id", display_name: "Attacker", email: "attacker@evil.test", images: [] };

const stateOf = (payload: object) => encodeURIComponent(Buffer.from(JSON.stringify(payload)).toString("base64"));

/** What the callback does when Spotify says the person who just authorised is `profile`. No session, no cookies. */
const callback = (query: string, profile: object) => {
    spotify.on("/v1/me", profile);
    return request(app).get(`/auth/callback?code=${uniqueId("code")}${query}`);
};

describe("linking Spotify to an account (GET /auth/callback with a linkId)", () => {
    // The victim's spotifyId is public: it is in profile URLs and in the author block of every review.
    it.failing("cannot be used by an unauthenticated visitor to attach their Spotify identity to someone else's account", async () => {
        const victim = await makeUser();

        await callback(`&state=${stateOf({ linkId: victim.user.spotifyId })}`, ATTACKER);

        const after = await User.findById(victim.user._id);
        expect(after?.realSpotifyId).toBeUndefined();
    });

    // The same hole pointed the other way. The attacker starts a link for THEIR OWN account and hands the Spotify
    // address (which carries that `state`) to the victim; if the victim approves, the VICTIM's Spotify identity is
    // attached to the ATTACKER's account — so the attacker can read the victim's now-playing, top artists and
    // Spotify email through their own login. The callback cannot tell who is finishing the flow: it is a bare
    // navigation from Spotify with no session on it.
    it.failing("cannot be used to attach a victim's Spotify identity to the attacker's account", async () => {
        const attacker = await makeUser();
        const victimsSpotify = { id: "victim-spotify-id", display_name: "Victim", email: "victim@spotify.test", images: [] };

        await callback(`&state=${stateOf({ linkId: attacker.user.spotifyId })}`, victimsSpotify);

        const after = await User.findById(attacker.user._id);
        expect(after?.realSpotifyId).toBeUndefined();
    });

    // The second half of the first attack: with the attacker's Spotify identity now sitting on the victim's account, an
    // ordinary "log in with Spotify" as the attacker lands in the victim's account and is handed a session for it.
    it.failing("cannot be chained into a login as the victim", async () => {
        const victim = await makeUser();
        await callback(`&state=${stateOf({ linkId: victim.user.spotifyId })}`, ATTACKER);

        const login = await callback("", ATTACKER);

        expect(login.headers.location).not.toContain(`spotify_id=${victim.user.spotifyId}`);
        const after = await User.findById(victim.user._id);
        expect(after?.accessToken).toBe(victim.token); // the victim's own session is untouched
    });
});

describe("the link from the report: /auth/login?redirect=<attacker's address>", () => {
    // The whole path, the way a victim would walk it: the link is built from /auth/login (which puts the redirect into
    // `state`), Spotify sends the browser back to the callback with that same `state`, and the token goes where it says.
    it.failing("does not end with the victim's session token at the attacker's address", async () => {
        const victim = await makeUser();
        const login = await request(app).get(`/auth/login?redirect=${encodeURIComponent("https://evil.example/auth/success")}`);
        expect(login.status).toBe(302);
        const state = new URL(login.headers.location).searchParams.get("state") ?? "";
        const victimsSpotifyProfile = { id: "victim-spotify-id", display_name: "Victim", email: victim.user.email, images: [] };

        const res = await callback(`&state=${encodeURIComponent(state)}`, victimsSpotifyProfile);

        expect(res.headers.location ?? "").not.toMatch(/^https:\/\/evil\.example/);
    });
});

describe("state (the OAuth CSRF check)", () => {
    // Nothing ties `state` to the browser that started the login: it is plain base64 that the callback decodes and
    // trusts, and /auth/login may send none at all. So anyone can walk a victim's browser through a callback they
    // started themselves — here a bare callback with no state — and the browser receives a session token for it.
    it.failing("refuses a callback whose state the server never issued", async () => {
        const res = await callback("", ATTACKER);

        expect(res.headers.location ?? "").not.toContain("access_token=");
    });
});

describe("the address the callback sends the session token to", () => {
    // `redirect` arrives inside `state`, which the visitor controls, and is used as-is. A victim who is tricked into
    // approving a link crafted by someone else has their fresh session token delivered to that someone else.
    it.failing("is limited to the app's own addresses", async () => {
        const victim = await makeUser();
        const victimsSpotifyProfile = { id: "victim-spotify-id", display_name: "Victim", email: victim.user.email, images: [] };

        const res = await callback(`&state=${stateOf({ redirect: "https://evil.example/collect" })}`, victimsSpotifyProfile);

        expect(res.headers.location ?? "").not.toMatch(/^https:\/\/evil\.example/);
    });
});
