import { normalizeEmail as webNormalize, EMAIL_INPUT } from "../../web/src/lib/email";
import { normalizeEmail as serverNormalize } from "../../backend/routes.ts/auth";

// Decision D16: an email is the same person whatever its case or surrounding spaces. The server is the authority
// (`normalizeEmail` in backend/routes.ts/auth.ts); the web does the same before sending (web/src/lib/email.ts) so that what the
// user sees confirmed is what was stored. If the two ever disagree, a person could sign in on one and not the other.

describe("web normalizeEmail", () => {
    it.each([
        ["alice@x.test", "alice@x.test"],
        ["Alice@X.test", "alice@x.test"],
        ["ALICE@X.TEST", "alice@x.test"],
        ["  alice@x.test  ", "alice@x.test"],
        ["\talice@x.test\n", "alice@x.test"],
        ["   ", ""],
        ["", ""],
    ])("turns %j into %j", (given, expected) => {
        expect(webNormalize(given)).toBe(expected);
    });

    // Not folded: at other providers these are different people.
    it.each([
        ["A.B+tag@X.com", "a.b+tag@x.com"],
        ["a.b@x.com", "a.b@x.com"],
        ["ab@x.com", "ab@x.com"],
    ])("keeps dots and +tags: %j becomes %j", (given, expected) => {
        expect(webNormalize(given)).toBe(expected);
    });

    it("keeps spaces inside the address (the server will refuse it, not rewrite it)", () => {
        expect(webNormalize("a b@x.test")).toBe("a b@x.test");
    });

    it("is idempotent", () => {
        const once = webNormalize("  MiXeD@Case.TEST ");

        expect(webNormalize(once)).toBe(once);
    });
});

describe("the web and the server agree on every string", () => {
    const corpus = [
        "alice@x.test", "Alice@X.test", "  ALICE@X.TEST\n", "a.b+tag@Gmail.com", "", " ", "\t\n", "İstanbul@x.test", "ÀÉÎ@x.test", "ǅ@x.test",
        "a b@x.test", "ß@x.test", "ΑΣ@x.test", "name@EXAMPLE.COM ", " nbsp@x.test", "x".repeat(300) + "@X.test",
    ];

    it.each(corpus.map((s) => [s]))("gives the same answer for %j", (s) => {
        expect(webNormalize(s)).toBe(serverNormalize(s));
    });

    // The server answers '' for anything that is not a non-empty string, which the routes turn into a 400.
    it.each([undefined, null, 123, true, {}, [], ["a@x.test"], { $ne: null }])("the server answers an empty string for %p", (value) => {
        expect(serverNormalize(value)).toBe("");
    });
});

describe("EMAIL_INPUT", () => {
    it("asks the browser for an email box with no auto-capital, no autocorrect and no spell check", () => {
        expect(EMAIL_INPUT).toEqual({ type: "email", autoCapitalize: "none", autoCorrect: "off", spellCheck: false, autoComplete: "email" });
    });
});
