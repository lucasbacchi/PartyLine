import { Router, type Request, type Response } from "express";
import twilio from "twilio";
import { db } from "../firebase.js";
import { requireTenantMember, getTenantIdParam } from "../middleware/tenantAuth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import { getTwilioClient, validateTwilioPhoneNumber } from "../twilio.js";

const router = Router({ mergeParams: true });

type CallHistoryItem = {
    sid: string;
    from: string;
    to: string;
    status: string;
    direction: string;
    duration: number | null;
    createdAt: string | null;
    startedAt: string | null;
};

type TextHistoryItem = {
    sid: string;
    from: string;
    to: string;
    body: string;
    status: string;
    direction: string;
    createdAt: string | null;
    sentAt: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function getPhoneNumbers(value: unknown): string[] {
    if (!Array.isArray(value)) return [];

    return [
        ...new Set(
            value.flatMap((item): string[] => {
                if (!isRecord(item) || typeof item.number !== "string") return [];
                const number = item.number.trim();
                return /^\+[1-9]\d{7,14}$/.test(number) ? [number] : [];
            })
        )
    ];
}

function parseLimit(value: unknown): number {
    if (value === undefined) return 50;
    if (typeof value !== "string" || !/^\d+$/.test(value)) {
        throw new Error("limit must be an integer between 1 and 100.");
    }

    const limit = Number(value);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        throw new Error("limit must be an integer between 1 and 100.");
    }
    return limit;
}

function timestamp(value: string | null): number {
    return value ? Date.parse(value) || 0 : 0;
}

function handleInvalidQuery(error: unknown, res: Response): boolean {
    if (!(error instanceof Error)) return false;
    res.status(400).json({ error: error.message });
    return true;
}

async function loadTenantNumbers(tenantId: string): Promise<{ exists: boolean; numbers: string[] }> {
    const tenant = await db.collection("tenants").doc(tenantId).get();
    return {
        exists: tenant.exists,
        numbers: getPhoneNumbers(tenant.data()?.phoneNumbers)
    };
}

router.get("/calls", requireTenantMember, async (req: Request, res: Response) => {
    let tenantId: string;
    let limit: number;
    try {
        tenantId = getTenantIdParam(req);
        limit = parseLimit(req.query.limit);
    } catch (error) {
        if (!handleInvalidQuery(error, res)) {
            res.status(400).json({ error: "Invalid call history request." });
        }
        return;
    }

    try {
        const tenant = await loadTenantNumbers(tenantId);
        if (!tenant.exists) {
            res.status(404).json({ error: "Organization not found." });
            return;
        }
        if (tenant.numbers.length === 0) {
            res.json({ calls: [] });
            return;
        }

        const client = getTwilioClient();
        const callsBySid = new Map<string, CallHistoryItem>();
        for (const phoneNumber of tenant.numbers) {
            const [toNumber, fromNumber] = await Promise.all([
                client.calls.list({ to: phoneNumber, limit }),
                client.calls.list({ from: phoneNumber, limit })
            ]);

            for (const call of [...toNumber, ...fromNumber]) {
                const duration = call.duration === null ? null : Number.parseInt(call.duration, 10);
                callsBySid.set(call.sid, {
                    sid: call.sid,
                    from: call.from,
                    to: call.to,
                    status: call.status,
                    direction: call.direction,
                    duration: duration !== null && Number.isFinite(duration) ? duration : null,
                    createdAt: call.dateCreated?.toISOString() ?? null,
                    startedAt: call.startTime?.toISOString() ?? null
                });
            }
        }

        const calls = [...callsBySid.values()]
            .sort((a, b) => timestamp(b.createdAt ?? b.startedAt) - timestamp(a.createdAt ?? a.startedAt))
            .slice(0, limit);
        res.json({ calls });
    } catch (error) {
        console.error("Twilio call history fetch failed", error);
        res.status(502).json({ error: "Unable to fetch call history from Twilio." });
    }
});

router.get("/texts", requireTenantMember, async (req: Request, res: Response) => {
    let tenantId: string;
    let limit: number;
    try {
        tenantId = getTenantIdParam(req);
        limit = parseLimit(req.query.limit);
    } catch (error) {
        if (!handleInvalidQuery(error, res)) {
            res.status(400).json({ error: "Invalid text history request." });
        }
        return;
    }

    try {
        const tenant = await loadTenantNumbers(tenantId);
        if (!tenant.exists) {
            res.status(404).json({ error: "Organization not found." });
            return;
        }
        if (tenant.numbers.length === 0) {
            res.json({ messages: [] });
            return;
        }

        const client = getTwilioClient();
        const messagesBySid = new Map<string, TextHistoryItem>();
        for (const phoneNumber of tenant.numbers) {
            const [toNumber, fromNumber] = await Promise.all([
                client.messages.list({ to: phoneNumber, limit }),
                client.messages.list({ from: phoneNumber, limit })
            ]);

            for (const message of [...toNumber, ...fromNumber]) {
                messagesBySid.set(message.sid, {
                    sid: message.sid,
                    from: message.from,
                    to: message.to,
                    body: message.body.slice(0, 1600),
                    status: message.status,
                    direction: message.direction,
                    createdAt: message.dateCreated?.toISOString() ?? null,
                    sentAt: message.dateSent?.toISOString() ?? null
                });
            }
        }

        const messages = [...messagesBySid.values()]
            .sort((a, b) => timestamp(b.createdAt ?? b.sentAt) - timestamp(a.createdAt ?? a.sentAt))
            .slice(0, limit);
        res.json({ messages });
    } catch (error) {
        console.error("Twilio text history fetch failed", error);
        res.status(502).json({ error: "Unable to fetch text history from Twilio." });
    }
});

