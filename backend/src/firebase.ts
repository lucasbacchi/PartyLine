import { getApps, initializeApp } from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const firebaseStorageBucket = process.env.FIREBASE_STORAGE_BUCKET ?? "partyline-phone-system.firebasestorage.app";
const firebaseApp = getApps()[0] ?? initializeApp({ storageBucket: firebaseStorageBucket });

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const appCheck = getAppCheck(firebaseApp);

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
