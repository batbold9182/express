import fs from "fs";
import path from "path";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../../backend/app";
import { useMemoryMongo } from "../helpers/mongo";
import { useMailerMock } from "../helpers/mailerMock";
import { useClock } from "../helpers/clock";
import { makeUser, makeReview, uniqueId } from "../helpers/fixtures";

// Security tests, Step 5: rate limiting. See plan.md -> "Security tests" -> "Numbers the tests will encode" and the
// "Rate limiter (D2)" design. Each test states the SECURE behaviour. Today nothing is limited, so each one is `it.failing`:
// it passes while the hole is open and goes red the day the limiter lands, at which point `express-backend` removes the
// marker and it becomes the permanent guard. Plain `it` is a guard that holds either way.
//
//   [H3]  No rate limiting anywhere. Login, register, forgot-password (which sends email) and reset-password can all be
//         brute-forced or spammed: 20 wrong passwords in a row were all 401, never 429.
//
// The numbers (plan.md, defaults, approved with D2 on 2026-10-18; change them here and in the plan together):
//
//   login            10 failed attempts per 15 minutes per email + address (a success is not counted), and 50 per 15 minutes per
//                    address. The 11th (51st) is a 429.
//   register         5 an hour per address.                                  forgot-password   3 an hour per email, 10 per address.
//   reset-password   10 per 15 minutes per email + address.                  writes            60 a minute per signed-in user.
//
// Why the key is email + address and not the email alone: a limit on the email alone would let anyone lock any account out by
// failing on it. Why `trust proxy` is 1: behind Render every client otherwise shares the proxy's address, so one attacker
// could 429 everybody. supertest always connects from 127.0.0.1, so a test names its client with `X-Forwarded-For`, which
// is also what proves `trust proxy` works. Nothing here depends on how the limiter is built; the backend only has to export
// `resetRateLimits()` from `middleware/rateLimit.ts` (test/setup/resetRateLimits.ts calls it before every test).

useMemoryMongo();
const mail = useMailerMock();
const { skipAhead } = useClock();

const PASSWORD = "correct-horse-battery";
const email = () => `${uniqueId("rl")}@x.test`;
/** A client address, from the range reserved for documentation. */
const ip = (last: number) => `203.0.113.${last}`;

const send = (route: string, body: object, address?: string) => {
    const req = request(app).post(route).send(body);
    return address ? req.set("X-Forwarded-For", address) : req;
};

/**
 * An account with a known password. It is made through the model with a cheap bcrypt hash (cost 4; the app's own is 10), so a
 * test that signs in a dozen times does not spend a minute hashing. The login route compares against whatever cost the hash has.
 */
async function account(address = email()) {
    await makeUser({ email: address, passwordHash: bcrypt.hashSync(PASSWORD, 4) });
    return { email: address };
}

const failedLogin = (address: string, from?: string) => send("/auth/email-login", { email: address, password: "wrong-password" }, from);
const login = (address: string, password: string, from?: string) => send("/auth/email-login", { email: address, password }, from);
const forgot = (address: string, from?: string) => send("/auth/forgot-password", { email: address }, from);
const reset = (address: string, token: string, from?: string) => send("/auth/reset-password", { email: address, resetToken: token, newPassword: "a-brand-new-secret" }, from);

/** The statuses of `n` requests, one after the other. */
async function statuses(n: number, one: (i: number) => Promise<{ status: number }>) {
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push((await one(i)).status);
    return out;
}
const same = (status: number, n: number) => Array<number>(n).fill(status);

// ─────────────────────────────────────────────────────────────────────────────
// [H3] login
// ─────────────────────────────────────────────────────────────────────────────

