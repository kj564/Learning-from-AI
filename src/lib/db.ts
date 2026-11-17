/**
 * Prisma client singleton.
 *
 * Usage:
 *   import { db } from '@/lib/db';
 *   const assistant = await db.assistant.findUnique({ where: { id } });
 */

import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Avoid creating a new client on every hot-reload in dev
export const db =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = db;
}
