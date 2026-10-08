import type { NextFunction, Request, Response } from "express";
import { appCheck, auth } from "../firebase.js";

export async function requireAppCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = req.header("X-Firebase-AppCheck");

    if (!token) {
        res.status(401).json({ error: "Missing Firebase App Check token" });
        return;
    }

    try {
        res.locals.appCheck = await appCheck.verifyToken(token);
        next();
    } catch (error) {
        console.warn("Firebase App Check verification failed", error);
        res.status(401).json({ error: "Invalid Firebase App Check token" });
    }
}

export async function requireFirebaseAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authorization = req.header("Authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : undefined;

    if (!token) {
        res.status(401).json({ error: "Missing Firebase ID token" });
        return;
    }

    try {
        res.locals.user = await auth.verifyIdToken(token);
        next();
    } catch (error) {
        console.warn("Firebase ID token verification failed", error);
        res.status(401).json({ error: "Invalid Firebase ID token" });
    }
}
