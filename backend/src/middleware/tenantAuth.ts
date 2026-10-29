import type { NextFunction, Request, Response } from "express";
import { db, type TenantRole } from "../firebase.js";

export function getTenantIdParam(req: Request): string {
    const tenantId = req.params.tenantId;
    if (typeof tenantId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(tenantId)) {
        throw new Error("tenantId is required and must contain only letters, numbers, underscores, or hyphens.");
    }
    return tenantId;
}

export function getUidParam(req: Request, paramName = "uid"): string {
    const uid = req.params[paramName];
    if (typeof uid !== "string" || !/^[A-Za-z0-9_.-]{1,128}$/.test(uid)) {
        throw new Error(`${paramName} is invalid.`);
    }
    return uid;
}

export function getParam(req: Request, paramName: string): string {
    const value = req.params[paramName];
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`${paramName} is required.`);
    }
    return value.trim();
}

export function parseRole(value: unknown): TenantRole {
    const validRoles: TenantRole[] = ["owner", "admin", "member", "viewer"];
    if (typeof value !== "string" || !validRoles.includes(value as TenantRole)) {
        throw new Error(`Role must be one of: ${validRoles.join(", ")}`);
    }
    return value as TenantRole;
}

export type TenantMembership = {
    uid: string;
    role: TenantRole;
    active: boolean;
    displayName?: string;
    email?: string;
    phoneNumber?: string;
};

export async function fetchTenantMembership(tenantId: string, uid: string): Promise<TenantMembership | null> {
    const memberDoc = await db.collection("tenants").doc(tenantId).collection("members").doc(uid).get();
    if (!memberDoc.exists) return null;
    const data = memberDoc.data()!;
    return {
        uid: memberDoc.id,
        role: data.role as TenantRole,
        active: data.active !== false,
        displayName: data.displayName,
        email: data.email,
        phoneNumber: data.phoneNumber
    };
}

export async function requireTenantMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const tenantId = getTenantIdParam(req);
        const uid = res.locals.user?.uid;

        if (!uid) {
            res.status(401).json({ error: "Authentication required." });
            return;
        }

        // Global admin bypass
        if (res.locals.user?.admin === true) {
            res.locals.tenantRole = "owner";
            next();
            return;
        }

        const membership = await fetchTenantMembership(tenantId, uid);
        if (!membership) {
            res.status(403).json({ error: "Access denied. You are not a member of this organization." });
            return;
        }

        res.locals.tenantMembership = membership;
        res.locals.tenantRole = membership.role;
        next();
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Tenant verification failed." });
    }
}

export async function requireTenantAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const tenantId = getTenantIdParam(req);
        const uid = res.locals.user?.uid;

        if (!uid) {
            res.status(401).json({ error: "Authentication required." });
            return;
        }

        if (res.locals.user?.admin === true) {
            res.locals.tenantRole = "owner";
            next();
            return;
        }

        const membership = await fetchTenantMembership(tenantId, uid);
        if (!membership || (membership.role !== "admin" && membership.role !== "owner")) {
            res.status(403).json({ error: "Administrative access to this organization is required." });
            return;
        }

        res.locals.tenantMembership = membership;
        res.locals.tenantRole = membership.role;
        next();
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Tenant verification failed." });
    }
}

export async function requireTenantOwner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const tenantId = getTenantIdParam(req);
        const uid = res.locals.user?.uid;

        if (!uid) {
            res.status(401).json({ error: "Authentication required." });
            return;
        }

        if (res.locals.user?.admin === true) {
            res.locals.tenantRole = "owner";
            next();
            return;
        }

        const membership = await fetchTenantMembership(tenantId, uid);
        if (!membership || membership.role !== "owner") {
            res.status(403).json({ error: "Organization owner access is required." });
            return;
        }

        res.locals.tenantMembership = membership;
        res.locals.tenantRole = "owner";
        next();
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Tenant verification failed." });
    }
}
