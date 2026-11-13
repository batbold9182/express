import { LINK_STATE_KEY, linkStateFrom, readLinkCallback } from "../../web/src/lib/spotifyLink";

// The web half of linking a Spotify account (web/src/lib/spotifyLink.ts). Two decisions live here and both are security
// decisions, so they are pure functions with tests:
//
//   linkStateFrom(url)        /me only sends the browser to an address that really is Spotify's authorize page, and keeps the
//                             nonce from it. Anything else and the browser goes nowhere.
//   readLinkCallback(search)  /auth/callback completes a link only when the `state` in the address is the nonce THIS tab
//                             saved. A callback someone else started (a link sent to a victim), an error from the relay, or
//                             a missing piece is a failure message and no API call. Nothing in the address is ever a session.

describe("LINK_STATE_KEY", () => {
    it("names the sessionStorage slot the nonce waits in", () => {
        expect(LINK_STATE_KEY).toBe("spotify_link_state");
    });
});

describe("linkStateFrom", () => {
    const authorize = (query: string) => `https://accounts.spotify.com/authorize${query}`;

    it("returns the nonce from Spotify's authorize address", () => {
        const url = authorize("?client_id=abc&response_type=code&redirect_uri=https%3A%2F%2Fapi.test%2Fauth%2Fcallback&scope=user-top-read&state=N0nce_-123&show_dialog=true");

        expect(linkStateFrom(url)).toBe("N0nce_-123");
    });

    it("decodes the nonce as the browser would", () => {
        expect(linkStateFrom(authorize("?state=a%2Bb"))).toBe("a+b");
    });

    it.each([
        ["capitals in the host (the same origin)", "https://ACCOUNTS.SPOTIFY.COM/authorize?state=n"],
        ["the default port written out (the same origin)", "https://accounts.spotify.com:443/authorize?state=n"],
    ])("accepts %s", (_label, url) => {
        expect(linkStateFrom(url)).toBe("n");
    });

    // If the backend, or someone in the middle, ever answered with another address, /me must not send the browser there.
    it.each([
        ["another site", "https://evil.example/authorize?state=n"],
        ["Spotify over http", "http://accounts.spotify.com/authorize?state=n"],
        ["a lookalike that starts with Spotify's host", "https://accounts.spotify.com.evil.example/authorize?state=n"],
        ["Spotify's host as the user name of another site", "https://accounts.spotify.com@evil.example/authorize?state=n"],
        ["another Spotify host", "https://open.spotify.com/authorize?state=n"],
        ["another port", "https://accounts.spotify.com:8443/authorize?state=n"],
        ["another path on Spotify", "https://accounts.spotify.com/login?state=n"],
        ["a path that only starts the same", "https://accounts.spotify.com/authorize/extra?state=n"],
        ["a trailing slash on the path", "https://accounts.spotify.com/authorize/?state=n"],
        ["a javascript address", "javascript:alert(1)"],
        ["a data address", "data:text/html,<script>alert(1)</script>"],
        ["a relative address", "/authorize?state=n"],
        ["a protocol-relative address", "//accounts.spotify.com/authorize?state=n"],
        ["not an address", "not a url"],
        ["empty", ""],
    ])("refuses %s", (_label, url) => {
        expect(linkStateFrom(url)).toBeNull();
    });

    it.each([
        ["no state", authorize("?client_id=abc")],
        ["an empty state", authorize("?state=")],
        ["no query at all", authorize("")],
    ])("refuses Spotify's address with %s", (_label, url) => {
        expect(linkStateFrom(url)).toBeNull();
    });

    it.each([undefined, null, 123, true, {}, [], ["https://accounts.spotify.com/authorize?state=n"]])("refuses a non-string: %p", (value) => {
        expect(linkStateFrom(value)).toBeNull();
    });
});

