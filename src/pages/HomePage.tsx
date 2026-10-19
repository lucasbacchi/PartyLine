// add light/dark mode (complete)
// add sign in w/phone number button (complete w/recaptcha)
// stylize buttons (add google icon to sign in w/google button, add spinner to buttons when loading, add hover effects, etc.) (later feature)
// inspo: PeerSchedule and Firebase landing pages

import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithPhoneNumber, RecaptchaVerifier, signOut, type User } from "firebase/auth";
import { useEffect, useRef, useState } from "react";

import type { Route } from "./+types/HomePage";
import { auth, getFirebaseAppCheckToken } from "../firebase";

export function meta({}: Route.MetaArgs) {
    return [{ title: "PartyLine" }, { name: "description", content: "Sign in to PartyLine with Google." }];
}
export function metaPhone({}: Route.MetaArgs) {
    return [{ title: "PartyLine" }, { name: "description", content: "Sign in to PartyLine with Phone Number." }];
}
//

type Theme = "light" | "dark";

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window !== "undefined") {
            const savedTheme = localStorage.getItem("theme") as Theme | null;
            if (savedTheme) return savedTheme;

            const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            return prefersDark ? "dark" : "light";
        }
        return "light";
    });

    useEffect(() => {
        const root = document.documentElement;
        if (theme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
        localStorage.setItem("theme", theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === "light" ? "dark" : "light"));
    };

    return { theme, toggleTheme };
}

//

//

export const ThemeToggle: React.FC = () => {
    const { theme, toggleTheme } = useTheme();
};
//

export default function HomePage() {
    const [user, setUser] = useState<User | null>(null);
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [isTestingBackend, setIsTestingBackend] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [backendStatus, setBackendStatus] = useState<string | null>(null);
    const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);

    useEffect(() => onAuthStateChanged(auth, setUser), []);
    useEffect(() => () => recaptchaVerifier.current?.clear(), []);

    async function handleGoogleSignIn() {
        setIsSigningIn(true);
        setErrorMessage(null);

        try {
            await signInWithPopup(auth, new GoogleAuthProvider());
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Unable to sign in with Google.");
        } finally {
            setIsSigningIn(false);
        }
    }
    async function handlePhoneSignIn() {
        setIsSigningIn(true);
        setErrorMessage(null);
        function getPhoneNumber() {
            const phoneNumber = prompt("Enter your phone number (with country code (e.g., +1)):");
            if (!phoneNumber) {
                throw new Error("Phone number is required.");
            }
            return phoneNumber;
        }
        try {
            recaptchaVerifier.current ??= new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
            const confirmation = await signInWithPhoneNumber(auth, getPhoneNumber(), recaptchaVerifier.current);
            const verificationCode = prompt("Enter the verification code sent to your phone:");
            if (!verificationCode) {
                throw new Error("Verification code is required.");
            }
            await confirmation.confirm(verificationCode);
            
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Unable to sign in with Phone Number.");
        } finally {
            setIsSigningIn(false);
        }
    }

    async function handleSignOut() {
        setErrorMessage(null);

        try {
            await signOut(auth);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Unable to sign out.");
        }
    }

    async function handleBackendTest() {
        setIsTestingBackend(true);
        setErrorMessage(null);
        setBackendStatus(null);

        try {
            if (!user) {
                throw new Error("You must be signed in to test the backend.");
            }

            const [appCheckToken, idToken] = await Promise.all([getFirebaseAppCheckToken(), user.getIdToken()]);
            const response = await fetch(
                `${import.meta.env.VITE_API_URL ?? "http://localhost:8080"}/firebase/protected`,
                {
                    headers: {
                        Authorization: `Bearer ${idToken}`,
                        "X-Firebase-AppCheck": appCheckToken
                    }
                }
            );
            const body = (await response.json()) as {
                error?: string;
                status?: string;
                user?: { email?: string | null };
            };

            if (!response.ok) {
                throw new Error(body.error ?? "The backend rejected the App Check token.");
            }

            setBackendStatus(
                `Backend accepted App Check and Firebase Auth for ${body.user?.email ?? "the signed-in user"}.`
            );
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Unable to test the backend connection.");
        } finally {
            setIsTestingBackend(false);
        }
    }

    return (
    
        <main className="flex min-h-screen items-center justify-center p-6">
            <div className="absolute top-4 center-4">
                <h1 className="text-2xl font-semibold">PartyLine</h1>
            </div>
            <section className="flex flex-col items-center">
                <div>
                    <h1 className="text-2xl font-semibold text-center justify-center ">Welcome to PartyLine!</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400 text-center justify-center inset">
                        PartyLine is a flexible phone system management tool that allows for seamless sharing of a number between multiple parties.
                    </p>
                </div>

                {user ? (
                    <div className="space-y-4">
                        <p>
                            Signed in as <strong>{user.displayName ?? user.email}</strong>
                        </p>
                        <button
                            type="button"
                            onClick={handleSignOut}
                            className="rounded-md bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
                        >
                            Sign out
                        </button>
                        <button
                            type="button"
                            onClick={handleBackendTest}
                            disabled={isTestingBackend}
                            className="rounded-md border border-blue-600 px-4 py-2 font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-blue-300 dark:hover:bg-blue-950"
                        >
                            {isTestingBackend ? "Testing backend..." : "Test Firebase backend"}
                        </button>
                    </div>
                ) : (
                    
    
                    
                    <div className="mt-8 w-full max-w-md space-y-6 rounded-xl border border-gray-200 p-8 shadow-sm dark:border-gray-800">
                       <p className="mt-2 text-gray-600 dark:text-gray-400">
                        [TEST] Let's Party! Sign in with Google or Phone Number to access PartyLine's features.
                       </p> 
                    <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={isSigningIn}
                            className="w-full rounded-md bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60 transition-transform duration-200 ease-in-out hover:scale-105"
                        >
                            {isSigningIn ? "Signing in..." : "Sign in with Google"}
                        </button>
                        <button
                            type="button"
                            onClick={handlePhoneSignIn}
                            disabled={isSigningIn}
                            className="w-full rounded-md bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60 transition-transform duration-200 ease-in-out hover:scale-105"

                        >
                            {isSigningIn ? "Signing in..." : "Sign in with Phone Number"}
                        </button>
                        <div id="recaptcha-container" />
                    </div>
                )}

                {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
                {backendStatus && <p className="text-sm text-green-600">{backendStatus}</p>}
            </section>
        </main>
    );
}
