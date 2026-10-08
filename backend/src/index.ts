import cors from "cors";
import express, { type Request, type Response } from "express";
import { checkFirebaseServices, appCheck } from "./firebase.js";

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

app.get("/firebase/health", async (_req: Request, res: Response) => {
    const services = await checkFirebaseServices();
    const status = Object.values(services).every((service) => service === "ok") ? "ok" : "degraded";

    res.status(status === "ok" ? 200 : 503).json({
        status,
        services,
        appCheck: "available",
    });
});

app.get("/firebase/protected", async (req: Request, res: Response) => {
    const token = req.header("X-Firebase-AppCheck");

    if (!token) {
        res.status(401).json({ error: "Missing Firebase App Check token" });
        return;
    }

    try {
        const appCheckToken = await appCheck.verifyToken(token);
        res.json({
            status: "ok",
            appCheck: {
                appId: appCheckToken.appId,
            },
        });
    } catch (error) {
        console.warn("Firebase App Check verification failed", error);
        res.status(401).json({ error: "Invalid Firebase App Check token" });
    }
});

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
