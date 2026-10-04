/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/**/*.test.ts'],

  // mongoose lives in backend/node_modules, not at the repo root. Resolving it from there means a test's
  // `import mongoose` is the SAME instance the app under test uses (a second copy would make mocks no-ops).
  modulePaths: ['<rootDir>/../backend/node_modules'],

  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },

  // Undo jest.spyOn / jest.fn changes after every test so one test can't leak into the next.
  restoreMocks: true,
};
