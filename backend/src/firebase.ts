import { getApps, initializeApp } from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const firebaseStorageBucket = process.env.FIREBASE_STORAGE_BUCKET ?? "partyline-phone-system.firebasestorage.app";
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID ?? "partyline-phone-system";
const firebaseApp =
    getApps()[0] ??
    initializeApp({
        projectId: firebaseProjectId,
        storageBucket: firebaseStorageBucket
    });

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const appCheck = getAppCheck(firebaseApp);

export type TenantRole = "owner" | "admin" | "member" | "viewer";

export async function checkFirebaseServices(): Promise<Record<string, "ok" | "error">> {
    const checks = await Promise.allSettled([
        auth.listUsers(1),
        db.collection("_health").limit(1).get(),
        storage.bucket(firebaseStorageBucket).getMetadata()
    ]);

    return {
        auth: checks[0].status === "fulfilled" ? "ok" : "error",
        db: checks[1].status === "fulfilled" ? "ok" : "error",
        storage: checks[2].status === "fulfilled" ? "ok" : "error"
    };
}

export async function uploadRecordingToFirebaseStorage(
    tenantId: string,
    recordingSid: string,
    mp3Url: string,
    authHeader?: string
): Promise<string> {
    try {
        const fetchOptions: RequestInit = {};
        if (authHeader) {
            fetchOptions.headers = { Authorization: authHeader };
        }
        const res = await fetch(mp3Url, fetchOptions);
        if (!res.ok) {
            console.warn(`Could not fetch audio from ${mp3Url}: ${res.statusText}`);
            return mp3Url;
        }

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const bucket = storage.bucket(firebaseStorageBucket);
        const destination = `tenants/${tenantId}/recordings/${recordingSid}.mp3`;
        const file = bucket.file(destination);

        await file.save(buffer, {
            contentType: "audio/mpeg",
            metadata: {
                tenantId,
                recordingSid
            }
        });

        try {
            await file.makePublic();
            return `https://storage.googleapis.com/${bucket.name}/${destination}`;
        } catch {
            const [signedUrl] = await file.getSignedUrl({
                action: "read",
                expires: Date.now() + 1000 * 60 * 60 * 24 * 365
            });
            return signedUrl;
        }
    } catch (err) {
        console.warn("Firebase Storage recording upload notice:", err);
        return mp3Url;
    }
}
