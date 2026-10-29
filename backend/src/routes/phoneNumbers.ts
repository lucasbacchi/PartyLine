import { Router, type Request, type Response } from "express";
import { db } from "../firebase.js";
import { getTenantIdParam, getParam, requireTenantAdmin, requireTenantMember } from "../middleware/tenantAuth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import { validateTwilioPhoneNumber } from "../twilio.js";

const router = Router({ mergeParams: true });

type PhoneNumberItem = {
    id: string;
    number: string;
    label: string;
    isPrimary: boolean;
};

// GET /tenants/:tenantId/phone-numbers - List numbers
router.get("/", requireTenantMember, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const tenantDoc = await db.collection("tenants").doc(tenantId).get();

        if (!tenantDoc.exists) {
            res.status(404).json({ error: "Organization not found." });
            return;
        }

        const phoneNumbers: PhoneNumberItem[] = tenantDoc.data()?.phoneNumbers ?? [];
        res.json({ phoneNumbers });
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to list phone numbers." });
    }
});

// POST /tenants/:tenantId/phone-numbers - Add a phone number
router.post("/", requireTenantAdmin, writeRateLimit, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const { number, label, isPrimary } = req.body ?? {};

        const cleanNumber = validateTwilioPhoneNumber(number, "phone number");
        const cleanLabel = typeof label === "string" ? label.trim().slice(0, 100) : "Main Line";

        const tenantRef = db.collection("tenants").doc(tenantId);
        const tenantDoc = await tenantRef.get();

        if (!tenantDoc.exists) {
            res.status(404).json({ error: "Organization not found." });
            return;
        }

        const currentNumbers: PhoneNumberItem[] = tenantDoc.data()?.phoneNumbers ?? [];

        // Check if number already registered
        if (currentNumbers.some((pn) => pn.number === cleanNumber)) {
            res.status(400).json({ error: "This phone number is already configured for this organization." });
            return;
        }

        const shouldBePrimary = isPrimary === true || currentNumbers.length === 0;
        const newPhoneItem: PhoneNumberItem = {
            id: `pn-${Date.now()}`,
            number: cleanNumber,
            label: cleanLabel,
            isPrimary: shouldBePrimary
        };

        const updatedNumbers = shouldBePrimary
            ? currentNumbers.map((pn) => ({ ...pn, isPrimary: false })).concat(newPhoneItem)
            : [...currentNumbers, newPhoneItem];

        await tenantRef.update({
            phoneNumbers: updatedNumbers,
            updatedAt: new Date()
        });

        res.status(201).json({ phoneNumber: newPhoneItem });
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to add phone number." });
    }
});

// PATCH /tenants/:tenantId/phone-numbers/:phoneId - Update label or primary status
router.patch("/:phoneId", requireTenantAdmin, writeRateLimit, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const phoneId = getParam(req, "phoneId");
        const { label, isPrimary } = req.body ?? {};

        const tenantRef = db.collection("tenants").doc(tenantId);
        const tenantDoc = await tenantRef.get();

        if (!tenantDoc.exists) {
            res.status(404).json({ error: "Organization not found." });
            return;
        }

        const currentNumbers: PhoneNumberItem[] = tenantDoc.data()?.phoneNumbers ?? [];
        const targetIndex = currentNumbers.findIndex((pn) => pn.id === phoneId);

        if (targetIndex === -1) {
            res.status(404).json({ error: "Phone number record not found." });
            return;
        }

        let updatedNumbers = [...currentNumbers];

        if (typeof label === "string") {
            updatedNumbers[targetIndex].label = label.trim().slice(0, 100);
        }

        if (isPrimary === true) {
            updatedNumbers = updatedNumbers.map((pn) => ({
                ...pn,
                isPrimary: pn.id === phoneId
            }));
        }

        await tenantRef.update({
            phoneNumbers: updatedNumbers,
            updatedAt: new Date()
        });

        res.json({ phoneNumber: updatedNumbers[targetIndex] });
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to update phone number." });
    }
});

// DELETE /tenants/:tenantId/phone-numbers/:phoneId - Remove number
router.delete("/:phoneId", requireTenantAdmin, writeRateLimit, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const phoneId = getParam(req, "phoneId");

        const tenantRef = db.collection("tenants").doc(tenantId);
        const tenantDoc = await tenantRef.get();

        if (!tenantDoc.exists) {
            res.status(404).json({ error: "Organization not found." });
            return;
        }

        const currentNumbers: PhoneNumberItem[] = tenantDoc.data()?.phoneNumbers ?? [];
        const remaining = currentNumbers.filter((pn) => pn.id !== phoneId);

        if (remaining.length === currentNumbers.length) {
            res.status(404).json({ error: "Phone number record not found." });
            return;
        }

        // If removed number was primary, designate the first remaining as primary
        if (remaining.length > 0 && !remaining.some((pn) => pn.isPrimary)) {
            remaining[0].isPrimary = true;
        }

        await tenantRef.update({
            phoneNumbers: remaining,
            updatedAt: new Date()
        });

        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to remove phone number." });
    }
});

export default router;
