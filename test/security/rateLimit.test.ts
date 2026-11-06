import fs from "fs";
import path from "path";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../../backend/app";
import { useMemoryMongo } from "../helpers/mongo";
import { useMailerMock } from "../helpers/mailerMock";
import { useClock } from "../helpers/clock";
import { makeUser, makeReview, uniqueId } from "../helpers/fixtures";

// Security tests, Step 5: rate limiting. See plan.md -> "The four designs" (Rate limiter (D2), revised 2026-11-06) and the numbers
// table. Each test states the SECURE behaviour. Today nothing is limited, so each one is `it.failing`: it passes while the hole is
// open and goes red the day the limiter lands, at which point `express-backend` removes the marker and it becomes the permanent
// guard. Plain `it` is a guard that holds either way.
//
//   [H3]  No rate limiting anywhere. Login, register, forgot-password (which sends email) and reset-password can all be
//         brute-forced or spammed: 20 wrong passwords in a row were all 401, never 429.
//
// THE RULE (express-architect, agreed with express-backend): pair every per-address limit with a key the attacker cannot rotate
// (the email, the account, or a global count). A limit on the address alone hurts honest users behind one shared address (a VPN
// exit, campus Wi-Fi, a carrier NAT) and does nothing against an attacker who gets a new address whenever they like.
//
//   login            10 failures / 15 min per email + address; 50 FAILURES / 15 min per address (successes are not counted);
//                    and a per-email THROTTLE whatever the address, checked before bcrypt: after 10 failures for an email in 15
//                    minutes, one attempt per 30 s and an immediate 429 with Retry-After for the rest. A (email, address) pair that
//                    has logged in successfully is exempt from the throttle. A success or a password reset clears the counter.
//   register         20 an hour per address; plus a global hard cap on accounts CREATED (decision D15, decided 2026-11-06 by the
//                    user: 500 an hour).
//   forgot-password  3 an hour per email (counted per request, so an unknown email is treated the same) and 10 per address; plus a
//                    global cap of about 100 emails actually SENT an hour: at the cap the reply is the same 200 and nothing is sent.
//   reset-password   10 / 15 min per email + address.                      writes   60 a minute per signed-in user (401 before 429).
//
// Bounded stores: every per-email store (failure counters, throttle slots, known pairs) is keyed on a string the caller chooses,
// so each has an entry cap (10,000 by default) with eviction or swept windows. The backend exports two test-only hooks next to
// `resetRateLimits()` (agreed with express-architect): `limiterStoreSizes(): Record<string, number>`, one entry per store, and
// `setStoreCap(n)`, which lowers every cap for the rest of the test (`resetRateLimits()` puts it back to 10,000). The test lowers
// the cap to 50 and sends hundreds of junk emails instead of 20,000, which would add a minute to the suite.
//
// Not tested here: the log lines, and the optional widening of the slot after 50 failures a day.
//
// supertest always connects from 127.0.0.1, so a test names its client with `X-Forwarded-For`, which is also what proves
// `trust proxy` = 1 works. The backend only has to export `resetRateLimits()`, `limiterStoreSizes()` and `setStoreCap()` from
// `middleware/rateLimit.ts` (test/setup/resetRateLimits.ts calls the first before every test).

useMemoryMongo();
const mail = useMailerMock();
const { skipAhead } = useClock();

const PASSWORD = "correct-horse-battery";
const email = () => `${uniqueId("rl")}@x.test`;
/** A client address, from the range reserved for documentation. */
const ip = (last: number) => `203.0.113.${last}`;
/** Another range, so a test can have hundreds of distinct clients. */
const client = (n: number) => `198.51.${100 + Math.floor(n / 250)}.${(n % 250) + 1}`;

const send = (route: string, body: object, address?: string) => {
    const req = request(app).post(route).send(body);
    return address ? req.set("X-Forwarded-For", address) : req;
};

