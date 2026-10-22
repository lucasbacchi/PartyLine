import "dotenv/config";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { auth, checkFirebaseServices, db, type TenantRole } from "./firebase.js";
import twilio from "twilio";
import { requireAdmin, requireAppCheck, requireFirebaseAuth } from "./middleware/firebase.js";
import { authenticatedRateLimit, publicRateLimit, writeRateLimit } from "./middleware/rateLimit.js";
import {
    checkTwilioServices,
    getTwilioClient,
    getTwilioWebhookAuthToken,
    validateTwilioPhoneNumber
} from "./twilio.js";

const app = express();
const port = Number(process.env.PORT ?? 8080);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "https://partyline.lucasbacchi.com,http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.disable("x-powered-by");
app.use(cors({ origin: allowedOrigins }));
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

    if (!baseUrl) {
        throw new Error("PUBLIC_BASE_URL is required for Twilio webhook validation");
    }

    const parsedBaseUrl = new URL(baseUrl);

    if (parsedBaseUrl.protocol !== "http:" && parsedBaseUrl.protocol !== "https:") {
        throw new Error("PUBLIC_BASE_URL must use http or https");
    }

    return new URL(req.originalUrl, `${parsedBaseUrl.toString().replace(/\/+$/, "")}/`).toString();
}

function requireValidTwilioRequest(req: Request, res: Response): boolean {
    const signature = req.header("X-Twilio-Signature");

    if (!signature) {
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
            res.status(401).type("text/plain").send("Invalid Twilio signature");
            return false;
        }

        return true;
    } catch (error) {
        console.error("Twilio webhook validation failed", error);
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

    const response = new twilio.twiml.VoiceResponse();
    response.say("Thank you for calling PartyLine. Your call has been received.");

    try {
        await db.collection("twilio_events").add({
            type: "call",
            sid: req.body.CallSid ?? null,
            from: req.body.From ?? null,
            to: req.body.To ?? null,
            status: req.body.CallStatus ?? null,
            direction: req.body.Direction ?? null,
            receivedAt: new Date()
        });
    } catch (error) {
        console.error("Unable to record inbound Twilio call", error);
    }

    res.type("text/xml").send(response.toString());
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