describe("readLinkCallback", () => {
    const SAVED = "the-nonce-this-tab-saved";

    it("completes when the state in the address is the nonce this tab saved, and there is a code", () => {
        expect(readLinkCallback(`?state=${SAVED}&code=the-code`, SAVED)).toEqual({ kind: "complete", code: "the-code", state: SAVED });
    });

    it("reads the query with or without its question mark, in any order", () => {
        expect(readLinkCallback(`code=the-code&state=${SAVED}`, SAVED)).toEqual({ kind: "complete", code: "the-code", state: SAVED });
    });

    // The link someone else hands you: the attacker starts a link for their own account and sends the victim the address.
    // The victim's tab never saved that nonce, so the page refuses and calls nothing.
    describe("a callback this tab did not start", () => {
        it.each([
            ["another nonce", `?state=someone-elses-nonce&code=c`, SAVED],
            ["a nonce that only starts the same", `?state=${SAVED}x&code=c`, SAVED],
            ["the same nonce in another case", `?state=${SAVED.toUpperCase()}&code=c`, SAVED],
            ["no nonce saved in this tab", `?state=${SAVED}&code=c`, null],
            ["an empty saved nonce and an empty state", `?state=&code=c`, ""],
            ["an empty saved nonce", `?state=${SAVED}&code=c`, ""],
        ])("refuses %s", (_label, search, saved) => {
            const result = readLinkCallback(search, saved);

            expect(result.kind).toBe("fail");
            expect(result).not.toHaveProperty("code");
        });

        it("says the link was not started from this tab", () => {
            const result = readLinkCallback("?state=someone-elses-nonce&code=c", SAVED);

            expect(result).toEqual({ kind: "fail", message: "That Spotify link wasn't started from this tab. Try Connect Spotify again." });
        });
    });

    describe("a missing piece", () => {
        it.each([
            ["no code", `?state=${SAVED}`],
            ["an empty code", `?state=${SAVED}&code=`],
            ["no state", "?code=c"],
            ["nothing at all", ""],
        ])("refuses %s", (_label, search) => {
            expect(readLinkCallback(search, SAVED).kind).toBe("fail");
        });
    });

    describe("an error from the relay or from Spotify", () => {
        it("an expired link says so", () => {
            expect(readLinkCallback("?error=link_expired", SAVED)).toEqual({ kind: "fail", message: "That Spotify link expired. Try Connect Spotify again." });
        });

        it("a refusal at Spotify says the connection was cancelled", () => {
            expect(readLinkCallback(`?error=access_denied&state=${SAVED}`, SAVED)).toEqual({ kind: "fail", message: "Spotify connection cancelled." });
        });

        it("any other error gets a general message", () => {
            expect(readLinkCallback("?error=server_error", SAVED)).toEqual({ kind: "fail", message: "Spotify couldn't connect your account. Try again." });
        });

        // An error always wins: a callback carrying an error is never completed, whatever else it carries.
        it("wins over a matching state and a code", () => {
            expect(readLinkCallback(`?error=access_denied&state=${SAVED}&code=c`, SAVED).kind).toBe("fail");
        });

        // The message is shown in a toast. It is one of the app's own sentences, never text taken from the address.
        it.each(["<script>alert(1)</script>", "Your account was hacked, call 555-0100"])("never shows text from the address: %s", (error) => {
            const result = readLinkCallback(`?error=${encodeURIComponent(error)}`, SAVED);

            expect(result).toEqual({ kind: "fail", message: "Spotify couldn't connect your account. Try again." });
        });

        // Found 2026-11-13 by this test: the messages are looked up in a plain object, so an error named after something
        // every object inherits (`constructor`, `toString`, `__proto__`) finds that instead of nothing, and the "message"
        // handed to the toast is a function or an object, not a sentence. A crafted link to /auth/callback can do it.
        // `it.failing` until the lookup only sees the object's own keys.
        it.failing.each(["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"])("gives the general message for an error named %s", (error) => {
            const result = readLinkCallback(`?error=${error}`, SAVED);

            expect(result).toEqual({ kind: "fail", message: "Spotify couldn't connect your account. Try again." });
        });
    });

    // The old page signed a browser in from `access_token` and `spotify_id` in the address (M6, login CSRF). Whatever is in
    // the address now, the result is only ever "complete this link" or "show this message".
    it("ignores a session token in the address", () => {
        const result = readLinkCallback("?access_token=stolen-or-planted&spotify_id=attacker&expires_at=9999999999999", SAVED);

        expect(result.kind).toBe("fail");
        expect(JSON.stringify(result)).not.toContain("stolen-or-planted");
    });
});
