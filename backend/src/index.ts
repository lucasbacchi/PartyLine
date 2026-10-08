import "dotenv/config";
import cors from "cors";
import express, { type Request, type Response } from "express";
import twilio from "twilio";
import { checkFirebaseServices } from "./firebase.js";
import { requireAppCheck, requireFirebaseAuth } from "./middleware/firebase.js";
import { authenticatedRateLimit, publicRateLimit } from "./middleware/rateLimit.js";
import { checkTwilioServices, getTwilioWebhookAuthToken } from "./twilio.js";

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

function getWebhookUrl(req: Request): string {
    const baseUrl = process.env.PUBLIC_BASE_URL?.trim() ?? `${req.protocol}://${req.get("host")}`;
    return new URL(req.originalUrl, `${baseUrl.replace(/\/+$/, "")}/`).toString();
}

function requireValidTwilioRequest(req: Request, res: Response): boolean {
    const signature = req.header("X-Twilio-Signature");

    if (!signature) {
        res.status(401).type("text/plain").send("Missing Twilio signature");
        return false;
    }

    try {
        const isValid = twilio.validateRequest(
            getTwilioWebhookAuthToken(),
            signature,
            getWebhookUrl(req),
            req.body as Record<string, string>
        );

        if (!isValid) {
            res.status(401).type("text/plain").send("Invalid Twilio signature");
            return false;
        }

        return true;
    } catch (error) {
        console.error("Twilio webhook validation failed", error);
        res.status(503).type("text/plain").send("Twilio webhook validation is unavailable");
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

app.post("/twilio/webhooks/voice", (req: Request, res: Response) => {
    if (!requireValidTwilioRequest(req, res)) {
        return;
    }

    const response = new twilio.twiml.VoiceResponse();
    response.say("Thank you for calling PartyLine. Your call has been received.");

    res.type("text/xml").send(response.toString());
});

app.post("/twilio/webhooks/sms", (req: Request, res: Response) => {
    if (!requireValidTwilioRequest(req, res)) {
        return;
    }

    const response = new twilio.twiml.MessagingResponse();
    response.message("Your message has been received by PartyLine.");

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
