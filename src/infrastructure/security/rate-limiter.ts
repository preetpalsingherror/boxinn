import { prisma } from '../db/client.ts';

export interface RateLimitResult {
  allowed: boolean;
  currentAttempts: number;
  maxAttempts: number;
  retryAfterSeconds: number;
}

/**
 * PostgreSQL-backed atomic rate limiter using row-level upsert locking.
 * Safe under concurrent requests across multiple application instances.
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);

  // Single atomic UPSERT with PostgreSQL row locking
  const rows = await prisma.$queryRaw<Array<{ count: number; expires_at: Date }>>`
    INSERT INTO "rate_limit_buckets" ("key", "count", "window_start", "expires_at")
    VALUES (${key}, 1, ${now}, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE
    SET 
      "count" = CASE 
        WHEN "rate_limit_buckets"."expires_at" <= EXCLUDED."window_start" THEN 1 
        ELSE "rate_limit_buckets"."count" + 1 
      END,
      "window_start" = CASE 
        WHEN "rate_limit_buckets"."expires_at" <= EXCLUDED."window_start" THEN EXCLUDED."window_start" 
        ELSE "rate_limit_buckets"."window_start" 
      END,
      "expires_at" = CASE 
        WHEN "rate_limit_buckets"."expires_at" <= EXCLUDED."window_start" THEN EXCLUDED."expires_at" 
        ELSE "rate_limit_buckets"."expires_at" 
      END
    RETURNING "count", "expires_at";
  `;

  const record = rows[0];
  const currentAttempts = record ? record.count : 1;
  const recordExpiresAt = record ? record.expires_at : expiresAt;
  const allowed = currentAttempts <= maxAttempts;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((recordExpiresAt.getTime() - now.getTime()) / 1000)
  );

  return {
    allowed,
    currentAttempts,
    maxAttempts,
    retryAfterSeconds,
  };
}

/**
 * Cleans up expired rate-limit records from the database.
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  const now = new Date();
  const result = await prisma.$executeRaw`
    DELETE FROM "rate_limit_buckets"
    WHERE "expires_at" < ${now};
  `;
  return result;
}
