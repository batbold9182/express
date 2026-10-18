/**
 * Moves the clock forward inside a test, so something can be made to look old without waiting for it.
 *
 *   const { skipAhead } = useClock();
 *   skipAhead(11 * 60_000);       // `Date.now()` and `new Date()` are now 11 minutes later, and stay there
 *
 * Only `Date` is faked. Timers, `process.nextTick` and the performance clock keep running, so the app, supertest and the
 * database driver all still work. Call it once at the top of the file; the real clock is put back after every test.
 */
export function useClock() {
    afterEach(() => {
        jest.useRealTimers();
    });

    return {
        skipAhead(ms: number) {
            jest.useFakeTimers({
                now: Date.now() + ms,
                doNotFake: ["hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate", "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout"],
            });
        },
        /** Puts the real clock back before the end of the test (e.g. to call an API that must not see the faked one). */
        restore() {
            jest.useRealTimers();
        },
    };
}
