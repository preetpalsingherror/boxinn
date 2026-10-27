import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../src/infrastructure/db/client.ts';
import { checkRateLimit, cleanupExpiredRateLimits } from '../../src/infrastructure/security/rate-limiter.ts';

describe('Integration: Atomic PostgreSQL Rate Limiter', () => {
  const testKey = 'test:rate_limit:concurrency';

  after(async () => {
    await prisma.rateLimitBucket.deleteMany({
      where: { key: { startsWith: 'test:rate_limit' } },
    });
  });

  it('allows requests within limit and tracks count', async () => {
    const key = `${testKey}:basic`;

    const r1 = await checkRateLimit(key, 3, 5000);
    assert.equal(r1.allowed, true);
    assert.equal(r1.currentAttempts, 1);

    const r2 = await checkRateLimit(key, 3, 5000);
    assert.equal(r2.allowed, true);
    assert.equal(r2.currentAttempts, 2);

    const r3 = await checkRateLimit(key, 3, 5000);
    assert.equal(r3.allowed, true);
    assert.equal(r3.currentAttempts, 3);

    // 4th request exceeds max of 3
    const r4 = await checkRateLimit(key, 3, 5000);
    assert.equal(r4.allowed, false);
    assert.equal(r4.currentAttempts, 4);
    assert.ok(r4.retryAfterSeconds > 0);
  });

  it('CONCURRENCY: 10 simultaneous requests against max 5 allows exactly 5 and blocks 5', async () => {
    const key = `${testKey}:parallel`;

    const promises = Array.from({ length: 10 }).map(() =>
      checkRateLimit(key, 5, 10000)
    );

    const results = await Promise.all(promises);
    const allowed = results.filter((r) => r.allowed).length;
    const blocked = results.filter((r) => !r.allowed).length;

    assert.equal(allowed, 5);
    assert.equal(blocked, 5);
  });

  it('CLEANUP: removes expired rate limit buckets', async () => {
    // Insert an expired bucket
    const expiredKey = `${testKey}:expired`;
    await prisma.rateLimitBucket.create({
      data: {
        key: expiredKey,
        count: 5,
        windowStart: new Date(Date.now() - 20000),
        expiresAt: new Date(Date.now() - 10000),
      },
    });

    const deleted = await cleanupExpiredRateLimits();
    assert.ok(deleted >= 1);

    const found = await prisma.rateLimitBucket.findUnique({
      where: { key: expiredKey },
    });
    assert.equal(found, null);
  });
});
