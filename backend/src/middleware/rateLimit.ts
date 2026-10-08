import { rateLimit } from "express-rate-limit";

const oneMinute = 60 * 1000;

const skipPreflight = (req: { method: string }) => req.method === "OPTIONS";

export const publicRateLimit = rateLimit({
    windowMs: oneMinute,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: skipPreflight,
    message: { error: "Too many requests. Please try again later." },
});

export const authenticatedRateLimit = rateLimit({
    windowMs: oneMinute,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: skipPreflight,
    keyGenerator: (_req, res) => `user:${res.locals.user.uid}`,
    message: { error: "Too many requests. Please try again later." },
});

export const writeRateLimit = rateLimit({
    windowMs: oneMinute,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: skipPreflight,
    keyGenerator: (_req, res) => `user:${res.locals.user.uid}`,
    message: { error: "Too many write requests. Please try again later." },
});
