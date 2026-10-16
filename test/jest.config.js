/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/**/*.test.ts'],

  // mongoose lives in backend/node_modules, not at the repo root. Resolving it from there means a test's
  // `import mongoose` is the SAME instance the app under test uses (a second copy would make mocks no-ops).
  modulePaths: ['<rootDir>/../backend/node_modules'],

  // Runs before every test file: removes MONGO_URI and makes mongoose refuse any non-local database.
  setupFiles: ['<rootDir>/setup/dbGuard.ts'],

  // Runs before every test file once the framework is up: no test may send real email (setup/noRealMail.ts).
  setupFilesAfterEnv: ['<rootDir>/setup/noRealMail.ts'],

  // One in-memory MongoDB for the whole run (each test file uses its own database in it — see helpers/mongo.ts).
  globalSetup: '<rootDir>/setup/globalMongo.ts',
  globalTeardown: '<rootDir>/setup/globalMongoTeardown.ts',

  // Test files run in parallel; the first test in a file waits for its database, so leave room on a slow machine.
  testTimeout: 15000,

  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },

  // Undo jest.spyOn / jest.fn changes after every test so one test can't leak into the next.
  restoreMocks: true,
};
