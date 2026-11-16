import "dotenv/config";
import cors from "cors";
import express, { type Request, type Response } from "express";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { auth, checkFirebaseServices, db, uploadRecordingToFirebaseStorage, type TenantRole } from "./firebase.js";
import twilio from "twilio";
import { requireAdmin, requireAppCheck, requireFirebaseAuth } from "./middleware/firebase.js";
import { authenticatedRateLimit, publicRateLimit, writeRateLimit } from "./middleware/rateLimit.js";
import {
    checkTwilioServices,
    formatPhoneForSpeech,
    getPhoneNumbers,
    getTwilioClient,
    getTwilioConfig,
    getTwilioWebhookAuthToken,
    validateTwilioPhoneNumber
} from "./twilio.js";
import usersRouter from "./routes/users.js";
import tenantsRouter from "./routes/tenants.js";
import membersRouter from "./routes/members.js";
import phoneNumbersRouter from "./routes/phoneNumbers.js";
import eventsRouter, { isEventCurrentlyActive } from "./routes/events.js";
import invitesRouter from "./routes/invites.js";
import joinRouter from "./routes/join.js";
import twilioNumbersRouter from "./routes/twilioNumbers.js";
import communicationHistoryRouter from "./routes/communicationHistory.js";

const app = express();
const port = Number(process.env.PORT ?? 8080);
const allowedOrigins = (
    process.env.ALLOWED_ORIGINS ??
    "https://partyline.lucasbacchi.com,https://api.partyline.lucasbacchi.com,http://localhost:5173,http://localhost:5174"
)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.disable("x-powered-by");
app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
            if (!origin) {
                return callback(null, true);
            }
            // Allow exact match from configured origins
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            // Allow any localhost or 127.0.0.1 port in local development
            if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
                return callback(null, true);
            }
            return callback(null, false);
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Firebase-AppCheck"]
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const tenantRoles: TenantRole[] = ["owner", "admin", "member", "viewer"];

function getTenantId(req: Request): string {
    const tenantId = req.params.tenantId;
    if (typeof tenantId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(tenantId)) {
        throw new Error("tenantId must contain only letters, numbers, underscores, or hyphens.");
    }
    return tenantId;
}

function getUid(req: Request): string {
    const uid = req.params.uid;
    if (typeof uid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
        throw new Error("uid is invalid.");
    }
    return uid;
}

function getRole(value: unknown): TenantRole {
    if (typeof value !== "string" || !tenantRoles.includes(value as TenantRole)) {
        throw new Error(`role must be one of: ${tenantRoles.join(", ")}.`);
    }
    return value as TenantRole;
}

function getMemberReference(req: Request) {
    const tenantId = getTenantId(req);
    const uid = getUid(req);
    return db.collection("tenants").doc(tenantId).collection("members").doc(uid);
}

function getOptionalString(value: unknown, fieldName: string): string | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string" || value.length > 256)
        throw new Error(`${fieldName} must be a string of 256 characters or fewer.`);
    return value.trim();
}

function getWebhookUrl(req: Request): string {
    const baseUrl = process.env.PUBLIC_BASE_URL?.trim();

    if (baseUrl && !baseUrl.includes("localhost") && !baseUrl.includes("127.0.0.1")) {
        const parsedBaseUrl = new URL(baseUrl);
        return new URL(req.originalUrl, `${parsedBaseUrl.toString().replace(/\/+$/, "")}/`).toString();
    }

    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
    const host = (req.headers["x-forwarded-host"] as string) || req.get("host") || "localhost:8080";
    return `${proto}://${host}${req.originalUrl}`;
}

