import { initializeApp } from "firebase/app";
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
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
export default app;
