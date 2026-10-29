import { Router, type Request, type Response } from "express";
import { db, auth } from "../firebase.js";
import {
    getTenantIdParam,
    requireTenantAdmin,
    requireTenantMember,
    requireTenantOwner
} from "../middleware/tenantAuth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";

const router = Router();

// GET /tenants - List all organizations the user belongs to
router.get("/", async (_req: Request, res: Response) => {
    try {
        const uid = res.locals.user.uid;

        // If system admin, option to list all tenants or user's tenants
        if (res.locals.user.admin === true && _req.query.all === "true") {
            const allTenantsSnap = await db.collection("tenants").limit(50).get();
            const tenants = allTenantsSnap.docs.map((d) => ({
                id: d.id,
                ...d.data()
            }));
            res.json({ tenants });
            return;
        }

        // Read from user's memberships
        const membershipsSnap = await db.collection("users").doc(uid).collection("memberships").get();
        const tenantIds = membershipsSnap.docs.map((d) => d.id);

        if (tenantIds.length === 0) {
            res.json({ tenants: [] });
            return;
        }

        // Fetch corresponding tenant details
        const tenantDocs = await Promise.all(tenantIds.map((id) => db.collection("tenants").doc(id).get()));

        const tenants = tenantDocs
            .filter((d) => d.exists)
            .map((d) => {
                const membership = membershipsSnap.docs.find((m) => m.id === d.id)?.data();
                return {
                    id: d.id,
                    ...d.data(),
                    userRole: membership?.role ?? "member"
                };
            });

        res.json({ tenants });
    } catch (error) {
        console.error("Failed to list tenants", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Unable to list organizations." });
    }
});

// POST /tenants - Create a new organization
router.post("/", writeRateLimit, async (req: Request, res: Response) => {
    try {
        const uid = res.locals.user.uid;
        const { name, phoneNumber, settings } = req.body ?? {};

        if (!name || typeof name !== "string" || name.trim().length === 0) {
            res.status(400).json({ error: "Organization name is required." });
            return;
        }

        const trimmedName = name.trim().slice(0, 100);
        const tenantId = `org-${trimmedName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "-")
            .slice(0, 30)}-${Math.floor(100 + Math.random() * 900)}`;
        const masterInviteCode = `${trimmedName
            .slice(0, 4)
            .toUpperCase()
            .replace(/[^A-Z]/g, "ORG")}-${Math.floor(1000 + Math.random() * 9000)}`;

        const phoneNumbersList = [];
        if (typeof phoneNumber === "string" && phoneNumber.trim()) {
            phoneNumbersList.push({
                id: `pn-${Date.now()}`,
                number: phoneNumber.trim(),
                label: "Main Rental Line",
                isPrimary: true
            });
        }

        const defaultSettings = {
            routingStrategy: settings?.routingStrategy ?? "sequential",
            ringTimeoutSeconds: Number(settings?.ringTimeoutSeconds ?? 20),
            answerMessage:
                settings?.answerMessage ??
                "Thank you for calling PartyLine. Connecting your call to our on-duty team member...",
            fallbackAction: settings?.fallbackAction ?? "voicemail",
            fallbackPhone: settings?.fallbackPhone ?? "",
            smsAutoReplyEnabled: settings?.smsAutoReplyEnabled !== false,
            smsAutoReplyMessage:
                settings?.smsAutoReplyMessage ??
                "Thank you for reaching out to PartyLine! A host on duty has received your message and will reply shortly.",
            timezone: settings?.timezone ?? "America/New_York"
        };

        const now = new Date();
        const tenantData = {
            id: tenantId,
            name: trimmedName,
            ownerUid: uid,
            inviteCode: masterInviteCode,
            phoneNumbers: phoneNumbersList,
            settings: defaultSettings,
            createdAt: now,
            updatedAt: now
        };

        const batch = db.batch();

        // 1. Create tenant doc
        const tenantRef = db.collection("tenants").doc(tenantId);
        batch.set(tenantRef, tenantData);

        // 2. Fetch user's display details to seed owner member
        const authUser = await auth.getUser(uid).catch(() => null);
        const userDoc = await db.collection("users").doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() : null;

        const memberData = {
            uid,
            displayName: authUser?.displayName ?? userData?.displayName ?? "Admin",
            email: authUser?.email ?? userData?.email ?? "",
            phoneNumber: authUser?.phoneNumber ?? userData?.phoneNumber ?? "",
            role: "owner",
            active: true,
            joinedAt: now,
            updatedAt: now
        };

        // 3. Add creator as owner member in tenant subcollection
        const memberRef = tenantRef.collection("members").doc(uid);
        batch.set(memberRef, memberData);

        // 4. Record membership under user's profile
        const userMembershipRef = db.collection("users").doc(uid).collection("memberships").doc(tenantId);
        batch.set(userMembershipRef, {
            tenantId,
            tenantName: trimmedName,
            role: "owner",
            joinedAt: now
        });

        // 5. Index invite code for easy O(1) lookup
        const inviteIndexRef = db.collection("invites").doc(masterInviteCode);
        batch.set(inviteIndexRef, {
            tenantId,
            tenantName: trimmedName,
            role: "member",
            createdBy: uid,
            status: "active",
            createdAt: now
        });

        await batch.commit();

        res.status(201).json({
            tenant: {
                ...tenantData,
                userRole: "owner"
            }
        });
    } catch (error) {
        console.error("Organization creation failed", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Unable to create organization." });
    }
});

// GET /tenants/:tenantId - Get organization details
router.get("/:tenantId", requireTenantMember, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const tenantDoc = await db.collection("tenants").doc(tenantId).get();

        if (!tenantDoc.exists) {
            res.status(404).json({ error: "Organization not found." });
            return;
        }

        res.json({
            tenant: {
                id: tenantDoc.id,
                ...tenantDoc.data(),
                userRole: res.locals.tenantRole
            }
        });
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to read organization." });
    }
});

