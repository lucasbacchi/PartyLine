import { Router, type Request, type Response } from "express";
import { db } from "../firebase.js";
import { getTenantIdParam, getParam, requireTenantAdmin, requireTenantMember } from "../middleware/tenantAuth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";

const router = Router({ mergeParams: true });

function parseDate(value: unknown, fieldName: string): Date {
    if (!value) {
        throw new Error(`${fieldName} is required.`);
    }
    const d = new Date(value as string | number);
    if (isNaN(d.getTime())) {
        throw new Error(`${fieldName} must be a valid date.`);
    }
    return d;
}

// GET /tenants/:tenantId/events - List events
router.get("/", requireTenantMember, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const { status, filter } = req.query;

        const snapshot = await db
            .collection("tenants")
            .doc(tenantId)
            .collection("events")
            .orderBy("start", "asc")
            .get();

        const now = new Date();
        const events = snapshot.docs
            .map((doc) => {
                const data = doc.data();
                const startDate = data.start?.toDate ? data.start.toDate() : new Date(data.start);
                const endDate = data.end?.toDate ? data.end.toDate() : new Date(data.end);

                let eventStatus: "active" | "upcoming" | "past" = "past";
                if (now >= startDate && now <= endDate) {
                    eventStatus = "active";
                } else if (now < startDate) {
                    eventStatus = "upcoming";
                }

                return {
                    id: doc.id,
                    ...data,
                    start: startDate.toISOString(),
                    end: endDate.toISOString(),
                    status: eventStatus
                };
            })
            .filter((e) => {
                const targetFilter = (status as string) || (filter as string);
                if (!targetFilter || targetFilter === "all") return true;
                if (targetFilter === "past") return e.status === "past";
                if (targetFilter === "upcoming") return e.status !== "past";
                if (targetFilter === "active") return e.status === "active";
                return true;
            });

        res.json({ events });
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to list events." });
    }
});

// GET /tenants/:tenantId/events/current - Get active event & on-duty hosts right now
router.get("/current", requireTenantMember, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const now = new Date();

        const snapshot = await db
            .collection("tenants")
            .doc(tenantId)
            .collection("events")
            .where("start", "<=", now)
            .get();

        const activeEventDoc = snapshot.docs.find((doc) => {
            const data = doc.data();
            const endDate = data.end?.toDate ? data.end.toDate() : new Date(data.end);
            return endDate >= now;
        });

        if (!activeEventDoc) {
            res.json({ event: null, message: "No active event on duty right now." });
            return;
        }

        const data = activeEventDoc.data();
        res.json({
            event: {
                id: activeEventDoc.id,
                ...data,
                start: data.start?.toDate ? data.start.toDate().toISOString() : data.start,
                end: data.end?.toDate ? data.end.toDate().toISOString() : data.end,
                status: "active"
            }
        });
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to determine current event." });
    }
});

// POST /tenants/:tenantId/events - Create an event
router.post("/", requireTenantAdmin, writeRateLimit, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const {
            title,
            renterName,
            renterPhone,
            start,
            end,
            primaryUid,
            primaryName,
            primaryPhone,
            backupUid,
            backupName,
            backupPhone,
            notes
        } = req.body ?? {};

        if (!title || typeof title !== "string" || !title.trim()) {
            res.status(400).json({ error: "Event title is required." });
            return;
        }

        const startDate = parseDate(start, "start");
        const endDate = parseDate(end, "end");

        if (endDate <= startDate) {
            res.status(400).json({ error: "Event end time must be after start time." });
            return;
        }

        if (!primaryName || typeof primaryName !== "string" || !primaryName.trim()) {
            res.status(400).json({ error: "Primary host name is required." });
            return;
        }

        if (!primaryPhone || typeof primaryPhone !== "string" || !primaryPhone.trim()) {
            res.status(400).json({ error: "Primary host phone is required." });
            return;
        }

        const now = new Date();
        const eventData = {
            title: title.trim().slice(0, 150),
            renterName: typeof renterName === "string" ? renterName.trim().slice(0, 100) : "",
            renterPhone: typeof renterPhone === "string" ? renterPhone.trim() : "",
            start: startDate,
            end: endDate,
            primaryUid: primaryUid ?? null,
            primaryName: primaryName.trim().slice(0, 100),
            primaryPhone: primaryPhone.trim(),
            backupUid: backupUid ?? null,
            backupName: typeof backupName === "string" ? backupName.trim().slice(0, 100) : "",
            backupPhone: typeof backupPhone === "string" ? backupPhone.trim() : "",
            notes: typeof notes === "string" ? notes.trim().slice(0, 1000) : "",
            createdAt: now,
            updatedAt: now
        };

        const docRef = await db.collection("tenants").doc(tenantId).collection("events").add(eventData);

        res.status(201).json({
            event: {
                id: docRef.id,
                ...eventData,
                start: startDate.toISOString(),
                end: endDate.toISOString()
            }
        });
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to create event." });
    }
});

