import { Router, type Request, type Response } from "express";
import { auth, db, type TenantRole } from "../firebase.js";
import { writeRateLimit } from "../middleware/rateLimit.js";

const router = Router();

// POST /invites/join - Join organization using invite code
router.post("/join", writeRateLimit, async (req: Request, res: Response) => {
    try {
        const uid = res.locals.user.uid;
        const { code } = req.body ?? {};

        if (!code || typeof code !== "string" || !code.trim()) {
            res.status(400).json({ error: "Invite code is required." });
            return;
        }

        const cleanCode = code.trim().toUpperCase();

        // 1. Check global invites index
        let tenantId = "";
        let assignedRole: TenantRole = "member";

        const inviteDoc = await db.collection("invites").doc(cleanCode).get();
        if (inviteDoc.exists) {
            const inviteData = inviteDoc.data()!;
            tenantId = String(inviteData.tenantId ?? "");
            assignedRole = (inviteData.role as TenantRole) ?? "member";

            // Check expiration
            if (inviteData.expiresAt) {
                const exp =
                    typeof inviteData.expiresAt === "object" &&
                    "toDate" in inviteData.expiresAt &&
                    typeof inviteData.expiresAt.toDate === "function"
                        ? inviteData.expiresAt.toDate()
                        : new Date(inviteData.expiresAt as string | number | Date);
                if (exp < new Date()) {
                    res.status(400).json({ error: "This invite code has expired." });
                    return;
                }
            }
        } else {
            // Check if matches a tenant's master inviteCode
            const tenantMatchSnap = await db.collection("tenants").where("inviteCode", "==", cleanCode).limit(1).get();
            if (!tenantMatchSnap.empty) {
                const matchDoc = tenantMatchSnap.docs[0];
                tenantId = matchDoc.id;
                assignedRole = "member";
            } else {
                res.status(404).json({ error: "Invalid invite code. Please check with your administrator." });
                return;
            }
        }

        // 2. Fetch tenant
        const tenantDoc = await db.collection("tenants").doc(tenantId).get();
        if (!tenantDoc.exists) {
            res.status(404).json({ error: "Organization not found." });
            return;
        }

        const tenantData = tenantDoc.data()!;
        const now = new Date();

        // 3. Fetch user details to seed member record
        const authUser = await auth.getUser(uid).catch(() => null);
        const userDoc = await db.collection("users").doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() : null;

        const memberData = {
            uid,
            displayName: authUser?.displayName ?? userData?.displayName ?? "Team Member",
            email: authUser?.email ?? userData?.email ?? "",
            phoneNumber: authUser?.phoneNumber ?? userData?.phoneNumber ?? "",
            role: assignedRole,
            active: true,
            joinedAt: now,
            updatedAt: now
        };

        const batch = db.batch();

        // Add to tenant members
        const memberRef = db.collection("tenants").doc(tenantId).collection("members").doc(uid);
        batch.set(memberRef, memberData, { merge: true });

        // Add to user memberships
        const userMembershipRef = db.collection("users").doc(uid).collection("memberships").doc(tenantId);
        batch.set(userMembershipRef, {
            tenantId,
            tenantName: tenantData.name,
            role: assignedRole,
            joinedAt: now
        });

        await batch.commit();

        res.json({
            success: true,
            tenant: {
                id: tenantId,
                name: tenantData.name,
                userRole: assignedRole
            }
        });
    } catch (error) {
        console.error("Join organization failed", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to join organization." });
    }
});

// GET /invites/user - List invites sent to current user's email
router.get("/user", async (_req: Request, res: Response) => {
    try {
        const email = res.locals.user.email;
        if (!email) {
            res.json({ invites: [] });
            return;
        }

        const snapshot = await db
            .collectionGroup("invites")
            .where("targetEmail", "==", email.toLowerCase().trim())
            .where("status", "==", "active")
            .get();

        type UserInviteDoc = {
            id: string;
            expiresAt?: { toDate?: () => Date } | string | Date;
            [key: string]: unknown;
        };

        const now = new Date();
        const invites = snapshot.docs
            .map((d): UserInviteDoc => ({
                id: d.id,
                ...d.data()
            }))
            .filter((inv: UserInviteDoc) => {
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
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to fetch invites." });
    }
});

export default router;
