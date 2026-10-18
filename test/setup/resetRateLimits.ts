import fs from "fs";
import path from "path";

// Runs before every test file (setupFilesAfterEnv). plan.md, "Rate limiter (D2)": the backend gets `middleware/rateLimit.ts`,
// which exports `resetRateLimits()`. From then on every test must start with empty counters: supertest connects from one
// address, so without this the register limit (5 an hour) would refuse the sixth test that signs someone up.
//
// Until that file exists there is nothing to reset and this does nothing. Once it exists, any problem loading it is a real
// error and is not swallowed.
const limiterFile = path.resolve(__dirname, "../../backend/middleware/rateLimit.ts");

beforeEach(() => {
    if (!fs.existsSync(limiterFile)) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const limiter = require(limiterFile) as { resetRateLimits?: () => void };
    limiter.resetRateLimits?.();
});
