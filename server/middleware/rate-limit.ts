// server/middleware/rate-limit.ts
// Simple in-memory rate limiter for Nitro/H3

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const RATE_LIMIT_CONFIG = {
    // API rate limiting
    api: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: parseInt(process.env.API_RATE_LIMIT || "100"),
    },
    // Login rate limiting (more strict)
    login: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 20,
    },
    // 2FA rate limiting
    twofa: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 30,
    },
};

/**
 * @param event
 */
const UNLIMITED_PATHS = [
    /^\/api\/health\/?$/,
    /^\/api\/v1\/health\/?$/,
    /^\/api\/push\/[^/]+\/?$/,
];

function getClientIP(event: any): string {
    // Try to get real IP from various headers
    const forwarded = getHeader(event, "x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }

    const realIP = getHeader(event, "x-real-ip");
    if (realIP) {
        return realIP;
    }

    // Fallback to socket address
    return event.node?.req?.socket?.remoteAddress || "unknown";
}

/**
 *
 */
function cleanupExpiredEntries() {
    const now = Date.now();
    for (const [ key, entry ] of rateLimitStore.entries()) {
        if (now > entry.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}

// Cleanup expired entries every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

export default defineEventHandler(async (event) => {
    const path = getRequestURL(event).pathname;

    // Only apply rate limiting to API routes
    if (!path.startsWith("/api/")) {
        return;
    }

    // Never limited:
    // - health probes: the load balancer checks every node every few seconds
    //   from one IP; a 429 would take a healthy node out of rotation
    // - push heartbeats: one host often pushes for many monitors, each request
    //   carries an unguessable token, and a 429 would raise a false DOWN alert
    if (UNLIMITED_PATHS.some(pattern => pattern.test(path))) {
        return;
    }

    // Determine which rate limit config to use
    let config = RATE_LIMIT_CONFIG.api;
    let prefix = "api";

    // Credential endpoints get the strict bucket (not every /api/auth/* read)
    if (/^\/api\/auth\/(login|setup|change-password)(\/|$)/.test(path)) {
        config = RATE_LIMIT_CONFIG.login;
        prefix = "login";
    } else if (path.includes("/2fa") || path.includes("/twofa")) {
        config = RATE_LIMIT_CONFIG.twofa;
        prefix = "twofa";
    } else {
        // The generic API bucket protects anonymous and API-key traffic. A
        // logged-in browser makes many requests (pages, polling) and must not
        // lock its own user out, so authenticated sessions skip it.
        const session = await getUserSession(event).catch(() => null);
        if (session?.user) {
            return;
        }
    }

    const clientIP = getClientIP(event);
    const key = `${prefix}:${clientIP}`;
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
    // Create new entry or reset expired one
        entry = {
            count: 1,
            resetTime: now + config.windowMs,
        };
        rateLimitStore.set(key, entry);
    } else {
    // Increment count
        entry.count++;
    }

    // Set rate limit headers
    const remaining = Math.max(0, config.maxRequests - entry.count);
    const resetSeconds = Math.ceil((entry.resetTime - now) / 1000);

    setHeader(event, "X-RateLimit-Limit", config.maxRequests.toString());
    setHeader(event, "X-RateLimit-Remaining", remaining.toString());
    setHeader(event, "X-RateLimit-Reset", resetSeconds.toString());

    // Check if rate limit exceeded
    if (entry.count > config.maxRequests) {
        setHeader(event, "Retry-After", resetSeconds);

        throw createError({
            statusCode: 429,
            statusMessage: "Too Many Requests",
            message: "Too many requests from this IP, please try again later.",
        });
    }
});
