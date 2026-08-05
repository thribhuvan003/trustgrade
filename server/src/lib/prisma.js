// One Prisma client for the whole server.
//
// The .env lives in server/, where the Prisma CLI also looks for it. Every entry
// point (the API, the seed script, the attack suite) reaches the database through
// this file, so it is the one place worth loading it. Already-set variables win,
// which is what lets Compose and CI pass their own.
import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(new URL('../../.env', import.meta.url));
  } catch {
    // no .env on disk; the environment is expected to supply DATABASE_URL
  }
}

export const prisma = new PrismaClient();
