import { isReviewId, hasScore, safeCover } from "../../web/api/_share";

// web/api/_share.ts is the one place the two share-link functions (web/api/r.ts, the page, and web/api/og.ts, its image)
// decide what to trust: a review id goes into an API path, a score is printed, a cover is fetched by Vercel's server.
// (security.md L3.) Pure, so it is tested here; the functions themselves are in test/security/web.test.ts.

describe("isReviewId", () => {
    it.each(["507f1f77bcf86cd799439011", "ABCDEF0123456789abcdef01", "000000000000000000000000", "ffffffffffffffffffffffff"])("accepts %s", (id) => {
        expect(isReviewId(id)).toBe(true);
    });

    it.each([
        ["23 characters", "507f1f77bcf86cd79943901"],
        ["25 characters", "507f1f77bcf86cd7994390111"],
        ["24 characters that are not hex", "x".repeat(24)],
        ["one non-hex character", "507f1f77bcf86cd79943901g"],
        ["empty", ""],
        ["a climb", "../users/me"],
        ["a good id and a path", "507f1f77bcf86cd799439011/../.."],
        ["a good id and a query", "507f1f77bcf86cd799439011?x=1"],
        ["a good id and a fragment", "507f1f77bcf86cd799439011#x"],
        ["a good id and a trailing newline", "507f1f77bcf86cd799439011\n"],
        ["a good id and a space", "507f1f77bcf86cd799439011 "],
        ["encoded dots and slashes", "%2e%2e%2fusers%2fme"],
        ["full-width digits", "５０７f1f77bcf86cd799439011"],
    ])("refuses %s", (_label, id) => {
        expect(isReviewId(id)).toBe(false);
    });

    it.each([undefined, null, 123, true, {}, [], ["507f1f77bcf86cd799439011"], { toString: () => "507f1f77bcf86cd799439011" }])("refuses a non-string: %p", (value) => {
        expect(isReviewId(value)).toBe(false);
    });
});

describe("hasScore", () => {
    it.each([0, 5, 8.5, 10, -1, 0.1])("accepts the number %p", (n) => {
        expect(hasScore(n)).toBe(true);
    });

    it.each([undefined, null, NaN, Infinity, -Infinity, "8.5", "", true, {}, []])("refuses %p", (value) => {
        expect(hasScore(value)).toBe(false);
    });
});

describe("safeCover", () => {
    it.each([
        ["https://i.scdn.co/image/ab67616d0000b273", "https://i.scdn.co/image/ab67616d0000b273"],
        ["https://i.scdn.co/image/ab67616d0000b273?size=large", "https://i.scdn.co/image/ab67616d0000b273?size=large"],
        ["https://I.SCDN.CO/image/x", "https://i.scdn.co/image/x"], // the host is lower-cased before it is compared
    ])("draws %s", (given, drawn) => {
        expect(safeCover(given)).toBe(drawn);
    });

    it.each([
        ["our host over http", "http://i.scdn.co/image/x"],
        ["another site", "https://evil.example/image/x"],
        ["a path that only mentions our host", "https://evil.example/i.scdn.co/x"],
        ["a lookalike that starts with ours", "https://i.scdn.co.evil.example/x"],
        ["a subdomain of ours", "https://sub.i.scdn.co/x"],
        ["our host with a trailing dot", "https://i.scdn.co./x"],
        ["our host on another port", "https://i.scdn.co:8443/x"],
        ["credentials in the address", "https://user:pw@i.scdn.co/x"],
        ["ours as the user name of another host", "https://i.scdn.co@evil.example/x"],
        ["ours as a fragment of another host", "https://evil.example#.i.scdn.co/"],
        ["a Cyrillic lookalike of our host", "https://i.sсdn.co/x"],
        ["a data URL", "data:image/png;base64,AAAA"],
        ["a javascript URL", "javascript:alert(1)"],
        ["a protocol-relative address", "//i.scdn.co/x"],
        ["a relative path", "/image/x"],
        ["an internal address", "http://169.254.169.254/latest/meta-data/"],
        ["a file", "file:///etc/passwd"],
        ["empty", ""],
        ["not an address", "not a url"],
    ])("does not draw %s", (_label, given) => {
        expect(safeCover(given)).toBeNull();
    });

    it.each([undefined, null, 123, true, {}, []])("does not draw a non-string: %p", (value) => {
        expect(safeCover(value)).toBeNull();
    });
});
