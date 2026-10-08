import "dotenv/config";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { checkFirebaseServices } from "./firebase.js";
import { requireAppCheck, requireFirebaseAuth } from "./middleware/firebase.js";
import { authenticatedRateLimit, publicRateLimit } from "./middleware/rateLimit.js";

const app = express();
const port = Number(process.env.PORT ?? 8080);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "https://partyline.lucasbacchi.com,http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.disable("x-powered-by");
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Root endpoint
app.get("/", (_req: Request, res: Response) => {
    res.json({ name: "PartyLine API", status: "ok" });
});

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
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
