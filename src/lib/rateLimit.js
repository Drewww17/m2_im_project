/**
 * Lightweight in-memory rate limiter for API routes.
 * Note: In serverless environments this is per-instance and best-effort.
 */

const globalStore = globalThis;
const RATE_LIMIT_BUCKETS = globalStore.__rateLimitBuckets || new Map();

if (!globalStore.__rateLimitBuckets) {
  globalStore.__rateLimitBuckets = RATE_LIMIT_BUCKETS;
}

function cleanupBucket(bucket, now) {
  for (const [key, item] of bucket.entries()) {
    if (item.resetAt <= now) {
      bucket.delete(key);
    }
  }
}

/**
 * Consume one request slot from a rate-limit bucket.
 * @param {Object} options
 * @param {string} options.bucketName - Logical limiter name (e.g. auth-login)
 * @param {string} options.key - Client key (e.g. ip:user)
 * @param {number} options.limit - Max requests in window
 * @param {number} options.windowMs - Window length in milliseconds
 * @returns {{ allowed: boolean, remaining: number, retryAfterSeconds: number }}
 */
export function consumeRateLimit({ bucketName, key, limit, windowMs }) {
  const now = Date.now();
  const namespacedBucket = RATE_LIMIT_BUCKETS.get(bucketName) || new Map();

  if (!RATE_LIMIT_BUCKETS.has(bucketName)) {
    RATE_LIMIT_BUCKETS.set(bucketName, namespacedBucket);
  }

  cleanupBucket(namespacedBucket, now);

  const current = namespacedBucket.get(key);

  if (!current || current.resetAt <= now) {
    namespacedBucket.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      retryAfterSeconds: 0,
    };
  }

  if (current.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  current.count += 1;
  namespacedBucket.set(key, current);

  return {
    allowed: true,
    remaining: Math.max(0, limit - current.count),
    retryAfterSeconds: 0,
  };
}

export function getRequestIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return String(forwardedFor[0]).trim();
  }

  return req.socket?.remoteAddress || 'unknown';
}
