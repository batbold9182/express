import { webOrigins } from "../../backend/lib/webOrigins";
import { sendPasswordReset } from "../../backend/lib/mailer";
import { useEnv } from "../helpers/env";

// `FRONTEND_WEB_BASE` is a comma-separated list of the web app's exact origins (backend/lib/webOrigins.ts). Since the Spotify
// link fix (2026-11-13) three things read it: the allowlist for where a Spotify link may send the browser back, the fixed
// target for a link that has expired (the FIRST entry), and the address in a password-reset email (also the FIRST entry).
// So a wrong value either admits an origin that is not ours or mails people a link that does not work.

const env = useEnv();
const set = (value: string | undefined) => env.set("FRONTEND_WEB_BASE", value);

describe("webOrigins", () => {
    it("is empty when nothing is configured", () => {
        set(undefined);
        expect(webOrigins()).toEqual([]);

        set("");
        expect(webOrigins()).toEqual([]);
    });

    it("reads one origin", () => {
        set("https://tunelog.test");

        expect(webOrigins()).toEqual(["https://tunelog.test"]);
    });

    it("reads a list in order, ignoring spaces, empty entries and a trailing slash", () => {
        set(" https://tunelog.test , ,https://www.tunelog.test/ ,http://localhost:5173,");

        expect(webOrigins()).toEqual(["https://tunelog.test", "https://www.tunelog.test", "http://localhost:5173"]);
    });

    it("reads the environment on every call", () => {
        set("https://a.test");
        expect(webOrigins()).toEqual(["https://a.test"]);

        set("https://b.test");
        expect(webOrigins()).toEqual(["https://b.test"]);
    });

    // An entry that is not exactly an origin is dropped, so a typo admits nothing (it does not become a looser rule).
    it.each([
        ["a path", "https://tunelog.test/app"],
        ["a query", "https://tunelog.test?x=1"],
        ["credentials", "https://user:pw@tunelog.test"],
        ["no scheme", "tunelog.test"],
        ["the default port written out", "https://tunelog.test:443"],
        ["capitals in the host", "https://Tunelog.test"],
        ["capitals in the scheme", "HTTPS://tunelog.test"],
        ["the word null", "null"],
        ["a star on its own", "*"],
    ])("drops an entry with %s", (_label, entry) => {
        set(`${entry},https://kept.test`);

        expect(webOrigins()).toEqual(["https://kept.test"]);
    });

    // Found 2026-11-13: Node's URL parser accepts `*` in a host name, so `https://*.vercel.app` counts as an exact origin
    // and stays in the list. It matches no browser (the allowlist compares whole strings, and no browser sends an Origin
    // with a star), but as the FIRST entry it is where reset emails and expired links would point. The helper's own comment
    // says "no wildcards": this states that. `it.failing` until the helper drops such an entry.
    it.failing("drops a wildcard entry", () => {
        set("https://*.vercel.app,https://kept.test");

        expect(webOrigins()).toEqual(["https://kept.test"]);
    });
});

// The reset email. `sendPasswordReset` builds a transport and sends: here the transport is replaced by one that keeps the
// message, so nothing leaves the machine (test/setup/noRealMail.ts makes the real one throw).
describe("the link in a password-reset email", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = require("nodemailer") as { createTransport: unknown };
    const sent: { to: string; html: string }[] = [];
    let original: unknown;

    beforeEach(() => {
        sent.length = 0;
        original = nodemailer.createTransport;
        nodemailer.createTransport = () => ({
            sendMail: async (message: { to: string; html: string }) => {
                sent.push(message);
            },
        });
    });
    afterEach(() => {
        nodemailer.createTransport = original;
    });

    const linkIn = (html: string) => /href="([^"]+)"/.exec(html)?.[1] ?? "";

    it("points at the web app, with the token and the address in it", async () => {
        set("https://tunelog.test");

        await sendPasswordReset("alice+tag@x.test", "the-reset-token");

        expect(sent).toHaveLength(1);
        expect(sent[0].to).toBe("alice+tag@x.test");
        const link = new URL(linkIn(sent[0].html));
        expect(link.origin).toBe("https://tunelog.test");
        expect(link.pathname).toBe("/reset-password");
        expect(link.searchParams.get("token")).toBe("the-reset-token");
        expect(link.searchParams.get("email")).toBe("alice+tag@x.test"); // the + survives: it is URL-encoded in the link
    });

    // On Render the production web origin has to be listed FIRST: that is the one reset emails use.
    it("uses the FIRST origin of the list", async () => {
        set("https://tunelog.test,https://www.tunelog.test,http://localhost:5173");

        await sendPasswordReset("a@x.test", "t");

        expect(new URL(linkIn(sent[0].html)).origin).toBe("https://tunelog.test");
    });

    it("skips a first entry that is not an origin and uses the next one", async () => {
        set("https://tunelog.test/app,https://www.tunelog.test");

        await sendPasswordReset("a@x.test", "t");

        expect(new URL(linkIn(sent[0].html)).origin).toBe("https://www.tunelog.test");
    });

    // CURRENT BEHAVIOUR, pinned so a change is noticed, not because it is wanted: with nothing usable configured the email
    // goes out with a link to http://localhost:5173, which works on the developer's machine and nowhere else. The env check
    // at boot (plan.md, order of work, step 8) is what should catch a missing or mistyped value in production.
    it("falls back to http://localhost:5173 when nothing usable is configured (current behaviour)", async () => {
        set(undefined);

        await sendPasswordReset("a@x.test", "t");

        expect(new URL(linkIn(sent[0].html)).origin).toBe("http://localhost:5173");
    });
});
