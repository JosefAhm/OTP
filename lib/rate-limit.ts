const RATE_LIMIT_DEFAULT_WINDOW_MS = 60_000;

type RateLimitOptions = {
  limit: number;
  windowMs?: number;
};

type RateLimitEntry = {
  count: number;
  expiresAt: number;
};

type RateLimitResult = {
  success: boolean;
  headers: Record<string, string>;
};

declare global {
  // eslint-disable-next-line no-var
  var __rateLimitStore: Map<string, RateLimitEntry> | undefined;
}

const store: Map<string, RateLimitEntry> = globalThis.__rateLimitStore ?? new Map();

if (!globalThis.__rateLimitStore) {
  globalThis.__rateLimitStore = store;
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const [first] = forwarded.split(",");
    if (first && first.trim()) {
      return first.trim();
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp && realIp.trim()) {
    return realIp.trim();
  }

  return "127.0.0.1";
}

export function applyRateLimit(request: Request, options: RateLimitOptions): RateLimitResult {
  const ip = getClientIp(request);
  const limit = options.limit;
  const windowMs = options.windowMs ?? RATE_LIMIT_DEFAULT_WINDOW_MS;
  const now = Date.now();

  const existing = store.get(ip);
  if (!existing || existing.expiresAt <= now) {
    store.set(ip, { count: 1, expiresAt: now + windowMs });

    return {
      success: true,
      headers: {
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(Math.max(limit - 1, 0)),
        "X-RateLimit-Reset": String(Math.ceil((now + windowMs) / 1000))
      }
    };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(Math.ceil((existing.expiresAt - now) / 1000), 1);

    return {
      success: false,
      headers: {
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(existing.expiresAt / 1000)),
        "Retry-After": String(retryAfterSeconds)
      }
    };
  }

  const updated: RateLimitEntry = {
    count: existing.count + 1,
    expiresAt: existing.expiresAt
  };
  store.set(ip, updated);

  return {
    success: true,
    headers: {
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": String(Math.max(limit - updated.count, 0)),
      "X-RateLimit-Reset": String(Math.ceil(updated.expiresAt / 1000))
    }
  };
}

export {};
