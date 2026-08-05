import { defineConfig } from 'vitest/config';

// Load DATABASE_URL from server/.env when running on a developer machine.
// Inside Docker Compose the variable is already set, so a missing file is fine.
try {
  process.loadEnvFile('.env');
} catch {
  // already provided by the environment
}

export default defineConfig({
  test: {
    // Each suite creates and deletes its own rows; running them in one process
    // keeps that predictable.
    fileParallelism: false,
    testTimeout: 30000,
  },
});
