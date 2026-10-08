import { initializeApp } from "firebase/app";
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyDumaA28ACpB3cb9l7fRxGcTzU3eoZHVrM",
    authDomain: "partyline-phone-system.firebaseapp.com",
    projectId: "partyline-phone-system",
    storageBucket: "partyline-phone-system.firebasestorage.app",
    messagingSenderId: "488790666782",
    appId: "1:488790666782:web:12d5abad9b408dd33e480f",
    measurementId: "G-TQ922JM0P4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
const appCheck =
    typeof window !== "undefined" && appCheckSiteKey
        ? initializeAppCheck(app, {
              provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
              isTokenAutoRefreshEnabled: true
          })
        : undefined;
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

function getFirebaseAppCheck(): AppCheck {
    if (typeof window === "undefined") {
        throw new Error("Firebase App Check is only available in a browser.");
    }

    if (!appCheck) {
        throw new Error("VITE_FIREBASE_APPCHECK_SITE_KEY is not configured.");
    }

    return appCheck;
}

export async function getFirebaseAppCheckToken(): Promise<string> {
    const { token } = await getToken(getFirebaseAppCheck());
    return token;
}

export { auth, db, storage };
export default app;
