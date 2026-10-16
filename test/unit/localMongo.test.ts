import mongoose from "mongoose";
import { assertLocalMongoUri } from "../helpers/localMongo";

describe("assertLocalMongoUri", () => {
    it.each([
        "mongodb://127.0.0.1:27017/test",
        "mongodb://localhost/test",
        "mongodb://localhost:27017",
        "mongodb://[::1]:27017/test",
        "mongodb://user:pass@127.0.0.1:27017/test?authSource=admin",
        "mongodb://127.0.0.1:27017,localhost:27018/test", // a local replica set
        "MONGODB://LOCALHOST/test",
    ])("accepts %s", (uri) => {
        expect(() => assertLocalMongoUri(uri)).not.toThrow();
    });

    it.each([
        "mongodb+srv://user:pw@cluster0.abc12.mongodb.net/express",   // Atlas
        "mongodb://cluster0-shard-00-00.abc12.mongodb.net:27017/express",
        "mongodb://203.0.113.7:27017/test",
        "mongodb://localhost.evil.com/test",                           // looks local, is not
        "mongodb://localhost@evil.com/test",                           // "localhost" is the username
        "mongodb://127.0.0.1:27017,cluster0.abc12.mongodb.net:27017/test", // one local host is not enough
        "mongodb+srv://localhost/test",                                 // srv is never trusted
    ])("refuses %s", (uri) => {
        expect(() => assertLocalMongoUri(uri)).toThrow(/Refusing to connect/);
    });

    it.each([undefined, null, 42, "", "http://localhost/test", "not a uri"])("refuses a non-mongodb value: %p", (value) => {
        expect(() => assertLocalMongoUri(value)).toThrow(/Refusing to connect/);
    });
});

// The setup file (test/setup/dbGuard.ts) is what makes the guard apply to every test. These prove it is wired in.
describe("the guard installed by the Jest setup file", () => {
    it("removes MONGO_URI from the environment", () => {
        expect(process.env.MONGO_URI).toBeUndefined();
    });

    it("makes mongoose.connect refuse an Atlas string before any connection is attempted", async () => {
        await expect(mongoose.connect("mongodb+srv://user:pw@cluster0.abc12.mongodb.net/express")).rejects.toThrow(/Refusing to connect/);
        expect(mongoose.connection.readyState).toBe(0);
    });

    // createConnection(uri) is fire-and-forget in mongoose: it calls the same openUri without awaiting it, so a
    // refused URI there surfaces as an unhandled rejection that stops the run — loud, which is the point. The
    // explicit call below is the same code path, in a form a test can observe.
    it("refuses at openUri, the method connect() and createConnection(uri) both go through", async () => {
        const conn = mongoose.createConnection(); // no URI: nothing is opened
        await expect(conn.openUri("mongodb://cluster0-shard-00-00.abc12.mongodb.net:27017/express")).rejects.toThrow(/Refusing to connect/);
        expect(conn.readyState).toBe(0);
    });
});
