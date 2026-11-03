import { Router, type Request, type Response } from "express";
import { getTwilioClient, validateTwilioPhoneNumber } from "../twilio.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import { db } from "../firebase.js";

const router = Router();

export type AvailableNumberResult = {
    phoneNumber: string;
    friendlyName: string;
    locality?: string;
    region?: string;
    postalCode?: string;
    isoCountry?: string;
    capabilities: {
        voice: boolean;
        SMS: boolean;
        MMS: boolean;
    };
};

// GET /twilio/available-numbers?areaCode=617&locality=Boston&region=MA&postalCode=02115
router.get("/available-numbers", async (req: Request, res: Response) => {
    const rawAreaCode = typeof req.query.areaCode === "string" ? req.query.areaCode.trim() : "";
    const rawLocality = typeof req.query.locality === "string" ? req.query.locality.trim() : "";
    const rawRegion = typeof req.query.region === "string" ? req.query.region.trim() : "";
    const rawPostalCode = typeof req.query.postalCode === "string" ? req.query.postalCode.trim() : "";
    const rawContains = typeof req.query.contains === "string" ? req.query.contains.trim() : "";

    const listOptions: Record<string, unknown> = {
        limit: 12,
        voiceEnabled: true,
        smsEnabled: true
    };

    if (/^\d{3}$/.test(rawAreaCode)) {
        listOptions.areaCode = Number(rawAreaCode);
    }
    if (rawLocality) {
        listOptions.inLocality = rawLocality;
    }
    if (/^[A-Za-z]{2}$/.test(rawRegion)) {
        listOptions.inRegion = rawRegion.toUpperCase();
    }
    if (rawPostalCode) {
        listOptions.inPostalCode = rawPostalCode.slice(0, 10);
    }
    if (rawContains) {
        listOptions.contains = rawContains.slice(0, 10);
    }

    try {
        const client = getTwilioClient();
        const available = await client.availablePhoneNumbers("US").local.list(listOptions);

        const results: AvailableNumberResult[] = (available || []).map((item) => ({
            phoneNumber: item.phoneNumber,
            friendlyName: item.friendlyName || item.phoneNumber,
            locality: item.locality || undefined,
            region: item.region || undefined,
            postalCode: item.postalCode || undefined,
            isoCountry: item.isoCountry || "US",
            capabilities: {
                voice: item.capabilities?.voice ?? true,
                SMS: item.capabilities?.sms ?? true,
                MMS: item.capabilities?.mms ?? false
            }
        }));

        res.json({ numbers: results });
    } catch (error) {
        console.error("Twilio search phone numbers error:", error);
        res.status(400).json({
            error: error instanceof Error ? error.message : "Unable to search phone numbers from Twilio."
        });
    }
});

// POST /twilio/provision-number - Purchase and allocate a phone number
router.post("/provision-number", writeRateLimit, async (req: Request, res: Response) => {
    try {
        const { phoneNumber, label, tenantId } = req.body ?? {};
        const cleanNumber = validateTwilioPhoneNumber(phoneNumber, "phoneNumber");
        const cleanLabel = typeof label === "string" ? label.trim().slice(0, 100) : "Main Organization Line";

        const client = getTwilioClient();
        const baseUrl = process.env.PUBLIC_BASE_URL?.trim();
        const voiceUrl = baseUrl ? `${baseUrl.replace(/\/+$/, "")}/twilio/webhooks/voice` : undefined;
        const smsUrl = baseUrl ? `${baseUrl.replace(/\/+$/, "")}/twilio/webhooks/sms` : undefined;

        const purchased = await client.incomingPhoneNumbers.create({
            phoneNumber: cleanNumber,
            voiceUrl,
            smsUrl,
            friendlyName: cleanLabel
        });

        // If a tenantId is provided and exists, add it to the tenant's record
        if (typeof tenantId === "string" && tenantId.trim()) {
            const tenantRef = db.collection("tenants").doc(tenantId.trim());
            const tenantDoc = await tenantRef.get();

            if (tenantDoc.exists) {
                const currentNumbers = tenantDoc.data()?.phoneNumbers ?? [];
                const isFirst = currentNumbers.length === 0;
                const newPhoneItem = {
                    id: `pn-${Date.now()}`,
                    number: cleanNumber,
                    label: cleanLabel,
                    isPrimary: isFirst,
                    sid: purchased.sid
                };

                await tenantRef.update({
                    phoneNumbers: [...currentNumbers, newPhoneItem],
                    updatedAt: new Date()
                });
            }
        }

        res.status(201).json({
            success: true,
            phoneNumber: cleanNumber,
            label: cleanLabel,
            sid: purchased.sid
        });
    } catch (error) {
        console.error("Twilio provision number error:", error);
        res.status(400).json({
            error: error instanceof Error ? error.message : "Unable to provision phone number via Twilio."
        });
    }
});

export default router;
