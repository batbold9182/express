// A request and a response shaped like the ones Vercel hands to web/api/r.ts (the /r/:id share page): plain objects with
// `query`, `headers`, `setHeader`, `status` and `send`. (web/api/og.ts takes a standard `Request`, so it needs no fake.)

export function fakeReq(options: { query?: Record<string, string>; headers?: Record<string, string> } = {}) {
    return { query: options.query ?? {}, headers: { host: "app.test", ...options.headers } };
}

export function fakeRes() {
    const headers: Record<string, string> = {};
    const res = {
        statusCode: 0,
        headers,
        body: undefined as unknown,
        setHeader(name: string, value: string) {
            headers[name.toLowerCase()] = value;
            return res;
        },
        status(code: number) {
            res.statusCode = code;
            return res;
        },
        send(body: unknown) {
            res.body = body;
            return res;
        },
    };
    return res;
}
