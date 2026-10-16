import type { MongoMemoryServer } from "mongodb-memory-server";

// Runs once after the last test file (jest.config.js → globalTeardown): stops the server globalMongo.ts started.
export default async function globalTeardown() {
    await (globalThis as { __MONGOD__?: MongoMemoryServer }).__MONGOD__?.stop();
}
