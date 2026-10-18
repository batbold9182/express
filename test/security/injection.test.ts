import request from "supertest";
import app from "../../backend/app";
import { User } from "../../backend/models/User";
import { Review } from "../../backend/models/review";
import { useMemoryMongo } from "../helpers/mongo";
import { useMailerMock } from "../helpers/mailerMock";
import { makeUser, makeReview, spotifyId } from "../helpers/fixtures";

// Security tests, Step 3: what the routes do with request data that is not the string they expect. See plan.md ->
// "Security tests". Each test states the SECURE behaviour. They were written as `it.failing` while the holes were open;
// the fix was applied on 2026-10-18 (plan.md, step 5) and `express-backend` removed the markers, so every test here is now a
// plain, permanent guard. (A new hole is recorded the same way: write the test as `it.failing`, and remove the marker when
// it is fixed.)
//
//   [H4]  Request bodies are not type-checked. A JSON body can send `{"$ne": null}` where a string belongs, and it goes
//         straight into a Mongo filter (login, forgot, reset, register, a comment's parentId).
//   [H4b] The same on `POST /auth/register`: `email: {"$regex": "^a"}` answers 409 for a prefix that matches an address
//         and 500 for one that matches none, so anyone can list every registered address with no login.
//   [M1]  `GET /users/search?q=` builds a regular expression from the raw query: `q=.` matches everyone, `q=(` is a 500.
//
// The decision (D3, approved 2026-10-18): plain `typeof x === 'string'` checks now, Zod in `shared/` later, and
// `mongoose.sanitizeFilter` stays off (the code relies on `$ne` / `$exists` filters). So the secure answer to a
// wrong-typed field is a 400 that changes nothing and sends no email.

useMemoryMongo();
const mail = useMailerMock();

const PASSWORD = "correct-horse-battery";

async function register(email: string, displayName = "Someone") {
    const res = await request(app).post("/auth/register").send({ email, displayName, password: PASSWORD });
    expect(res.status).toBe(200);
    return res.body as { access_token: string; spotify_id: string };
}

/** Every user document as it is stored. A refused request must leave this exactly as it was. */
const everything = async () => JSON.stringify(await User.find().sort({ _id: 1 }).lean());

const post = (path: string, body: unknown) => request(app).post(path).send(body as object);

// What a caller can put where a string belongs.
const notStrings: [string, unknown][] = [
    ["an operator object ({$ne: null})", { $ne: null }],
    ["a $regex operator", { $regex: "^a" }],
    ["an array", ["a@x.test"]],
    ["a number", 123],
    ["true", true],
];

/** One test per wrong-typed value. */
function cases(rows: [string, unknown][], title: (label: string) => string, run: (bad: unknown) => Promise<void>) {
    for (const [label, bad] of rows) it(title(label), () => run(bad));
}

// ─────────────────────────────────────────────────────────────────────────────
// [H4] login
// ─────────────────────────────────────────────────────────────────────────────

