import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";

/**
 * Prisma over node-postgres, as recommended for Neon on Vercel Fluid compute.
 * DATABASE_URL is Neon's *pooled* connection string (host ends in -pooler).
 * Migrations use the direct string (DATABASE_URL_UNPOOLED) via schema.prisma.
 */
function createClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 5_000 });
  // Lets Vercel close idle connections before a function instance is suspended. No-op elsewhere.
  attachDatabasePool(pool);
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
