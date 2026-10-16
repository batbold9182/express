/**
 * Sets environment variables for one test and puts them back afterwards. Call it once at the top of the file.
 *
 *   const env = useEnv();
 *   env.set("ADMIN_EMAIL", "boss@example.com");
 *   env.set("NODE_ENV", undefined);              // undefined removes it
 *
 * The app reads `process.env` on each request in most places, so a value set inside a test is seen by the routes.
 */
export function useEnv() {
    const original = new Map<string, string | undefined>();

    afterEach(() => {
        for (const [name, value] of original) {
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
        }
        original.clear();
    });

    return {
        set(name: string, value: string | undefined) {
            if (!original.has(name)) original.set(name, process.env[name]);
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
        },
    };
}