describe("[H4] POST /auth/email-login", () => {
    // With one account in the database the filter `{ email: { $ne: null } }` can only match that account, so this settles
    // what the first probe could not: the operator reaches the lookup, and the person is signed in without naming anyone.
    it("[H4] an operator in place of the email does not sign anyone in", async () => {
        await register("only@x.test");

        const res = await post("/auth/email-login", { email: { $ne: null }, password: PASSWORD });

        expect(res.status).toBe(400);
        expect(res.body.access_token).toBeUndefined();
    });

    it.each(notStrings)("[H4] refuses %s as the email, and changes nothing", async (_label, bad) => {
        await register("a@x.test");
        const before = await everything();

        const res = await post("/auth/email-login", { email: bad, password: PASSWORD });

        expect(res.status).toBe(400);
        expect(res.body.access_token).toBeUndefined();
        expect(await everything()).toBe(before);
    });

    it.each(notStrings)("[H4] refuses %s as the password, and changes nothing", async (_label, bad) => {
        await register("a@x.test");
        const before = await everything();

        const res = await post("/auth/email-login", { email: "a@x.test", password: bad });

        expect(res.status).toBe(400);
        expect(await everything()).toBe(before);
    });

    it("still signs in with an ordinary email and password", async () => {
        await register("a@x.test");

        const res = await post("/auth/email-login", { email: "a@x.test", password: PASSWORD });

        expect(res.status).toBe(200);
        expect(typeof res.body.access_token).toBe("string");
    });

    it("still answers a wrong password with 401", async () => {
        await register("a@x.test");

        const res = await post("/auth/email-login", { email: "a@x.test", password: "not-it" });

        expect(res.status).toBe(401);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [H4] forgot-password
// ─────────────────────────────────────────────────────────────────────────────

describe("[H4] POST /auth/forgot-password", () => {
    // The reset token is emailed to the operator object, so the attacker never sees it; the harm is that it overwrites
    // someone else's pending reset (a stray email, a reset link that stops working).
    it("[H4] an operator in place of the email writes no reset token onto anyone's account", async () => {
        await register("a@x.test");
        await register("b@x.test");

        await post("/auth/forgot-password", { email: { $ne: null } });

        const withToken = await User.countDocuments({ resetToken: { $exists: true } });
        expect(withToken).toBe(0);
        expect(mail.sent).toEqual([]);
    });

    it.each(notStrings)("[H4] refuses %s as the email, sends nothing and changes nothing", async (_label, bad) => {
        await register("a@x.test");
        const before = await everything();

        const res = await post("/auth/forgot-password", { email: bad });

        expect(res.status).toBe(400);
        expect(mail.sent).toEqual([]);
        expect(await everything()).toBe(before);
    });

    it("still sends a reset to a registered address", async () => {
        await register("a@x.test");

        const res = await post("/auth/forgot-password", { email: "a@x.test" });

        expect(res.status).toBe(200);
        expect(mail.tokenFor("a@x.test")).toMatch(/^[0-9a-f]{40}$/);
    });

    it("still answers an unknown address with the same 200, and sends nothing", async () => {
        const res = await post("/auth/forgot-password", { email: "nobody@x.test" });

        expect(res.status).toBe(200);
        expect(mail.sent).toEqual([]);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [H4] reset-password
// ─────────────────────────────────────────────────────────────────────────────

describe("[H4] POST /auth/reset-password", () => {
    // A real reset is pending for a@x.test, so the only thing wrong with each request below is the one field.
    async function pendingReset() {
        await register("a@x.test");
        await post("/auth/forgot-password", { email: "a@x.test" });
        const token = mail.tokenFor("a@x.test")!;
        return { token, before: await everything() };
    }

    const field = (name: "email" | "resetToken" | "newPassword") =>
        cases(notStrings, (label) => `[H4] refuses ${label} as the ${name}, and changes nothing`, async (bad) => {
            const { token, before } = await pendingReset();
            const body = { email: "a@x.test", resetToken: token, newPassword: "a-new-secret-1", [name]: bad };

            const res = await post("/auth/reset-password", body);

            expect(res.status).toBe(400);
            expect(await everything()).toBe(before);
        });

    field("email");
    field("resetToken");
    field("newPassword");

    it("still resets the password with the real token", async () => {
        const { token } = await pendingReset();

        const res = await post("/auth/reset-password", { email: "a@x.test", resetToken: token, newPassword: "a-new-secret-1" });

        expect(res.status).toBe(200);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [H4] [H4b] register
// ─────────────────────────────────────────────────────────────────────────────

describe("[H4b] POST /auth/register: the email harvest", () => {
    // Today a prefix that matches an address answers 409 "Email already in use" and one that matches none answers 500, so
    // extending the prefix one character at a time recovered a full address in 205 requests and 31 seconds, with no login.
    it("[H4b] an operator email gives the same refusal whether or not it matches an address", async () => {
        await register("alice@x.test");

        const matching = await post("/auth/register", { email: { $regex: "^a" }, displayName: "Probe", password: PASSWORD });
        const notMatching = await post("/auth/register", { email: { $regex: "^zzz" }, displayName: "Probe", password: PASSWORD });

        expect(matching.status).toBe(400);
        expect(notMatching.status).toBe(400);
        expect(matching.body).toEqual(notMatching.body);
    });

    it.each(notStrings)("[H4b] refuses %s as the email, and creates no account", async (_label, bad) => {
        await register("alice@x.test");
        const before = await everything();

        const res = await post("/auth/register", { email: bad, displayName: "Probe", password: PASSWORD });

        expect(res.status).toBe(400);
        expect(await everything()).toBe(before);
    });

    it("an ordinary duplicate email still gets the normal 409", async () => {
        await register("alice@x.test");

        const res = await post("/auth/register", { email: "alice@x.test", displayName: "Again", password: PASSWORD });

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: "Email already in use" });
    });

    it("an ordinary new address still registers", async () => {
        const res = await post("/auth/register", { email: "new@x.test", displayName: "New", password: PASSWORD });

        expect(res.status).toBe(200);
    });
});

describe("[H4] POST /auth/register: the other fields", () => {
    it.each(notStrings)("[H4] refuses %s as the displayName, and creates no account", async (_label, bad) => {
        const res = await post("/auth/register", { email: "a@x.test", displayName: bad, password: PASSWORD });

        expect(res.status).toBe(400);
        expect(await User.countDocuments()).toBe(0);
    });

    cases(notStrings, (label) => `[H4] refuses ${label} as the password, and creates no account`, async (bad) => {
        const res = await post("/auth/register", { email: "a@x.test", displayName: "Someone", password: bad });

        expect(res.status).toBe(400);
        expect(await User.countDocuments()).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [H4] a comment's parentId and text
// ─────────────────────────────────────────────────────────────────────────────

describe("[H4] POST /reviews/:id/comments", () => {
    async function reviewWithOneComment() {
        const { user, auth } = await makeUser();
        const review = await makeReview(user._id);
        const first = await request(app).post(`/reviews/${review._id}/comments`).set(auth).send({ text: "first" });
        expect(first.status).toBe(200);
        return { review, auth, commentId: first.body[0]._id as string };
    }
    const commentCount = async (id: unknown) => (await Review.findById(id))?.comments.length;

    // An operator reaches the lookup (`'comments._id': { $exists: true }` finds the review) and then the push, which
    // fails as a 500; a made-up id fails the lookup itself as a 500.
    const badParents: [string, unknown][] = [
        ["an operator object", { $ne: null }],
        ["an $exists operator", { $exists: true }],
        ["a number", 123],
        ["a string that is not an id", "not-an-id"],
    ];

    it.each(badParents)("[H4] refuses %s as the parentId, and adds nothing", async (_label, bad) => {
        const { review, auth } = await reviewWithOneComment();

        const res = await request(app).post(`/reviews/${review._id}/comments`).set(auth).send({ text: "reply", parentId: bad });

        expect(res.status).toBe(400);
        expect(await commentCount(review._id)).toBe(1);
    });

    it("[H4] refuses an object as the text, and adds nothing", async () => {
        const { review, auth } = await reviewWithOneComment();

        const res = await request(app).post(`/reviews/${review._id}/comments`).set(auth).send({ text: { $ne: null } });

        expect(res.status).toBe(400);
        expect(await commentCount(review._id)).toBe(1);
    });

    it("still adds a reply to a real comment", async () => {
        const { review, auth, commentId } = await reviewWithOneComment();

        const res = await request(app).post(`/reviews/${review._id}/comments`).set(auth).send({ text: "reply", parentId: commentId });

        expect(res.status).toBe(200);
        expect(await commentCount(review._id)).toBe(2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [H4] a review's ids and type. The ids were closed by the Spotify-id check (security step 2): guards that already hold.
// ─────────────────────────────────────────────────────────────────────────────

describe("[H4] POST /reviews: operators in a review body", () => {
    const review = (over: Record<string, unknown>) => ({ type: "track", trackName: "Song", artistName: "Artist", score: 5, ...over });

    it.each(["spotifyTrackId", "spotifyAlbumId", "spotifyArtistId"])("[H4] refuses an operator object as %s, and does not match an existing review", async (field) => {
        const { user, auth } = await makeUser();
        await makeReview(user._id, { spotifyTrackId: spotifyId() });
        const before = await Review.countDocuments();

        const res = await request(app).post("/reviews").set(auth).send(review({ spotifyTrackId: spotifyId(), [field]: { $ne: null } }));

        expect(res.status).toBe(400); // not 409: the operator did not find the existing review
        expect(await Review.countDocuments()).toBe(before);
    });

    it("[H4] refuses an operator object as the type, and creates nothing", async () => {
        const { auth } = await makeUser();

        const res = await request(app).post("/reviews").set(auth).send(review({ type: { $ne: "x" }, spotifyTrackId: spotifyId() }));

        expect(res.status).toBe(400);
        expect(await Review.countDocuments()).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// [M1] user search
// ─────────────────────────────────────────────────────────────────────────────

describe("[M1] GET /users/search", () => {
    async function people() {
        await makeUser({ displayName: "Alice" });
        await makeUser({ displayName: "Bob" });
        await makeUser({ displayName: "A.B Dot" });
        await makeUser({ displayName: "Carol (band)" });
    }
    const names = (body: { displayName: string }[]) => body.map((u) => u.displayName).sort();
    const search = (q: string) => request(app).get(`/users/search?q=${encodeURIComponent(q)}`);

    // The query is a regular expression today, so `.` is "any character" and matches every name.
    it("[M1] matches the text literally: a dot is a dot", async () => {
        await people();

        const res = await search(".");

        expect(res.status).toBe(200);
        expect(names(res.body)).toEqual(["A.B Dot"]);
    });

    // Each is searched as the characters typed. Most appear in no name; a lone ( or ) really is in "Carol (band)".
    const regexy: [string, string, string[]][] = [
        ["a lone opening parenthesis", "(", ["Carol (band)"]],
        ["a lone closing parenthesis", ")", ["Carol (band)"]],
        ["a lone opening bracket", "[", []],
        ["a lone star", "*", []],
        ["a lone plus", "+", []],
        ["a trailing backslash", "\\", []],
        ["dot-star", ".*", []],
        ["an alternation", "alice|bob", []],
        ["a start anchor", "^A", []],
        ["a group", "(Alice)", []],
    ];

    it.each(regexy)("[M1] treats %s as plain text", async (_label, q, expected) => {
        await people();

        const res = await search(q);

        expect(res.status).toBe(200);
        expect(names(res.body)).toEqual(expected);
    });

    it("[M1] two q parameters are not a server error", async () => {
        await people();

        const res = await request(app).get("/users/search?q=a&q=b");

        expect(res.status).toBeLessThan(500);
    });

    // `buildReviewFilter` (user.ts) does `q?.trim()` on a value typed as a string, so a repeated q is an array and the
    // route answers 500. Found by express-backend while fixing the search above; the same one-line check applies.
    it.each([["a user's own review list", "/users/me/reviews"], ["another user's review list", "/users/__ID__/reviews"]])(
        "[M1] a repeated q on %s is not a server error",
        async (_label, path) => {
            const { user, auth } = await makeUser();

            const res = await request(app).get(`${path.replace("__ID__", user.spotifyId as string)}?q=a&q=b`).set(auth);

            expect(res.status).toBeLessThan(500);
        },
    );

    it("a pattern in q on a review list is searched as text, not a server error", async () => {
        const { auth } = await makeUser();

        const res = await request(app).get("/users/me/reviews?q=%28").set(auth);

        expect(res.status).toBe(200);
    });

    it("still finds a name by part of it, ignoring case", async () => {
        await people();

        const res = await search("ali");

        expect(names(res.body)).toEqual(["Alice"]);
    });

    it("still finds a name that really contains regex characters, as typed", async () => {
        await people();

        const res = await search("(band)");

        expect(names(res.body)).toEqual(["Carol (band)"]);
    });

    it("still answers an empty query with an empty list", async () => {
        await people();

        const res = await search("");

        expect(res.body).toEqual([]);
    });
});
