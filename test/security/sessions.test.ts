import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../../backend/app";
import { User } from "../../backend/models/User";
import { useMemoryMongo } from "../helpers/mongo";
import { useMailerMock } from "../helpers/mailerMock";
import { useEnv } from "../helpers/env";
import { useClock } from "../helpers/clock";
import { makeUser, expireSession, uniqueId, sha256 } from "../helpers/fixtures";

// Security tests, Step 4: sessions, passwords and who is the admin. See plan.md -> "Security tests" and "Session hashing (D1)".
// Each test states the SECURE behaviour. Where the hole is open it is `it.failing`: it passes today and goes red the day the
// fix lands, at which point `express-backend` removes the marker and it becomes the permanent guard. Plain `it` is a
// guard that already holds.
//
//   [H2]  Sessions never expire (an expired token still returns 200 and /auth/refresh renews it at any age), and the token
//         is stored in the database exactly as it was issued.
//   [M7]  A password reset does not end the sessions that already exist, and passwords may be 6 characters.
//   [H1]  Whoever registers the admin's email address becomes the admin.
//
// Decisions (approved 2026-10-18): D1 sessions are stored hashed (SHA-256) and everyone signs in once more; session
// 30 days, enforced, refresh only for an unexpired session; D4 admin is the account named by `ADMIN_USER_ID`, never an
// email address; passwords are 8 to 72 BYTES, and login keeps accepting older 6 and 7 character ones.
//
// What the tests do NOT depend on: the name of the field that stores the session (`accessToken` today, `sessionHash` in the
// design). They look at the stored document as a whole.

useMemoryMongo();
const mail = useMailerMock();
const env = useEnv();
const { skipAhead } = useClock();

const PASSWORD = "correct-horse-battery";
const DAY = 24 * 60 * 60 * 1000;

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const me = (token: string) => request(app).get("/users/me").set(bearer(token));
const post = (path: string, body: unknown) => request(app).post(path).send(body as object);
const email = () => `${uniqueId("person")}@x.test`;

async function register(address: string, password = PASSWORD) {
    return post("/auth/register", { email: address, displayName: "Someone", password });
}
async function login(address: string, password = PASSWORD) {
    return post("/auth/email-login", { email: address, password });
}
/** The user document exactly as stored, with no schema between it and the test. */
const stored = (address: string) => User.collection.findOne({ email: address });

/** Registers an account and starts a password reset for it; returns the plaintext reset token that was mailed. */
async function pendingReset(address: string) {
    expect((await register(address)).status).toBe(200);
    expect((await post("/auth/forgot-password", { email: address })).status).toBe(200);
    return mail.tokenFor(address)!;
}

// ─────────────────────────────────────────────────────────────────────────────
// [H2] a session expires
// ─────────────────────────────────────────────────────────────────────────────