// PATCH /tenants/:tenantId - Update organization profile and settings
router.patch("/:tenantId", requireTenantAdmin, writeRateLimit, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const { name, settings } = req.body ?? {};

        const updates: Record<string, unknown> = {
            updatedAt: new Date()
        };

        if (typeof name === "string" && name.trim()) {
            updates.name = name.trim().slice(0, 100);
        }

        if (settings && typeof settings === "object") {
            const tenantDoc = await db.collection("tenants").doc(tenantId).get();
            const currentSettings = tenantDoc.data()?.settings ?? {};

            updates.settings = {
                ...currentSettings,
                ...(typeof settings.routingStrategy === "string" && { routingStrategy: settings.routingStrategy }),
                ...(settings.ringTimeoutSeconds !== undefined && {
                    ringTimeoutSeconds: Math.max(10, Math.min(120, Number(settings.ringTimeoutSeconds)))
                }),
                ...(typeof settings.answerMessage === "string" && {
                    answerMessage: settings.answerMessage.trim().slice(0, 1000)
                }),
                ...(typeof settings.fallbackAction === "string" && { fallbackAction: settings.fallbackAction }),
                ...(typeof settings.fallbackPhone === "string" && { fallbackPhone: settings.fallbackPhone.trim() }),
                ...(typeof settings.smsAutoReplyEnabled === "boolean" && {
                    smsAutoReplyEnabled: settings.smsAutoReplyEnabled
                }),
                ...(typeof settings.smsAutoReplyMessage === "string" && {
                    smsAutoReplyMessage: settings.smsAutoReplyMessage.trim().slice(0, 1000)
                }),
                ...(typeof settings.timezone === "string" && { timezone: settings.timezone.trim() })
            };
        }

        await db.collection("tenants").doc(tenantId).update(updates);

        // If organization name changed, update user membership records
        if (updates.name) {
            const membersSnap = await db.collection("tenants").doc(tenantId).collection("members").get();
            const memberUids = membersSnap.docs.map((d) => d.id);
            const batch = db.batch();
            for (const memberUid of memberUids) {
                const membershipRef = db.collection("users").doc(memberUid).collection("memberships").doc(tenantId);
                batch.set(membershipRef, { tenantName: updates.name }, { merge: true });
            }
            await batch.commit().catch((err) => console.warn("Failed to propagate tenant name update:", err));
        }

        const updatedDoc = await db.collection("tenants").doc(tenantId).get();
        res.json({
            tenant: {
                id: updatedDoc.id,
                ...updatedDoc.data(),
                userRole: res.locals.tenantRole
            }
        });
    } catch (error) {
        console.error("Organization update failed", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to update organization." });
    }
});

// DELETE /tenants/:tenantId - Delete organization (Owner only)
router.delete("/:tenantId", requireTenantOwner, writeRateLimit, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const tenantRef = db.collection("tenants").doc(tenantId);

        // Remove memberships from all users in this tenant
        const membersSnap = await tenantRef.collection("members").get();
        const batch = db.batch();

        for (const memberDoc of membersSnap.docs) {
            const userMembershipRef = db.collection("users").doc(memberDoc.id).collection("memberships").doc(tenantId);
            batch.delete(userMembershipRef);
            batch.delete(memberDoc.ref);
        }

        // Remove events
        const eventsSnap = await tenantRef.collection("events").get();
        for (const eventDoc of eventsSnap.docs) {
            batch.delete(eventDoc.ref);
        }

        // Remove tenant doc
        batch.delete(tenantRef);

        await batch.commit();

        res.status(204).send();
    } catch (error) {
        console.error("Organization deletion failed", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Unable to delete organization." });
    }
});

export default router;
