import { Router, type Request, type Response } from "express";
import { db } from "../firebase.js";
import { getTenantIdParam, getParam, parseRole, requireTenantAdmin } from "../middleware/tenantAuth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";

const router = Router({ mergeParams: true });

type InviteDocument = {
    id: string;
    expiresAt?: { toDate?: () => Date } | string | Date;
    [key: string]: unknown;
};

// GET /tenants/:tenantId/invites - List active invites for tenant
router.get("/", requireTenantAdmin, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const snapshot = await db
            .collection("tenants")
            .doc(tenantId)
            .collection("invites")
            .where("status", "==", "active")
            .get();

        const now = new Date();
        const invites = snapshot.docs
            .map((doc): InviteDocument => ({
                id: doc.id,
                ...doc.data()
            }))
            .filter((inv: InviteDocument) => {
                const exp =
                    typeof inv.expiresAt === "object" &&
                    inv.expiresAt &&
                    "toDate" in inv.expiresAt &&
                    typeof inv.expiresAt.toDate === "function"
                        ? inv.expiresAt.toDate()
                        : new Date(inv.expiresAt as string | number | Date);
                return exp >= now;
            });

        res.json({ invites });
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to list invites." });
    }
});

// POST /tenants/:tenantId/invites - Create invite code
router.post("/", requireTenantAdmin, writeRateLimit, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const uid = res.locals.user.uid;
        const { role, expiresInDays, targetEmail } = req.body ?? {};

        const cleanRole = parseRole(role ?? "member");
        const tenantDoc = await db.collection("tenants").doc(tenantId).get();

        if (!tenantDoc.exists) {
            res.status(404).json({ error: "Organization not found." });
            return;
        }

        const tenantName = tenantDoc.data()?.name ?? "PartyLine Organization";
        const prefix = tenantName
            .slice(0, 3)
            .toUpperCase()
            .replace(/[^A-Z]/g, "PL");
        const code = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

        const now = new Date();
        const days = Math.max(1, Math.min(90, Number(expiresInDays ?? 30)));
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);

        const inviteData = {
            code,
            role: cleanRole,
            targetEmail: typeof targetEmail === "string" ? targetEmail.trim().toLowerCase() : null,
            tenantId,
            tenantName,
            createdBy: uid,
            status: "active",
            createdAt: now,
            expiresAt
        };

        const batch = db.batch();

        // Save in tenant subcollection
        const inviteDocRef = db.collection("tenants").doc(tenantId).collection("invites").doc();
        batch.set(inviteDocRef, { id: inviteDocRef.id, ...inviteData });

        // Save in global invites index for O(1) code resolution
        const globalInviteRef = db.collection("invites").doc(code);
        batch.set(globalInviteRef, {
            inviteId: inviteDocRef.id,
            ...inviteData
        });

        await batch.commit();

        res.status(201).json({
            invite: {
                id: inviteDocRef.id,
                ...inviteData,
                expiresAt: expiresAt.toISOString(),
                createdAt: now.toISOString()
            }
        });
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to generate invite code." });
    }
});

// DELETE /tenants/:tenantId/invites/:inviteId - Revoke invite
router.delete("/:inviteId", requireTenantAdmin, writeRateLimit, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const inviteId = getParam(req, "inviteId");

        const inviteRef = db.collection("tenants").doc(tenantId).collection("invites").doc(inviteId);
        const inviteDoc = await inviteRef.get();

        if (!inviteDoc.exists) {
            res.status(404).json({ error: "Invite not found." });
            return;
        }

        const code = inviteDoc.data()?.code;
        const batch = db.batch();

        batch.update(inviteRef, { status: "revoked", updatedAt: new Date() });
        if (code) {
            batch.delete(db.collection("invites").doc(code));
        }

        await batch.commit();
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to revoke invite." });
    }
});

export default router;
