import { Router, type Request, type Response } from "express";
import { auth, db } from "../firebase.js";
import { getUidParam } from "../middleware/tenantAuth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";

const router = Router();

// GET /users/me - Retrieve current user profile and organization memberships
router.get("/me", async (_req: Request, res: Response) => {
    try {
        const uid = res.locals.user.uid;
        const [authUser, userDoc, membershipsSnap] = await Promise.all([
            auth.getUser(uid).catch(() => null),
            db.collection("users").doc(uid).get(),
            db.collection("users").doc(uid).collection("memberships").get()
        ]);

        const firestoreData = userDoc.exists ? userDoc.data()! : {};
        const organizations = membershipsSnap.docs.map((d) => ({
            tenantId: d.id,
            ...d.data()
        }));

        res.json({
            user: {
                uid,
                email: authUser?.email ?? firestoreData.email ?? null,
                displayName: authUser?.displayName ?? firestoreData.displayName ?? null,
                phoneNumber: authUser?.phoneNumber ?? firestoreData.phoneNumber ?? null,
                photoURL: authUser?.photoURL ?? null,
                emailVerified: authUser?.emailVerified ?? false,
                doNotDisturb: firestoreData.doNotDisturb === true,
                notifySmsOnMissedCalls: firestoreData.notifySmsOnMissedCalls !== false,
                createdAt: authUser?.metadata?.creationTime ?? firestoreData.createdAt ?? null
            },
            organizations
        });
    } catch (error) {
        console.error("Failed to load user profile", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Unable to retrieve user profile." });
    }
});

// PATCH /users/me - Update current user's profile and preferences
router.patch("/me", writeRateLimit, async (req: Request, res: Response) => {
    try {
        const uid = res.locals.user.uid;
        const { displayName, phoneNumber, doNotDisturb, notifySmsOnMissedCalls } = req.body ?? {};

        const authUpdates: { displayName?: string; phoneNumber?: string } = {};
        const firestoreUpdates: Record<string, unknown> = {
            updatedAt: new Date()
        };

        if (typeof displayName === "string") {
            const cleanName = displayName.trim().slice(0, 100);
            authUpdates.displayName = cleanName;
            firestoreUpdates.displayName = cleanName;
        }

        if (typeof phoneNumber === "string") {
            const cleanPhone = phoneNumber.trim();
            if (cleanPhone) {
                authUpdates.phoneNumber = cleanPhone;
                firestoreUpdates.phoneNumber = cleanPhone;
            }
        }

        if (typeof doNotDisturb === "boolean") {
            firestoreUpdates.doNotDisturb = doNotDisturb;
        }

        if (typeof notifySmsOnMissedCalls === "boolean") {
            firestoreUpdates.notifySmsOnMissedCalls = notifySmsOnMissedCalls;
        }

        // Apply Auth updates if any
        if (Object.keys(authUpdates).length > 0) {
            try {
                await auth.updateUser(uid, authUpdates);
            } catch (authErr) {
                console.warn("Firebase Auth profile update warning:", authErr);
            }
        }

        // Update Firestore profile
        await db.collection("users").doc(uid).set(firestoreUpdates, { merge: true });

        const updatedDoc = await db.collection("users").doc(uid).get();
        res.json({
            uid,
            ...updatedDoc.data()
        });
    } catch (error) {
        console.error("Failed to update user profile", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to update profile." });
    }
});

// GET /users/:uid - Lookup user profile (for team member cards)
router.get("/:uid", async (req: Request, res: Response) => {
    try {
        const uid = getUidParam(req, "uid");
        const userDoc = await db.collection("users").doc(uid).get();

        if (!userDoc.exists) {
            // Fallback to Firebase Auth lookup
            try {
                const authUser = await auth.getUser(uid);
                res.json({
                    uid: authUser.uid,
                    displayName: authUser.displayName ?? null,
                    email: authUser.email ?? null,
                    phoneNumber: authUser.phoneNumber ?? null
                });
                return;
            } catch {
                res.status(404).json({ error: "User not found." });
                return;
            }
        }

        const data = userDoc.data()!;
        res.json({
            uid: userDoc.id,
            displayName: data.displayName ?? null,
            email: data.email ?? null,
            phoneNumber: data.phoneNumber ?? null
        });
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to fetch user." });
    }
});

export default router;
