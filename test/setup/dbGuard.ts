import mongoose from "mongoose";
import { assertLocalMongoUri } from "../helpers/localMongo";

// Runs before every test file (jest.config.js → setupFiles).
//
// 1. App code reads MONGO_URI from the environment, and a developer's shell may have the Atlas string in it.
//    Tests never need it — they start their own in-memory database — so remove it.
// 2. Whatever else is tried, nothing may open a connection to a non-local host. Mongoose funnels both
//    `mongoose.connect()` and `mongoose.createConnection()` through `Connection.prototype.openUri`, so
//    guarding that one method covers every route to a database. (`createConnection(uri)` calls it without
//    awaiting, so a refusal there is an unhandled rejection that stops the run — loud, which is the point.)
delete process.env.MONGO_URI;

const proto = mongoose.Connection.prototype as unknown as { openUri: (uri: string, ...rest: unknown[]) => Promise<unknown> };
const realOpenUri = proto.openUri;

proto.openUri = async function (this: unknown, uri: string, ...rest: unknown[]) {
    assertLocalMongoUri(uri);
    return realOpenUri.call(this, uri, ...rest);
};
