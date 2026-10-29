import { Router, type Request, type Response } from "express";
import { auth, db } from "../firebase.js";
import {
    getTenantIdParam,
    getUidParam,
    parseRole,
    requireTenantAdmin,
    requireTenantMember
} from "../middleware/tenantAuth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";

const router = Router({ mergeParams: true });

// GET /tenants/:tenantId/members - List members
router.get("/", requireTenantMember, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const snapshot = await db.collection("tenants").doc(tenantId).collection("members").get();

        const members = snapshot.docs.map((doc) => ({
            uid: doc.id,
            ...doc.data()
        }));

        res.json({ members });
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to list members." });
    }
});

// POST /tenants/:tenantId/members - Add member directly (admin/owner)
router.post("/", requireTenantAdmin, writeRateLimit, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const { email, displayName, phoneNumber, role, password, uid: providedUid } = req.body ?? {};

        const cleanRole = parseRole(role ?? "member");
        const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : undefined;
        const cleanName = typeof displayName === "string" ? displayName.trim().slice(0, 100) : undefined;
        const cleanPhone = typeof phoneNumber === "string" ? phoneNumber.trim() : undefined;

        let targetUid = providedUid;
        let authUser = null;

        // 1. Resolve or create user in Firebase Auth
        if (targetUid) {
            authUser = await auth.getUser(targetUid).catch(() => null);
        } else if (cleanEmail) {
            authUser = await auth.getUserByEmail(cleanEmail).catch(() => null);
            if (authUser) {
                targetUid = authUser.uid;
            } else {
                // Create user in Firebase Auth
                const createdUser = await auth.createUser({
                    email: cleanEmail,
                    displayName: cleanName,
                    phoneNumber: cleanPhone || undefined,
                    password: password || undefined
                });
                targetUid = createdUser.uid;
                authUser = createdUser;
            }
        } else if (cleanPhone) {
            authUser = await auth.getUserByPhoneNumber(cleanPhone).catch(() => null);
            if (authUser) {
                targetUid = authUser.uid;
            } else {
                const createdUser = await auth.createUser({
                    phoneNumber: cleanPhone,
                    displayName: cleanName
                });
                targetUid = createdUser.uid;
                authUser = createdUser;
            }
        } else {
            res.status(400).json({ error: "Email or phone number is required to add a member." });
            return;
        }

        const now = new Date();
        const memberData = {
            uid: targetUid,
            displayName: cleanName ?? authUser?.displayName ?? "Team Member",
            email: cleanEmail ?? authUser?.email ?? "",
            phoneNumber: cleanPhone ?? authUser?.phoneNumber ?? "",
            role: cleanRole,
            active: req.body?.active !== false,
            joinedAt: now,
            updatedAt: now
        };

        const batch = db.batch();

        // 2. Set tenant member record
        const memberRef = db.collection("tenants").doc(tenantId).collection("members").doc(targetUid);
        batch.set(memberRef, memberData);

        // 3. Set user membership record
        const tenantDoc = await db.collection("tenants").doc(tenantId).get();
        const tenantName = tenantDoc.data()?.name ?? "Organization";

        const userMembershipRef = db.collection("users").doc(targetUid).collection("memberships").doc(tenantId);
        batch.set(userMembershipRef, {
            tenantId,
            tenantName,
            role: cleanRole,
            joinedAt: now
        });

        // 4. Ensure base user document exists
        const userDocRef = db.collection("users").doc(targetUid);
        batch.set(
            userDocRef,
            {
                uid: targetUid,
                displayName: memberData.displayName,
                email: memberData.email,
                phoneNumber: memberData.phoneNumber,
                updatedAt: now
            },
            { merge: true }
        );

        await batch.commit();

        res.status(201).json({ member: memberData });
    } catch (error) {
        console.error("Failed to add organization member", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to add member." });
    }
});

// GET /tenants/:tenantId/members/:uid - Get single member
router.get("/:uid", requireTenantMember, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const uid = getUidParam(req);

        const memberDoc = await db.collection("tenants").doc(tenantId).collection("members").doc(uid).get();
        if (!memberDoc.exists) {
            res.status(404).json({ error: "Member not found in this organization." });
            return;
        }

        res.json({ member: { uid: memberDoc.id, ...memberDoc.data() } });
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to read member." });
    }
});

// PATCH /tenants/:tenantId/members/:uid - Update member role or active status
router.patch("/:uid", requireTenantAdmin, writeRateLimit, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const uid = getUidParam(req);
        const { role, active, displayName, phoneNumber } = req.body ?? {};

        const memberRef = db.collection("tenants").doc(tenantId).collection("members").doc(uid);
        const existingDoc = await memberRef.get();

        if (!existingDoc.exists) {
            res.status(404).json({ error: "Member not found." });
            return;
        }

        const updates: Record<string, unknown> = {
            updatedAt: new Date()
        };

        if (role !== undefined) {
            updates.role = parseRole(role);
        }

        if (active !== undefined) {
            updates.active = Boolean(active);
        }

        if (typeof displayName === "string" && displayName.trim()) {
            updates.displayName = displayName.trim().slice(0, 100);
        }

        if (typeof phoneNumber === "string") {
            updates.phoneNumber = phoneNumber.trim();
        }

        const batch = db.batch();
        batch.update(memberRef, updates);

        // If role changed, update user's membership reference as well
        if (updates.role) {
            const userMembershipRef = db.collection("users").doc(uid).collection("memberships").doc(tenantId);
            batch.set(userMembershipRef, { role: updates.role }, { merge: true });
        }

        await batch.commit();

        const updated = await memberRef.get();
        res.json({ member: { uid, ...updated.data() } });
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to update member." });
    }
});

// DELETE /tenants/:tenantId/members/:uid - Remove member or leave
router.delete("/:uid", writeRateLimit, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const targetUid = getUidParam(req);
        const requesterUid = res.locals.user.uid;
        const isSystemAdmin = res.locals.user.admin === true;

        const memberRef = db.collection("tenants").doc(tenantId).collection("members").doc(targetUid);
        const memberDoc = await memberRef.get();

        if (!memberDoc.exists) {
            res.status(404).json({ error: "Member not found." });
            return;
        }

        const targetData = memberDoc.data()!;

        // Check if requester is removing self (leaving) OR is an admin/owner
        if (requesterUid !== targetUid && !isSystemAdmin) {
            const requesterDoc = await db
                .collection("tenants")
                .doc(tenantId)
                .collection("members")
                .doc(requesterUid)
                .get();
            const requesterRole = requesterDoc.data()?.role;
            if (requesterRole !== "admin" && requesterRole !== "owner") {
                res.status(403).json({ error: "Permission denied. Admin access required." });
                return;
            }
        }

        // Prevent removing the sole owner
        if (targetData.role === "owner") {
            const ownersSnap = await db
                .collection("tenants")
                .doc(tenantId)
                .collection("members")
                .where("role", "==", "owner")
                .get();

            if (ownersSnap.size <= 1) {
                res.status(400).json({
                    error: "Cannot remove the only owner of this organization. Promote another member first."
                });
                return;
            }
        }

        const batch = db.batch();
        batch.delete(memberRef);

        const userMembershipRef = db.collection("users").doc(targetUid).collection("memberships").doc(tenantId);
        batch.delete(userMembershipRef);

        await batch.commit();

        res.status(204).send();
    } catch (error) {
        console.error("Failed to delete member", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to delete member." });
    }
});

export default router;