describe("[H3] POST /auth/email-login", () => {
    it.failing("[H3] the 11th wrong password for one email from one address is a 429", async () => {
        const { email: a } = await account();

        const results = await statuses(11, () => failedLogin(a, ip(10)));

        expect(results).toEqual([...same(401, 10), 429]);
    });

    // Otherwise a 429 would tell an attacker which addresses have an account.
    it.failing("[H3] an email with no account is limited in exactly the same way", async () => {
        const nobody = email();

        const results = await statuses(11, () => failedLogin(nobody, ip(11)));

        expect(results).toEqual([...same(401, 10), 429]);
    });

    it.failing("[H3] the 429 says how long to wait", async () => {
        const { email: a } = await account();
        await statuses(10, () => failedLogin(a, ip(12)));

        const res = await failedLogin(a, ip(12));

        expect(res.status).toBe(429);
        expect(res.body.error).toMatch(/^Too many attempts, try again in \d+ minutes?$/);
        expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
    });

    // A limit on the email alone would let an attacker keep the owner out. It is the email AND the address.
    it.failing("[H3] an attacker who exhausts an email's limit does not lock its owner out", async () => {
        const { email: a } = await account();
        const attack = await statuses(11, () => failedLogin(a, ip(13)));
        expect(attack[10]).toBe(429);

        const owner = await login(a, PASSWORD, ip(14));

        expect(owner.status).toBe(200);
    });

    it.failing("[H3] failures on one email do not stop the same address using another", async () => {
        const { email: a } = await account();
        const { email: b } = await account();
        const attack = await statuses(11, () => failedLogin(a, ip(15)));
        expect(attack[10]).toBe(429);

        const other = await login(b, PASSWORD, ip(15));

        expect(other.status).toBe(200);
    });

    it.failing("[H3] one address trying many different emails is stopped after 50 failures", async () => {
        const results = await statuses(51, () => failedLogin(email(), ip(16)));

        expect(results).toEqual([...same(401, 50), 429]);
    });

    // With `trust proxy` = 1 the limiter sees the address the one trusted proxy appended, the LAST entry. A client that
    // forges earlier entries to look like someone new stays in the same bucket.
    it.failing("[H3] forging the first X-Forwarded-For entries does not escape the limit", async () => {
        const { email: a } = await account();

        const results = await statuses(11, (i) =>
            request(app).post("/auth/email-login").send({ email: a, password: "wrong-password" }).set("X-Forwarded-For", `10.${i}.9.9, ${ip(17)}`),
        );

        expect(results).toEqual([...same(401, 10), 429]);
    });

    it.failing("[H3] the limit ends after its 15 minutes", async () => {
        const { email: a } = await account();
        const attack = await statuses(11, () => failedLogin(a, ip(18)));
        expect(attack[10]).toBe(429);

        skipAhead(16 * 60_000);
        const later = await failedLogin(a, ip(18));

        expect(later.status).toBe(401);
    });

    // Ordinary use is unaffected.
    it("a success is not counted: twelve correct sign-ins in a row all work", async () => {
        const { email: a } = await account();

        const results = await statuses(12, () => login(a, PASSWORD, ip(19)));

        expect(results).toEqual(same(200, 12));
    });

    it("a few wrong passwords and then the right one still signs in", async () => {
        const { email: a } = await account();

        await statuses(3, () => failedLogin(a, ip(20)));
        const res = await login(a, PASSWORD, ip(20));

        expect(res.status).toBe(200);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [H3] forgot-password (it sends a real email)
// ─────────────────────────────────────────────────────────────────────────────

describe("[H3] POST /auth/forgot-password", () => {
    it.failing("[H3] the 4th request for one email in an hour is a 429, and sends no email", async () => {
        const { email: a } = await account();

        const results = await statuses(4, () => forgot(a, ip(30)));

        expect(results).toEqual([200, 200, 200, 429]);
        expect(mail.sent).toHaveLength(3);
    });

    it.failing("[H3] an email with no account is limited in the same way, so a 429 tells nothing", async () => {
        const results = await statuses(4, () => forgot(email(), ip(31)));

        expect(results).toEqual([200, 200, 200, 429]);
    });

    // The limit is on the email whichever address asks, so nobody can fill an inbox from many addresses.
    it.failing("[H3] the limit is on the email, not only on the address asking", async () => {
        const { email: a } = await account();

        const results = await statuses(4, (i) => forgot(a, ip(40 + i)));

        expect(results).toEqual([200, 200, 200, 429]);
        expect(mail.sent).toHaveLength(3);
    });

    it.failing("[H3] one address asking about many different emails is stopped after 10", async () => {
        const results = await statuses(11, () => forgot(email(), ip(32)));

        expect(results).toEqual([...same(200, 10), 429]);
    });

    it("an ordinary request still sends the email", async () => {
        const { email: a } = await account();

        const res = await forgot(a, ip(33));

        expect(res.status).toBe(200);
        expect(mail.tokenFor(a)).toMatch(/^[0-9a-f]{40}$/);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [H3] register
// ─────────────────────────────────────────────────────────────────────────────

describe("[H3] POST /auth/register", () => {
    const signUp = (from: string) => send("/auth/register", { email: email(), displayName: "Someone", password: PASSWORD }, from);

    it.failing("[H3] the 6th sign-up from one address in an hour is a 429", async () => {
        const results = await statuses(6, () => signUp(ip(50)));

        expect(results).toEqual([...same(200, 5), 429]);
    });

    it.failing("[H3] another address is not affected", async () => {
        const first = await statuses(6, () => signUp(ip(51)));
        expect(first[5]).toBe(429);

        const other = await signUp(ip(52));

        expect(other.status).toBe(200);
    });

    it("five sign-ups from one address all work", async () => {
        const results = await statuses(5, () => signUp(ip(53)));

        expect(results).toEqual(same(200, 5));
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [H3] reset-password
// ─────────────────────────────────────────────────────────────────────────────

describe("[H3] POST /auth/reset-password", () => {
    it.failing("[H3] the 11th guess at a reset token for one email from one address is a 429", async () => {
        const { email: a } = await account();

        const results = await statuses(11, (i) => reset(a, `guess-${i}`, ip(60)));

        expect(results).toEqual([...same(400, 10), 429]);
    });

    // After ten wrong guesses even the right token is refused from that address, and the owner, from another address, is not.
    it.failing("[H3] a guesser stays out even with the right token, and the owner is not locked out", async () => {
        const { email: a } = await account();
        await forgot(a, ip(61));
        const token = mail.tokenFor(a)!;
        const guesses = await statuses(10, (i) => reset(a, `guess-${i}`, ip(62)));
        expect(guesses).toEqual(same(400, 10));

        const guesser = await reset(a, token, ip(62));
        const owner = await reset(a, token, ip(63));

        expect(guesser.status).toBe(429);
        expect(owner.status).toBe(200);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [H3] signed-in writes, and what is never limited
// ─────────────────────────────────────────────────────────────────────────────

describe("[H3] signed-in routes", () => {
    it.failing("[H3] the 61st write in a minute by one user is a 429, and another user is not affected", async () => {
        const owner = await makeUser();
        const review = await makeReview(owner.user._id);
        const liker = await makeUser();
        const other = await makeUser();
        const like = (auth: Record<string, string>) => request(app).post(`/reviews/${review._id}/like`).set(auth);

        const results = await statuses(61, () => like(liker.auth));

        expect(results.slice(0, 60)).not.toContain(429);
        expect(results[60]).toBe(429);
        expect((await like(other.auth)).status).not.toBe(429);
    });

    it("reading is not limited: a hundred requests in a row all work", async () => {
        const { auth } = await makeUser();

        const results = await statuses(100, () => request(app).get("/users/me").set(auth));

        expect(results).toEqual(same(200, 100));
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// The test hook
// ─────────────────────────────────────────────────────────────────────────────

describe("resetRateLimits()", () => {
    const limiterFile = path.resolve(__dirname, "../../backend/middleware/rateLimit.ts");

    // The one thing the backend must provide for tests: without it every test file would share one set of counters.
    it.failing("[H3] puts every counter back to zero", async () => {
        expect(fs.existsSync(limiterFile)).toBe(true); // backend/middleware/rateLimit.ts exists
        const signUp = () => send("/auth/register", { email: email(), displayName: "Someone", password: PASSWORD }, ip(70));
        const used = await statuses(6, signUp);
        expect(used[5]).toBe(429);

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        (require(limiterFile) as { resetRateLimits: () => void }).resetRateLimits();

        expect((await signUp()).status).toBe(200);
    });
});
