import mongoose from "mongoose";

/**
 * Gives this test file its own empty database on the run's in-memory MongoDB, and empties every collection between
 * tests. Call it once at the top of the file.
 *
 * The server itself is started once per run by test/setup/globalMongo.ts. A database name that no other file shares
 * keeps parallel test files apart, and the connection string is always `mongodb://127.0.0.1:<port>`, so it passes the
 * guard in test/setup/dbGuard.ts.
 */
export function useMemoryMongo() {
    const dbName = `test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;

    beforeAll(async () => {
        const uri = process.env.TEST_MONGO_URI;
        if (!uri) throw new Error("TEST_MONGO_URI is not set — the globalSetup in jest.config.js did not run");
        await mongoose.connect(uri, { dbName });
        // Models create their indexes in the background after connecting; wait so a test never races them.
        await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
    }, 60_000);

    afterEach(async () => {
        await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    });
}
