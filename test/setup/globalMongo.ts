import { MongoMemoryServer } from "mongodb-memory-server";

// Runs once per `npm test`, before any test file (jest.config.js → globalSetup).
//
// One in-memory MongoDB serves the whole run; each test file gets its own database inside it (see helpers/mongo.ts).
// This used to start one server per test file, and five of them launching at once on Windows sometimes missed the
// library's start-up limit — "Instance failed to start" — which fails a test that has nothing wrong with it.
export default async function globalSetup() {
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });

    // Handed to teardown through globalThis (they share the parent process) and to the workers through the environment.
    (globalThis as { __MONGOD__?: MongoMemoryServer }).__MONGOD__ = server;
    process.env.TEST_MONGO_URI = server.getUri(); // mongodb://127.0.0.1:<port>/ — local, so it passes the guard
}
