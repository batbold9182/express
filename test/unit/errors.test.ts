import { describeError, isNotFound, mutationMessage } from "../../web/src/lib/errors";

// What the web tells the user when a request fails. These sentences are what a person reads on a cold start, a
// wrong password or a rate limit, so the mapping is worth pinning. `errors.ts` is pure (no import.meta), which is
// why the root Jest suite can load it; `lib/api.ts` and `queries/client.ts` re-export these functions.

const GENERIC = "Something went wrong.";
const OUR_SIDE = "Something went wrong on our side.";
const TIMEOUT = "The server is taking too long to respond.";
const NETWORK = "Can't reach the server. Check your connection.";
const TOO_MANY = "Too many requests — wait a moment and try again.";

describe("describeError", () => {
    it("says the server is slow when the request timed out", () => {
        expect(describeError({ code: "timeout" })).toBe(TIMEOUT);
    });

    it("says the server cannot be reached when the network failed", () => {
        expect(describeError({ code: "network" })).toBe(NETWORK);
    });

    it("tells the user to wait on a 429", () => {
        expect(describeError({ status: 429 })).toBe(TOO_MANY);
    });

    it.each([500, 502, 503, 599])("blames our side for a %i", (status) => {
        expect(describeError({ status })).toBe(OUR_SIDE);
    });

    // A 4xx other than 429 carries no sentence of its own here; the caller decides what to show.
    it.each([400, 401, 403, 404, 409, 422])("gives the generic sentence for a %i", (status) => {
        expect(describeError({ status })).toBe(GENERIC);
    });

    it("lets the code win over the status", () => {
        expect(describeError({ code: "timeout", status: 500 })).toBe(TIMEOUT);
        expect(describeError({ code: "network", status: 429 })).toBe(NETWORK);
    });

    it("works on a real Error carrying a status", () => {
        expect(describeError(Object.assign(new Error("429 /x"), { status: 429 }))).toBe(TOO_MANY);
    });

    it.each([undefined, null, {}, "boom", 42, { status: 0 }])("gives the generic sentence for %p", (value) => {
        expect(describeError(value)).toBe(GENERIC);
    });
});

describe("mutationMessage", () => {
    describe("a 4xx that carries the server's own explanation", () => {
        it.each([
            [401, "Invalid email or password"],
            [409, "Email already in use"],
            [400, "text is required"],
            [403, "Forbidden"],
            [429, "Too many attempts, try again in 15 minutes"],
        ])("shows it for a %i", (status, error) => {
            expect(mutationMessage({ status, body: { error } })).toBe(error);
        });

        it("covers the whole 4xx range, and nothing outside it", () => {
            expect(mutationMessage({ status: 399, body: { error: "x" } })).toBe(GENERIC);
            expect(mutationMessage({ status: 400, body: { error: "x" } })).toBe("x");
            expect(mutationMessage({ status: 499, body: { error: "x" } })).toBe("x");
            expect(mutationMessage({ status: 500, body: { error: "x" } })).toBe(OUR_SIDE);
        });
    });

    describe("a 4xx with nothing to show falls back to describeError", () => {
        it("a 429 with no body asks the user to wait", () => {
            expect(mutationMessage({ status: 429 })).toBe(TOO_MANY);
        });

        it.each([401, 404, 409])("a %i with no body is the generic sentence", (status) => {
            expect(mutationMessage({ status })).toBe(GENERIC);
        });

        it("an empty or missing error text does not count as an explanation", () => {
            expect(mutationMessage({ status: 409, body: { error: "" } })).toBe(GENERIC);
            expect(mutationMessage({ status: 409, body: {} })).toBe(GENERIC);
            expect(mutationMessage({ status: 429, body: { error: "" } })).toBe(TOO_MANY);
        });
    });

    // A 5xx body can be an internal message (a stack, a database error); it must never reach the user.
    describe("a 5xx", () => {
        it.each([500, 502, 503])("never shows the server's text for a %i", (status) => {
            expect(mutationMessage({ status, body: { error: "MongoServerError: connection 7 to atlas-shard-00 closed" } })).toBe(OUR_SIDE);
        });
    });

    describe("no response at all", () => {
        it("a timeout and a network failure use their own sentences", () => {
            expect(mutationMessage({ code: "timeout" })).toBe(TIMEOUT);
            expect(mutationMessage({ code: "network" })).toBe(NETWORK);
        });

        it("ignores a body when there was no status", () => {
            expect(mutationMessage({ code: "network", body: { error: "never shown" } })).toBe(NETWORK);
        });
    });

    it.each([undefined, null, {}, "boom"])("gives the generic sentence for %p", (value) => {
        expect(mutationMessage(value)).toBe(GENERIC);
    });
});

describe("isNotFound", () => {
    // Spotify answers a malformed id with 400 rather than 404, and the proxy routes pass that through.
    it.each([404, 400])("is true for a %i", (status) => {
        expect(isNotFound({ status })).toBe(true);
    });

    it.each([401, 403, 409, 429, 500, 502])("is false for a %i", (status) => {
        expect(isNotFound({ status })).toBe(false);
    });

    it("is false when the request itself failed", () => {
        expect(isNotFound({ code: "timeout" })).toBe(false);
        expect(isNotFound({ code: "network" })).toBe(false);
    });

    it("works on a real Error carrying a status", () => {
        expect(isNotFound(Object.assign(new Error("404 /x"), { status: 404 }))).toBe(true);
    });

    it.each([undefined, null, {}, "404", 404])("is false for %p", (value) => {
        expect(isNotFound(value)).toBe(false);
    });
});