export function getPublicUrl(path: string): string {
    const baseUrl = (process.env.PUBLIC_BASE_URL?.trim() || "https://api.partyline.lucasbacchi.com").replace(
        /\/+$/,
        ""
    );
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`;
}

function requireValidTwilioRequest(req: Request, res: Response): boolean {
    const signature = req.header("X-Twilio-Signature");

    if (!signature) {
        if (process.env.SKIP_TWILIO_VALIDATION === "true" || process.env.NODE_ENV !== "production") {
            return true;
        }
        res.status(401).type("text/plain").send("Missing Twilio signature");
        return false;
    }

    try {
        const webhookUrl = getWebhookUrl(req);
        const isValid = twilio.validateRequest(
            getTwilioWebhookAuthToken(),
            signature,
            webhookUrl,
            req.body as Record<string, string>
        );

        if (!isValid) {
            console.warn(`Rejected Twilio webhook signature for ${req.method} ${webhookUrl}`);
            if (process.env.SKIP_TWILIO_VALIDATION === "true" || process.env.NODE_ENV !== "production") {
                return true;
            }
            res.status(401).type("text/plain").send("Invalid Twilio signature");
            return false;
        }

        return true;
    } catch (error) {
        console.error("Twilio webhook validation failed", error);
        if (process.env.SKIP_TWILIO_VALIDATION === "true" || process.env.NODE_ENV !== "production") {
            return true;
        }
        res.status(500).type("text/plain").send("Twilio webhook validation is unavailable");
        return false;
    }
}

// Root endpoint
app.get("/", (_req: Request, res: Response) => {
    res.json({ name: "PartyLine API", status: "ok" });
});

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
});

app.get("/twilio/health", publicRateLimit, async (_req: Request, res: Response) => {
    const services = await checkTwilioServices();
    const status = Object.values(services).every((service) => service === "ok") ? "ok" : "degraded";

    res.status(status === "ok" ? 200 : 503).json({
        status,
        services,
        webhooks: {
            voice: "/twilio/webhooks/voice",
            sms: "/twilio/webhooks/sms"
        }
    });
});

app.post("/twilio/webhooks/voice", async (req: Request, res: Response) => {
    if (!requireValidTwilioRequest(req, res)) {
        return;
    }

    try {
        const to = (req.body.To || req.body.Called || "").trim();
        const from = (req.body.From || req.body.Caller || "").trim();

        // 1. Find matching tenant by phone number
        interface TenantSettings {
            answerMessage?: string;
            ringTimeoutSeconds?: number | string;
            fallbackPhone?: string;
            enableWebCalls?: boolean;
            routingStrategy?: string;
            [key: string]: unknown;
        }

        interface TenantRecord {
            phoneNumbers?: unknown;
            settings?: TenantSettings;
            [key: string]: unknown;
        }

        interface ActiveEventRecord {
            id: string;
            title?: string;
            primaryHostUid?: string;
            primaryHostPhone?: string;
            backupHostUid?: string;
            backupHostPhone?: string;
            [key: string]: unknown;
        }

        const tenantsSnap = await db.collection("tenants").get();
        let matchedTenant: TenantRecord | null = null;
        let matchedTenantId: string | null = null;
        for (const doc of tenantsSnap.docs) {
            const data = doc.data() as TenantRecord;
            const numbers = getPhoneNumbers(data.phoneNumbers);
            if (numbers.includes(to)) {
                matchedTenant = data;
                matchedTenantId = doc.id;
                break;
            }
        }

        // Fallback: pick first tenant with numbers if exact match not found
        if (!matchedTenant && tenantsSnap.docs.length > 0) {
            matchedTenant = tenantsSnap.docs[0].data() as TenantRecord;
            matchedTenantId = tenantsSnap.docs[0].id;
        }

        // 2. Check for active on-duty event right now
        const now = new Date();
        let activeEvent: ActiveEventRecord | null = null;
        if (matchedTenantId) {
            const eventsSnap = await db.collection("tenants").doc(matchedTenantId).collection("events").get();
            const activeDoc = eventsSnap.docs.find((d: QueryDocumentSnapshot) => isEventCurrentlyActive(d.data(), now));
            if (activeDoc) {
                activeEvent = { id: activeDoc.id, ...activeDoc.data() } as ActiveEventRecord;
            }
        }

        const response = new twilio.twiml.VoiceResponse();

        // Optional custom greeting from settings
        const greeting = matchedTenant?.settings?.answerMessage;
        if (greeting && typeof greeting === "string" && greeting.trim()) {
            response.say(greeting.trim());
        }

        const ringTimeout = Math.min(60, Math.max(10, Number(matchedTenant?.settings?.ringTimeoutSeconds ?? 25)));

        const dialStatusUrl = getPublicUrl(
            `/twilio/webhooks/voice/dial-status?tenantId=${matchedTenantId || ""}&eventId=${activeEvent?.id || ""}&attempt=primary&caller=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        );

        const dial = response.dial({
            timeout: ringTimeout,
            callerId: from || to,
            answerOnBridge: true,
            action: dialStatusUrl,
            method: "POST"
        });

        let hasTargets = false;

        // 3. Evaluate on-duty host preferences and presence
        const orgEnableWebCalls = matchedTenant?.settings?.enableWebCalls !== false;

        if (matchedTenantId && activeEvent?.primaryHostUid) {
            const hostUserDoc = await db.collection("users").doc(activeEvent.primaryHostUid).get();
            const hostData = hostUserDoc.exists ? hostUserDoc.data() : null;

            const hostDnd = hostData?.doNotDisturb === true;
            const hostEnableWebCalls = hostData?.enableWebCalls !== false;
            const hostWebStatus = typeof hostData?.webStatus === "string" ? hostData.webStatus : "offline";
            const hostLastActive = hostData?.webLastActiveAt?.toDate
                ? hostData.webLastActiveAt.toDate()
                : hostData?.webLastActiveAt
                  ? new Date(hostData.webLastActiveAt as string | number)
                  : null;

            // Host is actively using the web app if:
            // 1. Org and host both permit web calls
            // 2. Web status is "active" (not idle or offline)
            // 3. Heartbeat was received within the last 2 minutes (120 seconds)
            const isHostActiveOnWeb =
                orgEnableWebCalls &&
                hostEnableWebCalls &&
                hostWebStatus === "active" &&
                hostLastActive !== null &&
                now.getTime() - hostLastActive.getTime() < 120_000;

            if (!hostDnd) {
                // If user has the app open and is actively using it, ring WebRTC device in browser
                if (isHostActiveOnWeb) {
                    dial.client(`member_${matchedTenantId}_${activeEvent.primaryHostUid}`);
                    hasTargets = true;
                }

                // DTMF Call Screening: when ringing volunteer's mobile, whisper screening prompt requiring keypress '1'
                if (activeEvent.primaryHostPhone) {
                    try {
                        const cleanPhone = validateTwilioPhoneNumber(activeEvent.primaryHostPhone, "primaryHostPhone");
                        const screenUrl = getPublicUrl(
                            `/twilio/webhooks/voice/screen?tenantId=${matchedTenantId || ""}&hostUid=${activeEvent.primaryHostUid || ""}&caller=${encodeURIComponent(from)}&eventTitle=${encodeURIComponent(activeEvent.title || "PartyLine Rental")}&role=primary`
                        );
                        dial.number({ url: screenUrl, method: "POST" }, cleanPhone);
                        hasTargets = true;
                    } catch {}
                }
            } else {
                console.log(`Primary host ${activeEvent.primaryHostUid} is on Do Not Disturb.`);
            }
        }

        // If no active event, ring active tenant members who are active on web
        if (!activeEvent && matchedTenantId) {
            const membersSnap = await db
                .collection("tenants")
                .doc(matchedTenantId)
                .collection("members")
                .where("active", "==", true)
                .get();

            if (orgEnableWebCalls) {
                for (const mDoc of membersSnap.docs) {
                    const memberUserDoc = await db.collection("users").doc(mDoc.id).get();
                    const mData = memberUserDoc.exists ? memberUserDoc.data() : null;
                    const mEnableWebCalls = mData?.enableWebCalls !== false;
                    const mWebStatus = typeof mData?.webStatus === "string" ? mData.webStatus : "offline";
                    const mLastActive = mData?.webLastActiveAt?.toDate
                        ? mData.webLastActiveAt.toDate()
                        : mData?.webLastActiveAt
                          ? new Date(mData.webLastActiveAt as string | number)
                          : null;

                    const isMemberActiveOnWeb =
                        mEnableWebCalls &&
                        mWebStatus === "active" &&
                        mLastActive !== null &&
                        now.getTime() - mLastActive.getTime() < 120_000;

                    if (isMemberActiveOnWeb && mData?.doNotDisturb !== true) {
                        dial.client(`member_${matchedTenantId}_${mDoc.id}`);
                        hasTargets = true;
                    }
                }
            }
        }

        // 4. If no event target, ring fallback phone with DTMF screening if configured
        if (!hasTargets && matchedTenant?.settings?.fallbackPhone) {
            try {
                const cleanFallback = validateTwilioPhoneNumber(matchedTenant.settings.fallbackPhone, "fallbackPhone");
                const screenUrl = getPublicUrl(
                    `/twilio/webhooks/voice/screen?tenantId=${matchedTenantId || ""}&caller=${encodeURIComponent(from)}&eventTitle=PartyLine&role=fallback`
                );
                dial.number({ url: screenUrl, method: "POST" }, cleanFallback);
                hasTargets = true;
            } catch {}
        }

        // 5. If no targets at all, route directly to PartyLine Voicemail
        if (!hasTargets) {
            response.say(
                "Thank you for calling PartyLine. No team members are currently available to take your call. Please leave your name, phone number, and a detailed message after the tone."
            );
            const vmActionUrl = getPublicUrl(
                `/twilio/webhooks/voice/voicemail?tenantId=${matchedTenantId || ""}&eventId=${activeEvent?.id || ""}&caller=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
            );
            const recStatusUrl = getPublicUrl(
                `/twilio/webhooks/voice/recording-status?tenantId=${matchedTenantId || ""}&eventId=${activeEvent?.id || ""}&type=voicemail&caller=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
            );
            const transUrl = getPublicUrl(
                `/twilio/webhooks/voice/transcription?tenantId=${matchedTenantId || ""}&eventId=${activeEvent?.id || ""}&caller=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
            );
            response.record({
                action: vmActionUrl,
                recordingStatusCallback: recStatusUrl,
                transcribe: true,
                transcribeCallback: transUrl,
                maxLength: 180,
                playBeep: true
            });
            response.say("We did not receive a message. Thank you for calling. Goodbye.");
            response.hangup();
        }

        // 6. Log inbound call event in Firestore
        try {
            await db.collection("twilio_events").add({
                type: "call",
                sid: req.body.CallSid ?? null,
                from: from || null,
                to: to || null,
                status: req.body.CallStatus ?? "in-progress",
                direction: "inbound",
                tenantId: matchedTenantId || null,
                eventId: activeEvent?.id || null,
                eventTitle: activeEvent?.title || null,
                receivedAt: new Date()
            });
        } catch (error) {
            console.error("Unable to record inbound Twilio call", error);
        }

        res.type("text/xml").send(response.toString());
    } catch (error) {
        console.error("Inbound voice webhook error:", error);
        const response = new twilio.twiml.VoiceResponse();
        response.say("An error occurred while connecting your call. Please try again later.");
        res.type("text/xml").send(response.toString());
    }
});

// DTMF Call Screening: Webhook executed when volunteer / staff member answers their phone
app.post("/twilio/webhooks/voice/screen", (req: Request, res: Response) => {
    if (!requireValidTwilioRequest(req, res)) return;

    const caller = (req.query.caller as string) || (req.body.From as string) || "";
    const eventTitle = (req.query.eventTitle as string) || "PartyLine Rental";

    const response = new twilio.twiml.VoiceResponse();
    const confirmUrl = getPublicUrl("/twilio/webhooks/voice/screen/confirm");

    const gather = response.gather({
        action: confirmUrl,
        method: "POST",
        numDigits: 1,
        timeout: 10
    });

    const spokenCaller = formatPhoneForSpeech(caller);
    gather.say(
        `PartyLine call for ${eventTitle} from ${spokenCaller}. Press 1 to accept this call, or hang up to decline.`
    );

    // If volunteer doesn't press 1 within 10s or if personal carrier voicemail picked up:
    response.say("Call not accepted. Goodbye.");
    response.hangup();

    res.type("text/xml").send(response.toString());
});

// DTMF Call Screening Confirm: Connects caller if 1 is pressed; otherwise declines
app.post("/twilio/webhooks/voice/screen/confirm", (req: Request, res: Response) => {
    if (!requireValidTwilioRequest(req, res)) return;

    const digits = (req.body.Digits as string) || "";
    const response = new twilio.twiml.VoiceResponse();

    if (digits.trim() === "1") {
        response.say("Connecting you now.");
        // No hangup! Twilio bridges the volunteer and caller
    } else {
        response.say("Call declined. Goodbye.");
        response.hangup();
    }

    res.type("text/xml").send(response.toString());
});

// Dial Status Callback: Handles fallback to backup host, then rollover to PartyLine voicemail
app.post("/twilio/webhooks/voice/dial-status", async (req: Request, res: Response) => {
    if (!requireValidTwilioRequest(req, res)) return;

    const dialStatus = (req.body.DialCallStatus as string) || "";
    const attempt = (req.query.attempt as string) || "primary";
    const tenantId = (req.query.tenantId as string) || "";
    const eventId = (req.query.eventId as string) || "";
    const caller = (req.query.caller as string) || (req.body.From as string) || "";
    const to = (req.query.to as string) || (req.body.To as string) || "";

    const response = new twilio.twiml.VoiceResponse();

    // If call was connected and completed, hang up cleanly
    if (dialStatus === "completed") {
        response.hangup();
        res.type("text/xml").send(response.toString());
        return;
    }

    // Call was not answered or rejected (busy, no-answer, canceled, failed)
    // Check if primary attempt failed and backup host exists
    if (attempt === "primary" && tenantId && eventId) {
        try {
            const eventDoc = await db.collection("tenants").doc(tenantId).collection("events").doc(eventId).get();
            const eventData = eventDoc.exists ? eventDoc.data() : null;

            if (eventData?.backupHostPhone) {
                const cleanBackup = validateTwilioPhoneNumber(eventData.backupHostPhone, "backupHostPhone");
                response.say(
                    "The primary host is unavailable. Please hold while we connect you to our backup host on duty."
                );

                const backupStatusUrl = getPublicUrl(
                    `/twilio/webhooks/voice/dial-status?tenantId=${tenantId}&eventId=${eventId}&attempt=backup&caller=${encodeURIComponent(caller)}&to=${encodeURIComponent(to)}`
                );

                const dial = response.dial({
                    timeout: 20,
                    callerId: to || caller,
                    action: backupStatusUrl,
                    method: "POST"
                });

                const backupScreenUrl = getPublicUrl(
                    `/twilio/webhooks/voice/screen?tenantId=${tenantId}&hostUid=${eventData.backupHostUid || ""}&caller=${encodeURIComponent(caller)}&eventTitle=${encodeURIComponent(eventData.title || "PartyLine Rental")}&role=backup`
                );
                dial.number({ url: backupScreenUrl, method: "POST" }, cleanBackup);

                res.type("text/xml").send(response.toString());
                return;
            }
        } catch (err) {
            console.warn("Failed checking backup host on dial status callback:", err);
        }
    }

    // If backup host failed or no backup host: Route to PartyLine Voicemail!
    response.say(
        "Thank you for calling. No team members are currently available to take your call. Please leave your name, phone number, and a detailed message after the tone."
    );

    const vmActionUrl = getPublicUrl(
        `/twilio/webhooks/voice/voicemail?tenantId=${tenantId}&eventId=${eventId}&caller=${encodeURIComponent(caller)}&to=${encodeURIComponent(to)}`
    );
    const recordingStatusUrl = getPublicUrl(
        `/twilio/webhooks/voice/recording-status?tenantId=${tenantId}&eventId=${eventId}&type=voicemail&caller=${encodeURIComponent(caller)}&to=${encodeURIComponent(to)}`
    );
    const transcriptionUrl = getPublicUrl(
        `/twilio/webhooks/voice/transcription?tenantId=${tenantId}&eventId=${eventId}&caller=${encodeURIComponent(caller)}&to=${encodeURIComponent(to)}`
    );

    response.record({
        action: vmActionUrl,
        recordingStatusCallback: recordingStatusUrl,
        transcribe: true,
        transcribeCallback: transcriptionUrl,
        maxLength: 180,
        playBeep: true
    });

    response.say("We did not receive a message. Thank you for calling. Goodbye.");
    response.hangup();

    res.type("text/xml").send(response.toString());
});

// Voicemail completion prompt
app.post("/twilio/webhooks/voice/voicemail", (req: Request, res: Response) => {
    if (!requireValidTwilioRequest(req, res)) return;

    const response = new twilio.twiml.VoiceResponse();
    response.say("Thank you for your message. Your team has been notified. Goodbye.");
    response.hangup();

    res.type("text/xml").send(response.toString());
});

// Recording Status Callback: Archives audio and saves metadata to Firestore
app.post("/twilio/webhooks/voice/recording-status", async (req: Request, res: Response) => {
    if (!requireValidTwilioRequest(req, res)) return;

    try {
        const recordingSid = req.body.RecordingSid as string;
        const callSid = req.body.CallSid as string;
        const recordingUrl = req.body.RecordingUrl as string;
        const duration = Number(req.body.RecordingDuration) || 0;
        const tenantId = (req.query.tenantId as string) || "";
        const eventId = (req.query.eventId as string) || "";
        const caller = (req.query.caller as string) || req.body.From || "";
        const to = (req.query.to as string) || req.body.To || "";
        const type = (req.query.type as string) || "voicemail";

        if (!recordingSid || !recordingUrl) {
            res.status(200).send("OK");
            return;
        }

        const mp3Url = recordingUrl.endsWith(".mp3") ? recordingUrl : `${recordingUrl}.mp3`;

        const recordingRecord = {
            sid: recordingSid,
            callSid: callSid || null,
            tenantId: tenantId || null,
            eventId: eventId || null,
            from: caller || null,
            to: to || null,
            duration,
            url: mp3Url,
            type, // "voicemail" | "call_recording"
            status: "completed",
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await db.collection("recordings").doc(recordingSid).set(recordingRecord, { merge: true });

        // Asynchronously copy recording to Firebase Storage for permanent archival
        if (tenantId) {
            const config = getTwilioConfig();
            const authHeader =
                "Basic " + Buffer.from(`${config.accountSid}:${getTwilioWebhookAuthToken()}`).toString("base64");
            uploadRecordingToFirebaseStorage(tenantId, recordingSid, mp3Url, authHeader)
                .then(async (storageUrl) => {
                    await db.collection("recordings").doc(recordingSid).set(
                        {
                            storageUrl,
                            url: storageUrl,
                            updatedAt: new Date()
                        },
                        { merge: true }
                    );
                })
                .catch((err: unknown) => console.warn("Background Firebase Storage upload notice:", err));
        }

        res.status(200).type("text/plain").send("OK");
    } catch (err) {
        console.error("Recording status webhook error:", err);
        res.status(500).type("text/plain").send("Error");
    }
});

// Helper: Dispatches SMS notification to on-duty host when a voicemail arrives
async function notifyHostOfVoicemail(tenantId: string, eventId: string, caller: string, transcript: string) {
    if (!tenantId) return;

    let targetPhone = "";
    if (eventId) {
        const eventDoc = await db.collection("tenants").doc(tenantId).collection("events").doc(eventId).get();
        if (eventDoc.exists) {
            const data = eventDoc.data();
            const hostUid = data?.primaryHostUid;
            if (hostUid) {
                const hostDoc = await db.collection("users").doc(hostUid).get();
                if (hostDoc.exists && hostDoc.data()?.notifySmsOnMissedCalls !== false) {
                    targetPhone = data?.primaryHostPhone || hostDoc.data()?.phoneNumber || "";
                }
            }
        }
    }

    if (!targetPhone) return;

    const tenantDoc = await db.collection("tenants").doc(tenantId).get();
    const numbers = getPhoneNumbers(tenantDoc.data()?.phoneNumbers);
    if (numbers.length === 0) return;

    const sender = numbers[0];
    const preview = transcript.length > 120 ? `${transcript.slice(0, 117)}...` : transcript;
    const body = `[PartyLine Voicemail Alert] New message from ${caller}: "${preview}". Listen in your Call Inbox.`;

    const client = getTwilioClient();
    await client.messages.create({
        from: sender,
        to: targetPhone,
        body
    });
}

// Transcription Callback: Saves transcription text and alerts on-duty host
app.post("/twilio/webhooks/voice/transcription", async (req: Request, res: Response) => {
    if (!requireValidTwilioRequest(req, res)) return;

    try {
        const recordingSid = req.body.RecordingSid as string;
        const transcriptionText = (req.body.TranscriptionText as string) || "";
        const transcriptionStatus = (req.body.TranscriptionStatus as string) || "completed";
        const tenantId = (req.query.tenantId as string) || "";
        const eventId = (req.query.eventId as string) || "";
        const caller = (req.query.caller as string) || req.body.From || "";

        if (recordingSid) {
            await db.collection("recordings").doc(recordingSid).set(
                {
                    transcriptionText,
                    transcriptionStatus,
                    updatedAt: new Date()
                },
                { merge: true }
            );

            if (tenantId && transcriptionText) {
                notifyHostOfVoicemail(tenantId, eventId, caller, transcriptionText).catch((err: unknown) =>
                    console.warn("Could not dispatch voicemail SMS notification:", err)
                );
            }
        }

        res.status(200).type("text/plain").send("OK");
    } catch (err) {
        console.error("Transcription webhook error:", err);
        res.status(500).type("text/plain").send("Error");
    }
});

app.post("/twilio/webhooks/voice/outbound", async (req: Request, res: Response) => {
    // If signature validation is enforced in production, check signature
    if (process.env.NODE_ENV === "production" && process.env.SKIP_TWILIO_VALIDATION !== "true") {
        if (!requireValidTwilioRequest(req, res)) {
            return;
        }
    }

    try {
        const to = (req.body.To || req.body.Called || "").trim();
        const tenantId = (req.body.tenantId || "").trim();

        let callerId: string | null =
            typeof req.body.callerId === "string" && req.body.callerId.trim() ? req.body.callerId.trim() : null;

        if (!callerId && tenantId) {
            const tenantDoc = await db.collection("tenants").doc(tenantId).get();
            const numbers = getPhoneNumbers(tenantDoc.data()?.phoneNumbers);
            if (numbers.length > 0) {
                callerId = numbers[0];
            }
        }

        if (!callerId) {
            const tenantsSnapshot = await db.collection("tenants").limit(5).get();
            for (const doc of tenantsSnapshot.docs) {
                const numbers = getPhoneNumbers(doc.data()?.phoneNumbers);
                if (numbers.length > 0) {
                    callerId = numbers[0];
                    break;
                }
            }
        }

        const twiml = new twilio.twiml.VoiceResponse();

        if (!callerId) {
            console.error("No caller ID available for outbound WebRTC call");
            twiml.say("No organization phone number configured to place this call.");
            res.type("text/xml").send(twiml.toString());
            return;
        }

        if (!to) {
            twiml.say("No destination phone number was provided.");
            res.type("text/xml").send(twiml.toString());
            return;
        }

        const cleanTo = validateTwilioPhoneNumber(to, "to");
        const dial = twiml.dial({
            callerId: callerId,
            answerOnBridge: true
        });
        dial.number(cleanTo);

        try {
            await db.collection("twilio_events").add({
                type: "call",
                sid: req.body.CallSid ?? null,
                from: callerId,
                to: cleanTo,
                clientIdentity: req.body.From ?? null,
                status: "initiated",
                direction: "outbound-webrtc",
                tenantId: tenantId || null,
                receivedAt: new Date()
            });
        } catch (e) {
            console.error("Failed to log outbound call event", e);
        }

        res.type("text/xml").send(twiml.toString());
    } catch (error) {
        console.error("Outbound voice webhook error:", error);
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say("An error occurred while connecting your call. Please check the number and try again.");
        res.type("text/xml").send(twiml.toString());
    }
});

app.post("/twilio/webhooks/sms", async (req: Request, res: Response) => {
    if (!requireValidTwilioRequest(req, res)) {
        return;
    }

    const response = new twilio.twiml.MessagingResponse();

    try {
        await db.collection("twilio_events").add({
            type: "sms",
            sid: req.body.MessageSid ?? null,
            from: req.body.From ?? null,
            to: req.body.To ?? null,
            body: typeof req.body.Body === "string" ? req.body.Body.slice(0, 1600) : null,
            receivedAt: new Date()
        });
    } catch (error) {
        console.error("Unable to record inbound Twilio SMS", error);
    }

    res.type("text/xml").send(response.toString());
});

app.get("/firebase/health", publicRateLimit, async (_req: Request, res: Response) => {
    const services = await checkFirebaseServices();
    const status = Object.values(services).every((service) => service === "ok") ? "ok" : "degraded";

    res.status(status === "ok" ? 200 : 503).json({
        status,
        services,
        appCheck: "available"
    });
});

const protectedApi = express.Router();
protectedApi.use(requireAppCheck);
protectedApi.use(requireFirebaseAuth);
protectedApi.use(authenticatedRateLimit);

protectedApi.get("/protected", (_req: Request, res: Response) => {
    res.json({
        status: "ok",
        appCheck: {
            appId: res.locals.appCheck.appId
        },
        user: {
            uid: res.locals.user.uid,
            email: res.locals.user.email ?? null
        }
    });
});
app.use("/firebase", protectedApi);

// Authenticated API routes for tenants, users, members, phone numbers, events, and invites
const authenticatedMiddleware = [requireAppCheck, requireFirebaseAuth, authenticatedRateLimit];

// API prefix routes
const apiRouter = express.Router();
apiRouter.use(authenticatedMiddleware);
apiRouter.use("/users", usersRouter);
apiRouter.use("/tenants/:tenantId/members", membersRouter);
apiRouter.use("/tenants/:tenantId/phone-numbers", phoneNumbersRouter);
apiRouter.use("/tenants/:tenantId/events", eventsRouter);
apiRouter.use("/tenants/:tenantId/invites", invitesRouter);
apiRouter.use("/tenants/:tenantId", communicationHistoryRouter);
apiRouter.use("/tenants", tenantsRouter);
apiRouter.use("/invites", joinRouter);
apiRouter.use("/twilio", twilioNumbersRouter);
app.use("/api", apiRouter);

// Root direct mounts for convenience
app.use("/users", authenticatedMiddleware, usersRouter);
app.use("/tenants/:tenantId/members", authenticatedMiddleware, membersRouter);
app.use("/tenants/:tenantId/phone-numbers", authenticatedMiddleware, phoneNumbersRouter);
app.use("/tenants/:tenantId/events", authenticatedMiddleware, eventsRouter);
app.use("/tenants/:tenantId/invites", authenticatedMiddleware, invitesRouter);
app.use("/tenants/:tenantId", authenticatedMiddleware, communicationHistoryRouter);
app.use("/tenants", authenticatedMiddleware, tenantsRouter);
app.use("/invites", authenticatedMiddleware, joinRouter);
app.use("/twilio", authenticatedMiddleware, twilioNumbersRouter);

const adminApi = express.Router();
adminApi.use(requireAppCheck);
adminApi.use(requireFirebaseAuth);
adminApi.use(requireAdmin);
adminApi.use(authenticatedRateLimit);

adminApi.get("/status", async (_req: Request, res: Response) => {
    const [firebase, twilioServices] = await Promise.all([checkFirebaseServices(), checkTwilioServices()]);
    const services = { firebase, twilio: twilioServices };
    const status = Object.values(services).every((group) => Object.values(group).every((service) => service === "ok"))
        ? "ok"
        : "degraded";

    res.status(status === "ok" ? 200 : 503).json({ status, services });
});

adminApi.post("/twilio/sms", writeRateLimit, async (req: Request, res: Response) => {
    try {
        const to = validateTwilioPhoneNumber(req.body?.to, "to");
        const from = validateTwilioPhoneNumber(req.body?.from, "from");
        const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";

        if (!body || body.length > 1600) {
            res.status(400).json({ error: "body is required and must be 1600 characters or fewer." });
            return;
        }

        const message = await getTwilioClient().messages.create({ to, from, body });
        res.status(201).json({ sid: message.sid, status: message.status });
    } catch (error) {
        console.error("Twilio SMS test failed", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to send SMS." });
    }
});

adminApi.post("/twilio/call", writeRateLimit, async (req: Request, res: Response) => {
    try {
        const to = validateTwilioPhoneNumber(req.body?.to, "to");
        const from = validateTwilioPhoneNumber(req.body?.from, "from");
        const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

        if (!message || message.length > 1000) {
            res.status(400).json({ error: "message is required and must be 1000 characters or fewer." });
            return;
        }

        const response = new twilio.twiml.VoiceResponse();
        response.say(message);
        const call = await getTwilioClient().calls.create({ to, from, twiml: response.toString() });
        res.status(201).json({ sid: call.sid, status: call.status });
    } catch (error) {
        console.error("Twilio call test failed", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to place call." });
    }
});

adminApi.get("/twilio/events/latest", async (req: Request, res: Response) => {
    const type = req.query.type;
    if (type !== "sms" && type !== "call") {
        res.status(400).json({ error: "type must be sms or call." });
        return;
    }

    try {
        const snapshot = await db
            .collection("twilio_events")
            .where("type", "==", type)
            .orderBy("receivedAt", "desc")
            .limit(1)
            .get();
        const event = snapshot.docs[0];
        res.json({ event: event ? { id: event.id, ...event.data() } : null });
    } catch (error) {
        console.error("Unable to load latest inbound Twilio event", error);
        res.status(500).json({ error: "Unable to load the latest inbound event." });
    }
});

adminApi.get("/tenants/:tenantId/users", async (req: Request, res: Response) => {
    try {
        const snapshot = await db.collection("tenants").doc(getTenantId(req)).collection("members").get();
        res.json({ users: snapshot.docs.map((document) => ({ uid: document.id, ...document.data() })) });
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to list tenant users." });
    }
});

adminApi.post("/tenants/:tenantId/users", writeRateLimit, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantId(req);
        const email = getOptionalString(req.body?.email, "email");
        const password = getOptionalString(req.body?.password, "password");
        const phoneNumber = getOptionalString(req.body?.phoneNumber, "phoneNumber");
        const displayName = getOptionalString(req.body?.displayName, "displayName");
        const role = getRole(req.body?.role ?? "member");

        if (!email && !phoneNumber) throw new Error("email or phoneNumber is required.");
        if (password && password.length < 6) throw new Error("password must be at least 6 characters.");

        const user = await auth.createUser({ email, password, phoneNumber, displayName });
        await db
            .collection("tenants")
            .doc(tenantId)
            .collection("members")
            .doc(user.uid)
            .set({
                uid: user.uid,
                email: user.email ?? null,
                displayName: user.displayName ?? null,
                phoneNumber: user.phoneNumber ?? null,
                role,
                active: req.body?.active !== false,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        res.status(201).json({
            uid: user.uid,
            email: user.email ?? null,
            displayName: user.displayName ?? null,
            phoneNumber: user.phoneNumber ?? null,
            role,
            active: req.body?.active !== false
        });
    } catch (error) {
        console.error("Tenant user creation failed", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to create tenant user." });
    }
});

adminApi.get("/tenants/:tenantId/users/:uid", async (req: Request, res: Response) => {
    try {
        const document = await getMemberReference(req).get();
        if (!document.exists) {
            res.status(404).json({ error: "Tenant user not found." });
            return;
        }
        res.json({ uid: document.id, ...document.data() });
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to read tenant user." });
    }
});

adminApi.patch("/tenants/:tenantId/users/:uid", writeRateLimit, async (req: Request, res: Response) => {
    try {
        const member = getMemberReference(req);
        const existing = await member.get();
        if (!existing.exists) {
            res.status(404).json({ error: "Tenant user not found." });
            return;
        }

        const user = await auth.updateUser(getUid(req), {
            email: getOptionalString(req.body?.email, "email"),
            phoneNumber: getOptionalString(req.body?.phoneNumber, "phoneNumber"),
            displayName: getOptionalString(req.body?.displayName, "displayName"),
            password: getOptionalString(req.body?.password, "password"),
            disabled: req.body?.active === undefined ? undefined : req.body.active !== true
        });
        const updates: Record<string, unknown> = {
            email: user.email ?? null,
            displayName: user.displayName ?? null,
            phoneNumber: user.phoneNumber ?? null,
            updatedAt: new Date()
        };
        if (req.body?.role !== undefined) updates.role = getRole(req.body.role);
        if (req.body?.active !== undefined) updates.active = req.body.active === true;
        await member.update(updates);
        res.json({ uid: user.uid, ...updates });
    } catch (error) {
        console.error("Tenant user update failed", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to update tenant user." });
    }
});

adminApi.patch("/tenants/:tenantId/users/:uid/role", writeRateLimit, async (req: Request, res: Response) => {
    try {
        const member = getMemberReference(req);
        if (!(await member.get()).exists) {
            res.status(404).json({ error: "Tenant user not found." });
            return;
        }
        const role = getRole(req.body?.role);
        await member.update({ role, updatedAt: new Date() });
        res.json({ uid: getUid(req), role });
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to change tenant user role." });
    }
});

adminApi.delete("/tenants/:tenantId/users/:uid", writeRateLimit, async (req: Request, res: Response) => {
    try {
        const member = getMemberReference(req);
        if (!(await member.get()).exists) {
            res.status(404).json({ error: "Tenant user not found." });
            return;
        }
        await Promise.all([auth.deleteUser(getUid(req)), member.delete()]);
        res.status(204).send();
    } catch (error) {
        console.error("Tenant user deletion failed", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to delete tenant user." });
    }
});

app.use("/admin", adminApi);

// 404 handler
app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
});

// Error handling middleware
app.use((error: Error, _req: Request, res: Response) => {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
});

// Start the server
app.listen(port, "0.0.0.0", () => {
    console.log(`PartyLine API listening on port ${port}`);
});
