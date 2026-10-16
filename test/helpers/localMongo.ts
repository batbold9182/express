const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Throws unless every host in a MongoDB connection string is this machine.
 *
 * `backend/.env` points at the real Atlas cluster, so a test that connected with it would read and write
 * production data. `mongodb+srv://` is always refused: it resolves hosts through DNS, so there is no way to
 * tell from the string that it is local.
 */
export function assertLocalMongoUri(uri: unknown): void {
    if (typeof uri !== "string") throw new Error("Refusing to connect: the MongoDB URI is not a string");

    const match = /^mongodb(\+srv)?:\/\/([^/?]*)/i.exec(uri);
    if (!match) throw new Error("Refusing to connect: not a mongodb:// URI");
    if (match[1]) throw new Error("Refusing to connect: mongodb+srv:// URIs are resolved over DNS, so they are never treated as local");

    // The authority is `user:pass@host1:port,host2:port`. Whatever precedes the last '@' is credentials.
    const authority = match[2];
    const hosts = authority.slice(authority.lastIndexOf("@") + 1).split(",");

    for (const h of hosts) {
        const host = (h.startsWith("[") ? h.slice(1, h.indexOf("]")) : h.split(":")[0]).toLowerCase();
        if (!LOCAL_HOSTS.has(host)) {
            throw new Error(`Refusing to connect to "${host}": tests may only use a local database (localhost, 127.0.0.1 or ::1)`);
        }
    }
}