// GET /tenants/:tenantId/events/:eventId - Get event
router.get("/:eventId", requireTenantMember, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const eventId = getParam(req, "eventId");

        const eventDoc = await db.collection("tenants").doc(tenantId).collection("events").doc(eventId).get();
        if (!eventDoc.exists) {
            res.status(404).json({ error: "Event not found." });
            return;
        }

        const data = eventDoc.data()!;
        res.json({
            event: {
                id: eventDoc.id,
                ...data,
                start: data.start?.toDate ? data.start.toDate().toISOString() : data.start,
                end: data.end?.toDate ? data.end.toDate().toISOString() : data.end
            }
        });
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to read event." });
    }
});

// PATCH /tenants/:tenantId/events/:eventId - Update event
router.patch("/:eventId", requireTenantAdmin, writeRateLimit, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const eventId = getParam(req, "eventId");
        const updates: Record<string, unknown> = { updatedAt: new Date() };

        const {
            title,
            renterName,
            renterPhone,
            start,
            end,
            primaryUid,
            primaryName,
            primaryPhone,
            backupUid,
            backupName,
            backupPhone,
            notes
        } = req.body ?? {};

        if (title !== undefined) updates.title = String(title).trim().slice(0, 150);
        if (renterName !== undefined) updates.renterName = String(renterName).trim().slice(0, 100);
        if (renterPhone !== undefined) updates.renterPhone = String(renterPhone).trim();
        if (start !== undefined) updates.start = parseDate(start, "start");
        if (end !== undefined) updates.end = parseDate(end, "end");
        if (primaryUid !== undefined) updates.primaryUid = primaryUid;
        if (primaryName !== undefined) updates.primaryName = String(primaryName).trim().slice(0, 100);
        if (primaryPhone !== undefined) updates.primaryPhone = String(primaryPhone).trim();
        if (backupUid !== undefined) updates.backupUid = backupUid;
        if (backupName !== undefined) updates.backupName = String(backupName).trim().slice(0, 100);
        if (backupPhone !== undefined) updates.backupPhone = String(backupPhone).trim();
        if (notes !== undefined) updates.notes = String(notes).trim().slice(0, 1000);

        const eventRef = db.collection("tenants").doc(tenantId).collection("events").doc(eventId);
        const existing = await eventRef.get();
        if (!existing.exists) {
            res.status(404).json({ error: "Event not found." });
            return;
        }

        await eventRef.update(updates);

        const updated = await eventRef.get();
        const data = updated.data()!;
        res.json({
            event: {
                id: updated.id,
                ...data,
                start: data.start?.toDate ? data.start.toDate().toISOString() : data.start,
                end: data.end?.toDate ? data.end.toDate().toISOString() : data.end
            }
        });
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to update event." });
    }
});

// DELETE /tenants/:tenantId/events/:eventId - Delete event
router.delete("/:eventId", requireTenantAdmin, writeRateLimit, async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantIdParam(req);
        const eventId = getParam(req, "eventId");

        const eventRef = db.collection("tenants").doc(tenantId).collection("events").doc(eventId);
        const existing = await eventRef.get();
        if (!existing.exists) {
            res.status(404).json({ error: "Event not found." });
            return;
        }

        await eventRef.delete();
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unable to delete event." });
    }
});

export default router;
