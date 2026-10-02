import { initializeApp } from "firebase/app";

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

export default app;