/**
 * An account with a known password. Made through the model with a cheap bcrypt hash (cost 4; the app's own is 10), so a test that
 * signs in a dozen times does not spend a minute hashing. The login route compares against whatever cost the hash has.
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

/** Register without paying for bcrypt cost 10 on every call: the tests below make hundreds. */
const FAST_HASH = "$2a$04$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ0123";
const makeRegisterFast = () => (jest.spyOn(bcrypt, "hash") as unknown as jest.SpyInstance).mockResolvedValue(FAST_HASH);

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

    // A limit on the email alone would let an attacker keep the owner out. An owner who has signed in from an address before is
    // never locked out of it: that (email, address) pair is exempt from the throttle and bound only by its own 10 per 15 minutes.
    it.failing("[H3] an attacker who exhausts an email's limit does not lock out an owner at an address they have signed in from", async () => {
        const { email: a } = await account();
        expect((await login(a, PASSWORD, ip(14))).status).toBe(200); // the owner signs in from ip(14): a known pair
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

    // Failures only: a campus or a VPN exit where many people sign in normally must not trip the per-address limit.
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

    // ── the per-email throttle: the key an attacker with a pool of addresses cannot rotate ──
    describe("the per-email throttle, whatever the address", () => {
        // Ten failures from ten different addresses: no address-based limit is near its number.
        const spread = (a: string, n: number, base: number) => statuses(n, (i) => failedLogin(a, ip(base + i)));

        it.failing("[H3] after 10 failures from different addresses, the next attempt from yet another address is a 429 with Retry-After", async () => {
            const { email: a } = await account();

            const first = await spread(a, 10, 100);
            const eleventh = await failedLogin(a, ip(130));

            expect(first).toEqual(same(401, 10));
            expect(eleventh.status).toBe(429);
            const wait = Number(eleventh.headers["retry-after"]);
            expect(wait).toBeGreaterThan(0);
            expect(wait).toBeLessThanOrEqual(30);
        });

        it.failing("[H3] an email with no account is throttled in the same way, so a 429 tells nothing", async () => {
            const nobody = email();

            const results = await statuses(11, (i) => failedLogin(nobody, ip(140 + i)));

            expect(results).toEqual([...same(401, 10), 429]);
        });

        // Checked before the password is compared, so a refused attempt costs the server nothing (and is fast).
        it.failing("[H3] a throttled attempt never reaches bcrypt", async () => {
            const { email: a } = await account();
            const compare = jest.spyOn(bcrypt, "compare");
            await spread(a, 10, 160);
            expect(compare).toHaveBeenCalledTimes(10);

            const refused = await failedLogin(a, ip(180));

            expect(refused.status).toBe(429);
            expect(compare).toHaveBeenCalledTimes(10);
        });

        it.failing("[H3] one attempt is let through every 30 seconds", async () => {
            const { email: a } = await account();
            await spread(a, 10, 100);
            expect((await failedLogin(a, ip(131))).status).toBe(429);

            skipAhead(31_000);
            const allowed = await failedLogin(a, ip(132));
            const refusedAgain = await failedLogin(a, ip(133));

            expect(allowed.status).toBe(401); // the slot: a wrong password, but not refused
            expect(refusedAgain.status).toBe(429);
        });

        it.failing("[H3] an owner at an address they have signed in from is exempt from the throttle", async () => {
            const { email: a } = await account();
            expect((await login(a, PASSWORD, ip(190))).status).toBe(200); // known pair
            await spread(a, 10, 100);
            expect((await failedLogin(a, ip(131))).status).toBe(429); // the throttle is on

            const owner = await login(a, PASSWORD, ip(190));

            expect(owner.status).toBe(200);
        });

        // Guards: these hold today and must still hold once the limiter exists.
        it("a correct sign-in clears the counter, so earlier failures do not add up with later ones", async () => {
            const { email: a } = await account();
            const before = await spread(a, 9, 100);
            expect((await login(a, PASSWORD, ip(190))).status).toBe(200);

            const after = await spread(a, 9, 110);

            expect([...before, ...after]).toEqual(same(401, 18));
        });

        it.failing("[H3] a password reset clears the counter", async () => {
            const { email: a } = await account();
            await spread(a, 10, 100);
            expect((await failedLogin(a, ip(131))).status).toBe(429);
            await forgot(a, ip(200));
            const token = mail.tokenFor(a)!;
            expect((await reset(a, token, ip(201))).status).toBe(200);

            const next = await failedLogin(a, ip(202));

            expect(next.status).toBe(401);
        });
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

    // The per-address limit counts failures only: sixty people signing in normally from one address are all fine.
    it("sixty correct sign-ins to different accounts from one address all work", async () => {
        const accounts = await Promise.all(Array.from({ length: 60 }, () => account()));

        const results = await statuses(60, (i) => login(accounts[i].email, PASSWORD, ip(21)));

        expect(results).toEqual(same(200, 60));
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

    // A pool of addresses and a pool of emails gets past every per-email and per-address limit, and would use up Gmail's daily
    // sending limit so that real resets silently stop. A global cap on emails actually SENT; at the cap the answer stays the
    // identical 200 (a 429 only for existing accounts would reveal which emails exist) and nothing is sent.
    it.failing("[H3] after about 100 reset emails in an hour no more are sent, and the answer does not change", async () => {
        const accounts = await Promise.all(Array.from({ length: 101 }, () => account()));

        const replies = [];
        for (let i = 0; i < 101; i++) replies.push(await forgot(accounts[i].email, client(Math.floor(i / 10)))); // 10 per address

        expect(replies.map((r) => r.status)).toEqual(same(200, 101));
        expect(replies[100].body).toEqual(replies[0].body); // the same "If that email exists..." message
        expect(mail.sent).toHaveLength(100);
    }, 30_000);

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
    beforeEach(() => {
        makeRegisterFast();
    });
    const signUp = (from: string) => send("/auth/register", { email: email(), displayName: "Someone", password: PASSWORD }, from);

    // One classroom on shared Wi-Fi breaks a limit of 5.
    it.failing("[H3] the 21st sign-up from one address in an hour is a 429", async () => {
        const results = await statuses(21, () => signUp(ip(50)));

        expect(results).toEqual([...same(200, 20), 429]);
    });

    it.failing("[H3] another address is not affected", async () => {
        const first = await statuses(21, () => signUp(ip(51)));
        expect(first[20]).toBe(429);

        const other = await signUp(ip(52));

        expect(other.status).toBe(200);
    });

    it("twenty sign-ups from one address all work", async () => {
        const results = await statuses(20, () => signUp(ip(53)));

        expect(results).toEqual(same(200, 20));
    });

    // A pool of addresses gets past the per-address limit, so there is also a global hard cap on accounts CREATED (D15: the
    // user chose 500 an hour on 2026-11-06). Counted where the account is made, not per request: a refused sign-up does not use it up.
    it.failing("[H3] after 500 accounts in an hour no more are created, from any address", async () => {
        const results = await statuses(501, (i) => signUp(client(Math.floor(i / 20)))); // 20 per address, a fresh address for the 501st

        expect(results.slice(0, 500)).toEqual(same(200, 500));
        expect(results[500]).toBe(429);
    }, 60_000);
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

    // The per-user limit sits inside requireAuth, after the user is known: a request with no or a bad token is a 401 however
    // many there are, so nobody can use the limit to lock a user out by sending junk.
    it.each([
        ["no token", {} as Record<string, string>],
        ["a token nobody has", { Authorization: "Bearer not-a-real-token" }],
    ])("a write with %s is a 401 every time, never a 429", async (_label, headers) => {
        const owner = await makeUser();
        const review = await makeReview(owner.user._id);

        const results = await statuses(70, () => request(app).post(`/reviews/${review._id}/like`).set(headers));

        expect(results).toEqual(same(401, 70));
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

describe("[H3] the per-email stores are bounded", () => {
    const limiterFile = path.resolve(__dirname, "../../backend/middleware/rateLimit.ts");
    type Hooks = { limiterStoreSizes: () => Record<string, number>; setStoreCap: (n: number) => void };
    const CAP = 50;
    const overCap = (sizes: Record<string, number>) => Object.entries(sizes).filter(([, size]) => size > CAP);

    // Without a cap, an attacker who sends a different email every time grows the server's memory without limit.
    it.failing("[H3] hundreds of different junk emails leave every store at or under its cap", async () => {
        expect(fs.existsSync(limiterFile)).toBe(true); // backend/middleware/rateLimit.ts exists
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { limiterStoreSizes, setStoreCap } = require(limiterFile) as Hooks;
        setStoreCap(CAP);

        for (let i = 0; i < 200; i++) await failedLogin(email(), client(i)); // a new address each time: no per-address limit is in play
        for (let i = 0; i < 200; i++) await forgot(email(), client(300 + i));

        const sizes = limiterStoreSizes();
        expect(Object.keys(sizes).length).toBeGreaterThan(0);
        expect(Math.max(...Object.values(sizes))).toBeGreaterThan(0); // the stores are really in use, not empty by luck
        expect(overCap(sizes)).toEqual([]);
    }, 60_000);

    // The store of (email, address) pairs that have signed in is filled by SUCCESSES, so it is tested separately.
    it.failing("[H3] many different people signing in from different addresses leave the known-pairs store at or under its cap", async () => {
        expect(fs.existsSync(limiterFile)).toBe(true);
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { limiterStoreSizes, setStoreCap } = require(limiterFile) as Hooks;
        setStoreCap(CAP);
        const accounts = await Promise.all(Array.from({ length: 120 }, () => account()));

        for (let i = 0; i < 120; i++) expect((await login(accounts[i].email, PASSWORD, client(600 + i))).status).toBe(200);

        expect(overCap(limiterStoreSizes())).toEqual([]);
    }, 60_000);
});

describe("resetRateLimits()", () => {
    const limiterFile = path.resolve(__dirname, "../../backend/middleware/rateLimit.ts");

    // The one thing the backend must provide for tests: without it every test file would share one set of counters.
    it.failing("[H3] puts every counter back to zero", async () => {
        expect(fs.existsSync(limiterFile)).toBe(true); // backend/middleware/rateLimit.ts exists
        const nobody = email();
        const used = await statuses(11, () => failedLogin(nobody, ip(70)));
        expect(used[10]).toBe(429);

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        (require(limiterFile) as { resetRateLimits: () => void }).resetRateLimits();

        expect((await failedLogin(nobody, ip(70))).status).toBe(401);
    });
});