describe("[H2] a session has an expiry, and it is enforced", () => {
    it.failing("[H2] a session past its expiry is refused", async () => {
        const { user, token } = await makeUser();
        expect((await me(token)).status).toBe(200); // fine until it expires

        await expireSession(user._id, token);

        expect((await me(token)).status).toBe(401);
    });

    it("a session still inside its expiry works", async () => {
        const { token } = await makeUser({ tokenExpiresAt: new Date(Date.now() + 60_000) });

        expect((await me(token)).status).toBe(200);
    });

    // The auth middleware keeps a user for 4 minutes after a request. A session that expires inside that window must not
    // be served from the cache past its expiry.
    it.failing("[H2] a session that is in the cache stops working at its expiry", async () => {
        const { token } = await makeUser({ tokenExpiresAt: new Date(Date.now() + 60_000) });
        expect((await me(token)).status).toBe(200); // now cached

        skipAhead(2 * 60_000);

        expect((await me(token)).status).toBe(401);
    });

    it.each([
        ["register", async (address: string) => (await register(address)).body],
        ["email-login", async (address: string) => { await register(address); return (await login(address)).body; }],
    ])("a session issued by %s lasts 30 days", async (_name, issue) => {
        const body = await issue(email());

        expect(body.expires_at - Date.now()).toBeGreaterThan(29.9 * DAY);
        expect(body.expires_at - Date.now()).toBeLessThanOrEqual(30 * DAY);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [H2] /auth/refresh
// ─────────────────────────────────────────────────────────────────────────────

describe("[H2] POST /auth/refresh", () => {
    const refresh = (token?: string) => (token ? request(app).post("/auth/refresh").set(bearer(token)) : request(app).post("/auth/refresh"));

    it.failing("[H2] refuses an expired session, and issues no new one", async () => {
        const { user, token } = await makeUser();
        await expireSession(user._id, token);

        const res = await refresh(token);

        expect(res.status).toBe(401);
        expect(res.body.access_token).toBeUndefined();
    });

    it("renews a session that is still valid: the new token works and the old one stops", async () => {
        const { token } = await makeUser();

        const res = await refresh(token);

        expect(res.status).toBe(200);
        expect(res.body.access_token).not.toBe(token);
        expect((await me(res.body.access_token)).status).toBe(200);
        expect((await me(token)).status).toBe(401);
    });

    it("renews for 30 days", async () => {
        const { token } = await makeUser();

        const res = await refresh(token);

        expect(res.body.expires_in).toBe(30 * 24 * 60 * 60);
    });

    it("needs a token", async () => {
        expect((await refresh()).status).toBe(401);
    });

    it("identifies the caller by the token they hold, never by a spotifyId in the body", async () => {
        const a = await makeUser();
        const b = await makeUser();

        const res = await request(app).post("/auth/refresh").set(bearer(a.token)).send({ spotifyId: b.user.spotifyId });

        expect(res.status).toBe(200);
        expect((await me(b.token)).status).toBe(200); // b's session is untouched
        expect((await me(a.token)).status).toBe(401); // a's was the one renewed
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [H2] what the database holds
// ─────────────────────────────────────────────────────────────────────────────

describe("[H2] the database never holds a usable session token", () => {
    // Every way a session is issued. `address` is the account it belongs to.
    const issuers: [string, () => Promise<{ token: string; address: string }>][] = [
        ["register", async () => { const address = email(); const res = await register(address); return { token: res.body.access_token, address }; }],
        ["email-login", async () => { const address = email(); await register(address); const res = await login(address); return { token: res.body.access_token, address }; }],
        ["refresh", async () => {
            const address = email();
            const first = await register(address);
            const res = await request(app).post("/auth/refresh").set(bearer(first.body.access_token));
            expect(res.status).toBe(200);
            return { token: res.body.access_token, address };
        }],
    ];

    describe.each(issuers)("a session issued by %s", (_name, issue) => {
        it("works", async () => {
            const { token } = await issue();

            expect((await me(token)).status).toBe(200);
        });

        // A leaked database, a backup or a log line must not hand out working sessions.
        it.failing("[H2] is not stored as it was issued", async () => {
            const { token, address } = await issue();

            const doc = await stored(address);

            expect(JSON.stringify(doc)).not.toContain(token);
        });

        it.failing("[H2] is stored as its SHA-256 (D1)", async () => {
            const { token, address } = await issue();

            const doc = await stored(address);

            expect(Object.values(doc ?? {})).toContain(sha256(token));
        });

        // The point of hashing, stated as behaviour: what is stored is not itself a way in.
        it.failing("[H2] what is stored is not accepted as a token", async () => {
            const { address } = await issue();
            const doc = (await stored(address)) as { sessionHash?: string; accessToken?: string };
            const value = doc.sessionHash ?? doc.accessToken;
            expect(typeof value).toBe("string");

            const res = await me(value as string);

            expect(res.status).toBe(401);
        });
    });

    // D1: "everyone signs in once more". A session stored in plaintext, as every one issued before the change is, must no
    // longer work. (Written through the model, so it is the old format whatever the backend now writes.)
    it.failing("[D1] a session stored in plaintext by an older version no longer works", async () => {
        await User.create({
            spotifyId: "legacy-session-user",
            displayName: "Legacy",
            email: "legacy@x.test",
            accessToken: "legacy-plaintext-session-token",
            tokenExpiresAt: new Date(Date.now() + 30 * DAY),
        });

        expect((await me("legacy-plaintext-session-token")).status).toBe(401);
    });

    // Known limit, recorded rather than fixed: one session per user, so signing in again ends the earlier one.
    it("signing in again ends the earlier session (one session per user: a known limit)", async () => {
        const address = email();
        const first = (await register(address)).body.access_token;

        const second = (await login(address)).body.access_token;

        expect((await me(second)).status).toBe(200);
        expect((await me(first)).status).toBe(401);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [M7] a password reset ends the sessions that exist
// ─────────────────────────────────────────────────────────────────────────────

describe("[M7] after a password reset", () => {
    it.failing("[M7] the session that existed before is refused", async () => {
        const address = email();
        const token = (await register(address)).body.access_token;
        expect((await me(token)).status).toBe(200);
        await post("/auth/forgot-password", { email: address });
        const reset = mail.tokenFor(address)!;

        const res = await post("/auth/reset-password", { email: address, resetToken: reset, newPassword: "a-brand-new-secret" });

        expect(res.status).toBe(200);
        expect((await me(token)).status).toBe(401);
    });

    it.failing("[M7] the session that existed before cannot be refreshed either", async () => {
        const address = email();
        const token = (await register(address)).body.access_token;
        await post("/auth/forgot-password", { email: address });
        await post("/auth/reset-password", { email: address, resetToken: mail.tokenFor(address), newPassword: "a-brand-new-secret" });

        const res = await request(app).post("/auth/refresh").set(bearer(token));

        expect(res.status).toBe(401);
    });

    it("the new password signs in and the old one no longer does", async () => {
        const address = email();
        const reset = await pendingReset(address);

        await post("/auth/reset-password", { email: address, resetToken: reset, newPassword: "a-brand-new-secret" });

        const fresh = await login(address, "a-brand-new-secret");
        expect(fresh.status).toBe(200);
        expect((await me(fresh.body.access_token)).status).toBe(200);
        expect((await login(address, PASSWORD)).status).toBe(401);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [M7] password length: 8 to 72 bytes
// ─────────────────────────────────────────────────────────────────────────────

describe("[M7] password length", () => {
    // bcrypt ignores everything past 72 BYTES, so the limit is in bytes (a character such as é is two). Login keeps
    // accepting the 6 and 7 character passwords that already exist (below).
    // [label, password, status, does it already hold today]
    const lengths: [string, string, number, boolean][] = [
        ["empty", "", 400, true],
        ["5 characters", "abcde", 400, true],
        ["6 characters", "abc123", 400, false],
        ["7 characters", "abc1234", 400, false],
        ["8 characters", "abc12345", 200, true],
        ["72 bytes", "a".repeat(72), 200, true],
        ["73 bytes", "a".repeat(73), 400, false],
        ["36 two-byte characters (72 bytes)", "é".repeat(36), 200, true],
        ["37 two-byte characters (74 bytes)", "é".repeat(37), 400, false],
    ];

    describe("POST /auth/register", () => {
        for (const [label, password, status, holds] of lengths) {
            (holds ? it : it.failing)(`[M7] ${status === 200 ? "accepts" : "refuses"} ${label}${holds ? " (already holds)" : ""}`, async () => {
                const res = await register(email(), password);

                expect(res.status).toBe(status);
            });
        }
    });

    describe("POST /auth/reset-password", () => {
        for (const [label, password, status, holds] of lengths) {
            (holds ? it : it.failing)(`[M7] ${status === 200 ? "accepts" : "refuses"} ${label}${holds ? " (already holds)" : ""}`, async () => {
                const address = email();
                const reset = await pendingReset(address);

                const res = await post("/auth/reset-password", { email: address, resetToken: reset, newPassword: password });

                expect(res.status).toBe(status);
            });
        }
    });

    it.each([["6 characters", "abc123"], ["7 characters", "abc1234"]])("login still accepts an older %s password", async (_label, password) => {
        const { user } = await makeUser({ passwordHash: bcrypt.hashSync(password, 4) });

        const res = await login(user.email as string, password);

        expect(res.status).toBe(200);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [H1] who is the admin
// ─────────────────────────────────────────────────────────────────────────────

describe("[H1] GET /feedback (the admin-only route)", () => {
    const feedback = (token: string) => request(app).get("/feedback").set(bearer(token));

    // Today the admin is whoever holds the address in ADMIN_EMAIL, and an address is never verified, so anyone who
    // registers it first has the admin's rights.
    it.failing("[H1] registering the admin's email address grants no admin rights", async () => {
        env.set("ADMIN_EMAIL", "boss@example.com");
        env.set("ADMIN_USER_ID", undefined);

        const token = (await register("boss@example.com")).body.access_token;

        expect((await feedback(token)).status).toBe(403);
    });

    it.failing("[D4] the account named by ADMIN_USER_ID is the admin", async () => {
        const admin = await makeUser();
        env.set("ADMIN_USER_ID", String(admin.user._id));

        expect((await feedback(admin.token)).status).toBe(200);
    });

    it.failing("[D4] nobody else is, not even an account with the old ADMIN_EMAIL address", async () => {
        const admin = await makeUser();
        const lookalike = await makeUser({ email: "boss@example.com" });
        env.set("ADMIN_USER_ID", String(admin.user._id));
        env.set("ADMIN_EMAIL", "boss@example.com");

        expect((await feedback(lookalike.token)).status).toBe(403);
    });

    it("an ordinary account is refused", async () => {
        const { token } = await makeUser();
        env.set("ADMIN_USER_ID", undefined);

        expect((await feedback(token)).status).toBe(403);
    });

    it("nothing is open to anyone when no admin is configured", async () => {
        env.set("ADMIN_EMAIL", undefined);
        env.set("ADMIN_USER_ID", undefined);
        const { token } = await makeUser();

        expect((await feedback(token)).status).toBe(403);
    });

    it("needs a session", async () => {
        expect((await request(app).get("/feedback")).status).toBe(401);
    });
});
