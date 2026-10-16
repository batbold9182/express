import crypto from "crypto";
import request from "supertest";
import app from "../../backend/app";
import { User } from "../../backend/models/User";
import handler from "../../web/api/r";
import { realMail } from "../setup/noRealMail";
import { useMemoryMongo } from "../helpers/mongo";
import { useSpotifyMock } from "../helpers/spotifyMock";
import { useMailerMock } from "../helpers/mailerMock";
import { useEnv } from "../helpers/env";
import { fakeReq, fakeRes } from "../helpers/fakeHttp";
import { makeUser, expireSession } from "../helpers/fixtures";

// These test the tools the security tests are built from, so a security test can rely on them.

useMemoryMongo();
const mail = useMailerMock();
const env = useEnv();

describe("useMailerMock", () => {
    it("captures the plaintext reset token, which is the real one: it resets the password", async () => {
        const { user } = await makeUser();

        const forgot = await request(app).post("/auth/forgot-password").send({ email: user.email });
        expect(forgot.status).toBe(200);

        const token = mail.tokenFor(user.email);
        expect(token).toMatch(/^[0-9a-f]{40}$/);

        // the database holds only a hash of it
        const stored = await User.findById(user._id).select("resetToken");
        expect(stored?.resetToken).toBe(crypto.createHash("sha256").update(token!).digest("hex"));
        expect(stored?.resetToken).not.toBe(token);

        const reset = await request(app).post("/auth/reset-password").send({ email: user.email, resetToken: token, newPassword: "a-new-secret" });
        expect(reset.status).toBe(200);
        const login = await request(app).post("/auth/email-login").send({ email: user.email, password: "a-new-secret" });
        expect(login.status).toBe(200);
    });

    it("sends nothing for an address that has no account", async () => {
        const res = await request(app).post("/auth/forgot-password").send({ email: "nobody@x.test" });
        expect(res.status).toBe(200);
        expect(mail.sent).toEqual([]);
        expect(mail.tokenFor("nobody@x.test")).toBeUndefined();
    });
});

describe("the no-real-mail safety net (test/setup/noRealMail.ts)", () => {
    it("removes the Gmail credentials from the environment", () => {
        expect(process.env.GMAIL_USER).toBeUndefined();
        expect(process.env.GMAIL_PASS).toBeUndefined();
    });

    it("refuses to build a mail transport and counts the attempt, which fails the test that made it", () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nodemailer = require("nodemailer");

        expect(() => nodemailer.createTransport({ service: "gmail" })).toThrow(/real email/);
        expect(realMail.attempts).toBe(1);

        realMail.attempts = 0; // this test provoked it on purpose; without this the afterEach check would fail it
    });
});

describe("useEnv", () => {
    // Jest runs the tests in a file in order, so these two prove the restore as a pair.
    it("sets a variable for one test (1/2)", () => {
        env.set("ADMIN_EMAIL", "boss@example.com");
        env.set("SECURITY_HARNESS_PROBE", "on");
        expect(process.env.ADMIN_EMAIL).toBe("boss@example.com");
    });

    it("puts it back afterwards (2/2)", () => {
        expect(process.env.ADMIN_EMAIL).toBeUndefined();
        expect(process.env.SECURITY_HARNESS_PROBE).toBeUndefined();
    });

    it("can remove a variable too, and restores that as well", () => {
        env.set("PATH_BEFORE_PROBE", "x");
        env.set("PATH_BEFORE_PROBE", undefined);
        expect(process.env.PATH_BEFORE_PROBE).toBeUndefined();
    });
});

describe("useSpotifyMock().tokenReply", () => {
    const spotify = useSpotifyMock();
    const tokenEndpoint = "https://accounts.spotify.com/api/token";

    it("makes Spotify's token endpoint fail, and counts the calls", async () => {
        spotify.tokenReply(400, { error: "invalid_grant", error_description: "Invalid authorization code" });

        const res = await fetch(tokenEndpoint, { method: "POST" });

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "invalid_grant", error_description: "Invalid authorization code" });
        expect(spotify.tokenCalls()).toBe(1);
    });

    it("is a success again in the next test", async () => {
        const res = await fetch(tokenEndpoint, { method: "POST" });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ access_token: "test-app-token", expires_in: 3600 });
    });
});

describe("expireSession", () => {
    it("moves tokenExpiresAt into the past", async () => {
        const { user, token } = await makeUser({ tokenExpiresAt: new Date(Date.now() + 30 * 86_400_000) });

        await expireSession(user._id, token);

        const after = await User.findById(user._id).select("tokenExpiresAt");
        expect(after!.tokenExpiresAt!.getTime()).toBeLessThan(Date.now());
    });
});

describe("fakeReq / fakeRes drive the real share-page handler (web/api/r.ts)", () => {
    const review = { trackName: "Song One", artistName: "Artist A", score: 8.5, text: "great", userId: { displayName: "Ann" } };

    it("serves the page shell with the review's Open Graph tags", async () => {
        jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
            const url = String(input);
            if (url.includes("/reviews/")) return new Response(JSON.stringify(review));
            if (url.endsWith("/index.html")) return new Response("<html><head><title>placeholder</title></head><body></body></html>");
            throw new Error("unexpected fetch: " + url);
        });
        const res = fakeRes();

        await handler(fakeReq({ query: { id: "r1" } }), res);

        expect(res.statusCode).toBe(200);
        expect(res.headers["content-type"]).toContain("text/html");
        expect(String(res.body)).toContain('property="og:title" content="&quot;Song One&quot; by Artist A');
        expect(String(res.body)).toContain("8.5/10");
    });

    it("falls back to the generic page when the review cannot be fetched", async () => {
        jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
            if (String(input).endsWith("/index.html")) return new Response("<html><head></head><body></body></html>");
            return new Response("not found", { status: 404 });
        });
        const res = fakeRes();

        await handler(fakeReq({ query: { id: "missing" } }), res);

        expect(res.statusCode).toBe(200);
        expect(String(res.body)).toContain("express — rate music, build your taste");
    });
});
