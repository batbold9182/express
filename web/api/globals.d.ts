// Vercel functions run on Node/Edge and read env vars via `process.env`.
// `types: []` (see tsconfig) keeps @types/node out to avoid DOM↔node global
// clashes, so declare the one Node global we use here.
declare const process: { env: Record<string, string | undefined> };