// POST /tenants/:tenantId/texts - Send an SMS message
router.post("/texts", requireTenantMember, writeRateLimit, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const { to, body, from } = req.body ?? {};

        if (!body || typeof body !== "string" || !body.trim()) {
            res.status(400).json({ error: "Message body is required." });
            return;
        }

        const cleanBody = body.trim().slice(0, 1600);
        const cleanTo = validateTwilioPhoneNumber(to, "to");

        const tenant = await loadTenantNumbers(tenantId);
        if (!tenant.exists || tenant.numbers.length === 0) {
            res.status(400).json({ error: "Organization has no configured phone numbers to send from." });
            return;
        }

        // Pick requested 'from' or tenant's primary/first number
        let senderNumber = tenant.numbers[0];
        if (typeof from === "string" && tenant.numbers.includes(from.trim())) {
            senderNumber = from.trim();
        }

        const client = getTwilioClient();
        const sent = await client.messages.create({
            from: senderNumber,
            to: cleanTo,
            body: cleanBody
        });

        // Store event in twilio_events
        await db.collection("twilio_events").add({
            type: "sms",
            sid: sent.sid,
            from: sent.from,
            to: sent.to,
            body: cleanBody,
            direction: "outbound-api",
            status: sent.status,
            tenantId,
            receivedAt: new Date()
        });

        res.status(201).json({
            message: {
                sid: sent.sid,
                from: sent.from,
                to: sent.to,
                body: cleanBody,
                status: sent.status,
                direction: "outbound-api",
                createdAt: sent.dateCreated ? sent.dateCreated.toISOString() : new Date().toISOString(),
                sentAt: sent.dateSent ? sent.dateSent.toISOString() : new Date().toISOString()
            }
        });
    } catch (error) {
        console.error("Twilio send SMS error:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to send SMS message." });
    }
});

// POST /tenants/:tenantId/calls - Initiate a call back (Twilio bridge)
router.post("/calls", requireTenantMember, writeRateLimit, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const { to, memberPhone } = req.body ?? {};

        const cleanTo = validateTwilioPhoneNumber(to, "to");

        const tenant = await loadTenantNumbers(tenantId);
        if (!tenant.exists || tenant.numbers.length === 0) {
            res.status(400).json({ error: "Organization has no configured phone numbers." });
            return;
        }

        const senderNumber = tenant.numbers[0];

        // Determine destination for bridge: member's phone number
        let targetMemberPhone = typeof memberPhone === "string" ? memberPhone.trim() : "";
        if (!targetMemberPhone && res.locals.user?.uid) {
            const memberDoc = await db
                .collection("tenants")
                .doc(tenantId)
                .collection("members")
                .doc(res.locals.user.uid)
                .get();
            targetMemberPhone = memberDoc.data()?.phoneNumber || "";
        }

        if (!targetMemberPhone) {
            res.status(400).json({
                error: "No member phone number found to bridge call to. Please configure a contact phone number on your profile."
            });
            return;
        }

        const cleanMemberPhone = validateTwilioPhoneNumber(targetMemberPhone, "memberPhone");

        const client = getTwilioClient();
        const voiceResponse = new twilio.twiml.VoiceResponse();
        const dial = voiceResponse.dial({ callerId: senderNumber });
        dial.number(cleanTo);

        const call = await client.calls.create({
            from: senderNumber,
            to: cleanMemberPhone,
            twiml: voiceResponse.toString()
        });

        await db.collection("twilio_events").add({
            type: "call",
            sid: call.sid,
            from: senderNumber,
            to: cleanTo,
            memberPhone: cleanMemberPhone,
            status: call.status,
            direction: "outbound-dial",
            tenantId,
            receivedAt: new Date()
        });

        res.status(201).json({
            call: {
                sid: call.sid,
                status: call.status,
                from: senderNumber,
                to: cleanTo
            }
        });
    } catch (error) {
        console.error("Twilio call back error:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to initiate call back." });
    }
});

export default router;
