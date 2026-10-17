import { isSpotifyId } from "../../web/src/lib/spotifyId";
import { SPOTIFY_ID } from "../../backend/routes.ts/_spotifyHeaders";

// A Spotify id is exactly 22 letters or digits. The web checks it before a catalog page makes any request (so a crafted
// link like /song/..%2Fusers%2Fme can never steer the app into calling another endpoint with the user's session), and
// the backend checks it on its Spotify routes. These tests pin the rule AND that the two copies of it agree.

const real = ["3PhoLpVuITZKcymswpck5b", "4uLU6hMCjMI75M1A2tKUQC", "0000000000000000000000", "ABCDEFGHIJKLMNOPQRSTUV", "abcdefghijklmnopqrstuv"];

const notIds: [string, unknown][] = [
    ["21 characters", "a".repeat(21)],
    ["23 characters", "a".repeat(23)],
    ["empty", ""],
    ["a hyphen", "abcdefghijklmnopqrst-u"],
    ["an underscore", "abcdefghijklmnopqrst_u"],
    ["a space", "abcdefghij lmnopqrstuv"],
    ["a dot", "abcdefghij.lmnopqrstuv"],
    ["a slash", "abcdefghij/lmnopqrstuv"],
    ["a percent sign", "abcdefghij%lmnopqrstuv"],
    ["a trailing newline", "a".repeat(22) + "\n"],
    ["a leading newline", "\n" + "a".repeat(22)],
    ["a letter outside A–Z (é)", "abcdefghijklmnopqrstué"],
    ["full-width digits", "０１２３４５６７８９０１２３４５６７８９０１"],
    ["an encoded traversal, decoded", "../me"],
    ["a traversal to another endpoint", "../users/me"],
    ["a query string", "abc?x=1"],
    ["the word null", "null"],
    ["undefined", undefined],
    ["null", null],
    ["a number", 1234567890123456789012],
    ["an object", {}],
    ["an array holding a valid id", ["3PhoLpVuITZKcymswpck5b"]],
    ["an operator object", { $ne: null }],
];

describe("isSpotifyId", () => {
    it.each(real)("accepts %s", (id) => {
        expect(isSpotifyId(id)).toBe(true);
    });

    it.each(notIds)("refuses %s", (_label, value) => {
        expect(isSpotifyId(value)).toBe(false);
    });

    it("narrows the type to string, so a caller can use the id without a cast", () => {
        const maybe: unknown = "3PhoLpVuITZKcymswpck5b";
        if (isSpotifyId(maybe)) {
            const upper: string = maybe.toUpperCase();
            expect(upper).toBe("3PHOLPVUITZKCYMSWPCK5B");
        } else {
            throw new Error("a real id was refused");
        }
    });
});

describe("the web's rule and the backend's rule agree", () => {
    // If someone changes one regex and not the other, a link the web lets through is refused by the API (or the
    // reverse). The same corpus goes through both.
    const corpus = [...real, ...notIds.map(([, v]) => v).filter((v): v is string => typeof v === "string"), "x".repeat(22), "9".repeat(22), "a".repeat(100)];

    it.each(corpus.map((s) => [s]))("gives the same answer for %j", (value) => {
        expect(isSpotifyId(value)).toBe(SPOTIFY_ID.test(value));
    });
});
