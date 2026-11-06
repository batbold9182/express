import request from "supertest";
import app from "../../backend/app";
import { User } from "../../backend/models/User";
import { useMemoryMongo } from "../helpers/mongo";
import { useMailerMock } from "../helpers/mailerMock";
import { uniqueId } from "../helpers/fixtures";

// Email case (plan.md, decision D16, proposed by express-architect, approved by the user on 2026-11-06). The backend change was
// applied the same day (`normalizeEmail` in auth.ts) and `express-backend` removed the markers, so these are permanent guards.
// The one still `it.failing` needs the rate limiter, which does not exist yet: the limiter must count every spelling of an email as one.
//
// Before the change register, login, forgot-password and reset-password looked an email up exactly as typed, and the unique index
// is a plain one. So `Alice@x` and `alice@x` were two different accounts, a user who typed the other case could not sign in, and
// the reset for one landed in the other's inbox. The design: `normalizeEmail(s) = s.trim().toLowerCase()` on every email the routes
// read and in the rate limiter's keys; once emails are stored lowercase the existing unique index enforces case-insensitive
// uniqueness. NO folding of dots or `+tags`: that would merge different people at other providers.

useMemoryMongo();
const mail = useMailerMock();

const PASSWORD = "correct-horse-battery";
const post = (route: string, body: object, address?: string) => {
    const req = request(app).post(route).send(body);
    return address ? req.set("X-Forwarded-For", address) : req;
};
const stamp = () => uniqueId("case");
const register = (email: string) => post("/auth/register", { email, displayName: "Someone", password: PASSWORD });
const login = (email: string, password = PASSWORD) => post("/auth/email-login", { email, password });

describe("[D16] an email is the same person whatever its case", () => {
    it("signing in works with another case than the one registered", async () => {
        const n = stamp();
        expect((await register(`Alice.${n}@X.test`)).status).toBe(200);

        const res = await login(`alice.${n}@x.test`);

        expect(res.status).toBe(200);
        expect(typeof res.body.access_token).toBe("string");
    });

    it("signing in works with the case upside down", async () => {
        const n = stamp();
        expect((await register(`bob.${n}@x.test`)).status).toBe(200);

        expect((await login(`BOB.${n}@X.TEST`)).status).toBe(200);
    });

    it("spaces around the address are ignored", async () => {
        const n = stamp();
        expect((await register(`cara.${n}@x.test`)).status).toBe(200);

        expect((await login(`  cara.${n}@x.test  `)).status).toBe(200);
    });

    it("the same address in another case cannot register a second account", async () => {
        const n = stamp();
        expect((await register(`dana.${n}@x.test`)).status).toBe(200);

        const second = await register(`DANA.${n}@x.test`);

        expect(second.status).toBe(409);
        expect(await User.countDocuments({ email: new RegExp(`^dana\\.${n}@x\\.test$`, "i") })).toBe(1);
    });

    it("an email is stored lowercase and trimmed", async () => {
        const n = stamp();

        await register(`  Erin.${n}@X.test `);

        const stored = await User.collection.findOne({ email: { $regex: `^erin\\.${n}@x\\.test$`, $options: "i" } });
        expect(stored?.email).toBe(`erin.${n}@x.test`);
    });

    // Forgot password for the other case answers 200 today but sends nothing, because no account matches the spelling.
    it("forgot-password with another case sends the reset to the account's address", async () => {
        const n = stamp();
        expect((await register(`Fay.${n}@x.test`)).status).toBe(200);

        const res = await post("/auth/forgot-password", { email: `fay.${n}@x.test` });

        expect(res.status).toBe(200);
        expect(mail.sent).toHaveLength(1);
        expect(mail.sent[0].to.toLowerCase()).toBe(`fay.${n}@x.test`);
    });

    it("resetting a password with another case works, and the new password signs in", async () => {
        const n = stamp();
        expect((await register(`gus.${n}@x.test`)).status).toBe(200);
        await post("/auth/forgot-password", { email: `gus.${n}@x.test` });
        const token = mail.tokenFor(`gus.${n}@x.test`)!;

        const reset = await post("/auth/reset-password", { email: `GUS.${n}@X.TEST`, resetToken: token, newPassword: "a-brand-new-secret" });

        expect(reset.status).toBe(200);
        expect((await login(`gus.${n}@x.test`, "a-brand-new-secret")).status).toBe(200);
    });

    // Two spellings of one email must share a counter, or an attacker doubles their guesses by alternating case.
    it.failing("the rate limiter counts every spelling of an email as one", async () => {
        const n = stamp();
        const email = `hal.${n}@x.test`;
        expect((await register(email)).status).toBe(200);
        const spellings = [email, email.toUpperCase(), `Hal.${n}@x.test`, ` ${email} `];
        const statuses: number[] = [];

        for (let i = 0; i < 11; i++) statuses.push((await post("/auth/email-login", { email: spellings[i % 4], password: "wrong-password" }, "203.0.113.200")).status);

        expect(statuses).toEqual([...Array<number>(10).fill(401), 429]);
    });

    // What the design deliberately leaves alone.
    it("dots and +tags are NOT folded: they are different people", async () => {
        const n = stamp();

        const plain = await register(`ivy${n}@x.test`);
        const dotted = await register(`i.vy${n}@x.test`);
        const tagged = await register(`ivy${n}+tag@x.test`);

        expect([plain.status, dotted.status, tagged.status]).toEqual([200, 200, 200]);
    });

    it("an ordinary lowercase address still registers and signs in", async () => {
        const n = stamp();

        expect((await register(`jay.${n}@x.test`)).status).toBe(200);
        expect((await login(`jay.${n}@x.test`)).status).toBe(200);
    });
});
