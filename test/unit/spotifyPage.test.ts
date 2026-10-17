import { spotifyPage } from "../../backend/routes.ts/_spotifyHeaders";

// spotifyPage(req) turns whatever the caller put in ?limit= and ?offset= into the page Spotify is asked for. Its
// output is the only thing that reaches the Spotify URL and the cache key (plan.md step 2b), so the tests state the
// promise: always whole numbers, always in range, junk means the default. The routes' own tests cover the same
// clamps through HTTP; this file is the fast, exhaustive version.

const page = (query: Record<string, unknown>) => spotifyPage({ query } as unknown as Parameters<typeof spotifyPage>[0]);

describe("spotifyPage", () => {
    it("defaults to the first page of ten", () => {
        expect(page({})).toEqual({ limit: 10, offset: 0 });
    });

    describe("limit (1-10, default 10)", () => {
        it.each([
            ["1", 1], ["2", 2], ["9", 9], ["10", 10],
            ["0", 1], ["-1", 1], ["-5", 1], ["-999999", 1],
            ["11", 10], ["50", 10], ["99", 10], ["999999999999", 10],
            ["3.9", 3], ["3.1", 3], ["0.9", 1], ["10.9", 10], ["-0.5", 1],
            ["1e1", 10], ["0.5e2", 10], ["0x5", 5], [" 7", 7], ["7 ", 7], ["+4", 4], ["04", 4],
        ])("%j becomes %i", (raw, expected) => {
            expect(page({ limit: raw }).limit).toBe(expected);
        });

        it.each([
            ["an empty string", ""],
            ["letters", "abc"],
            ["a number followed by letters", "5abc"],
            ["Infinity", "Infinity"],
            ["-Infinity", "-Infinity"],
            ["NaN", "NaN"],
            ["a number too big to be finite", "1e999"],
            ["a smuggled second parameter", "5&type=playlist"],
            ["a path", "../me"],
            ["an array (limit=1&limit=2)", ["1", "2"]],
            ["an array with one item (limit[]=3)", ["3"]],
            ["an object (limit[a]=3)", { a: "3" }],
            ["a number (not a query string value)", 3],
            ["null", null],
            ["undefined", undefined],
            ["a boolean", true],
        ])("%s means the default", (_label, raw) => {
            expect(page({ limit: raw }).limit).toBe(10);
        });
    });

    describe("offset (0-1000, default 0)", () => {
        it.each([
            ["0", 0], ["1", 1], ["10", 10], ["20", 20], ["999", 999], ["1000", 1000],
            ["1001", 1000], ["5000", 1000], ["999999999999", 1000],
            ["-1", 0], ["-5", 0], ["-999999", 0], ["-0", 0],
            ["7.9", 7], ["0.9", 0], ["1000.9", 1000], ["-0.5", 0],
            ["1e2", 100], ["0x10", 16], [" 20", 20], ["+30", 30], ["0030", 30],
        ])("%j becomes %i", (raw, expected) => {
            expect(page({ offset: raw }).offset).toBe(expected);
        });

        it.each([
            ["an empty string", ""],
            ["letters", "abc"],
            ["Infinity", "Infinity"],
            ["a number too big to be finite", "1e999"],
            ["a smuggled second parameter", "1&market=XX"],
            ["an array", ["10", "20"]],
            ["an object", { a: "3" }],
            ["null", null],
            ["undefined", undefined],
        ])("%s means the default", (_label, raw) => {
            expect(page({ offset: raw }).offset).toBe(0);
        });
    });

    it("reads the two independently: junk in one does not spoil the other", () => {
        expect(page({ limit: "abc", offset: "30" })).toEqual({ limit: 10, offset: 30 });
        expect(page({ limit: "4", offset: "abc" })).toEqual({ limit: 4, offset: 0 });
    });

    it("ignores every other query parameter", () => {
        expect(page({ q: "x", type: "track", group: "album", limit: "2", offset: "4", extra: "&limit=9" })).toEqual({ limit: 2, offset: 4 });
    });

    // Whatever comes in, only whole numbers in range come out. This is what lets the route put the result straight
    // into a URL and a cache key without escaping it.
    it("always returns whole numbers inside the range, for any input", () => {
        const inputs: unknown[] = [
            "", " ", "   ", "\n", "\t5", "0", "-0", "1", "10", "11", "1000", "1001", "0.1", "1e-7", "1e21", "9".repeat(400),
            "abc", "NaN", "Infinity", "-Infinity", "0b11", "0o7", "1_000", "٣", "５", "%20", "5%26x=1", "null", "undefined", "true",
            [], ["1"], ["1", "2"], {}, { a: 1 }, null, undefined, 0, 5, -5, 1.5, NaN, Infinity, true, false, () => 3, Symbol("s"),
        ];
        for (const limit of inputs) {
            for (const offset of inputs) {
                const result = page({ limit, offset });
                expect(Number.isInteger(result.limit)).toBe(true);
                expect(Number.isInteger(result.offset)).toBe(true);
                expect(result.limit).toBeGreaterThanOrEqual(1);
                expect(result.limit).toBeLessThanOrEqual(10);
                expect(result.offset).toBeGreaterThanOrEqual(0);
                expect(result.offset).toBeLessThanOrEqual(1000);
                expect(Object.is(result.offset, -0)).toBe(false);
                expect(`${result.limit}`).toMatch(/^\d+$/);
                expect(`${result.offset}`).toMatch(/^\d+$/);
            }
        }
    });
});
