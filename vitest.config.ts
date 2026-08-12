import { defineConfig } from 'vitest/config';

// Pin the suite to a timezone west of Greenwich. Every date in this app is a
// local 'YYYY-MM-DD' string, and the classic bug is `new Date('2026-03-15')`,
// which the spec parses as UTC midnight — that lands on the 14th here and on
// the 15th in UTC+X, so a suite running in the author's timezone would sail
// straight past the very bug it exists to catch.
process.env.TZ = 'America/Los_Angeles';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
