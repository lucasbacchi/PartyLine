import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as fbSignOut, updateProfile, type User } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export type UserProfile = {
    displayName: string;
    email: string;
    phoneNumber: string;
    doNotDisturb: boolean;
    notifySmsOnMissedCalls: boolean;
    enableWebCalls: boolean;
    webStatus: "active" | "idle" | "offline";
};

type UserContextType = {
    user: User | null;
    userProfile: UserProfile;
    isAuthLoading: boolean;
    updateUserProfile: (profile: Partial<UserProfile>) => Promise<void>;
    toggleWebCalls: () => Promise<void>;
    signOut: () => Promise<void>;
};

const EMPTY_PROFILE: UserProfile = {
    displayName: "",
    email: "",
    phoneNumber: "",
    doNotDisturb: false,
    notifySmsOnMissedCalls: true,
    enableWebCalls: true,
    webStatus: "offline"
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile>(EMPTY_PROFILE);
    const [isAuthLoading, setIsAuthLoading] = useState(true);

    useEffect(() => {
        let unsubscribeDoc: (() => void) | undefined;

        const unsubscribeAuth = onAuthStateChanged(auth, async (nextUser) => {
            setUser(nextUser);
            setIsAuthLoading(false);

            if (unsubscribeDoc) {
                unsubscribeDoc();
                unsubscribeDoc = undefined;
            }

            if (nextUser) {
                // Initialize profile from Auth
                const initial: UserProfile = {
                    displayName: nextUser.displayName || "",
                    email: nextUser.email || "",
                    phoneNumber: nextUser.phoneNumber || "",
                    doNotDisturb: false,
                    notifySmsOnMissedCalls: true,
                    enableWebCalls: true,
                    webStatus: "active"
                };
                setUserProfile(initial);

                // Listen to live user document in Firestore
                const userDocRef = doc(db, "users", nextUser.uid);
                unsubscribeDoc = onSnapshot(
                    userDocRef,
                    (snapshot) => {
                        if (snapshot.exists()) {
                            const data = snapshot.data();
                            setUserProfile({
                                displayName: data.displayName || nextUser.displayName || "",
                                email: data.email || nextUser.email || "",
                                phoneNumber: data.phoneNumber || nextUser.phoneNumber || "",
                                doNotDisturb: data.doNotDisturb === true,
                                notifySmsOnMissedCalls: data.notifySmsOnMissedCalls !== false,
                                enableWebCalls: data.enableWebCalls !== false,
                                webStatus: (data.webStatus as "active" | "idle" | "offline") || "active"
                            });
                        } else {
                            // Ensure the user document is created in Firestore
                            setDoc(
                                userDocRef,
                                {
                                    uid: nextUser.uid,
                                    displayName: nextUser.displayName || "",
                                    email: nextUser.email || "",
                                    phoneNumber: nextUser.phoneNumber || "",
                                    doNotDisturb: false,
                                    notifySmsOnMissedCalls: true,
                                    enableWebCalls: true,
                                    webStatus: "active",
                                    webLastActiveAt: new Date(),
                                    createdAt: new Date()
                                },
                                { merge: true }
                            ).catch((err) => console.warn("Failed to create initial user doc in Firestore:", err));
                        }
                    },
                    (error) => {
                        console.warn("User Firestore listener warning:", error);
                    }
                );
            } else {
                setUserProfile(EMPTY_PROFILE);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeDoc) unsubscribeDoc();
        };
    }, []);

    // Presence & Idle Activity Tracker
    useEffect(() => {
        if (!user || typeof window === "undefined") return;

        let lastActiveTime = Date.now();
        let currentStatus: "active" | "idle" | "offline" = "active";
        const uid = user.uid;

        const updateFirestoreStatus = (status: "active" | "idle" | "offline") => {
            currentStatus = status;
            const userDocRef = doc(db, "users", uid);
            setDoc(
                userDocRef,
                {
                    webStatus: status,
                    webLastActiveAt: new Date()
                },
                { merge: true }
            ).catch(() => {});
        };

        // Report active presence immediately on mount
        updateFirestoreStatus("active");

        const handleUserActivity = () => {
            lastActiveTime = Date.now();
            if (currentStatus !== "active") {
                updateFirestoreStatus("active");
            }
        };

        const activityEvents = ["mousemove", "keydown", "click", "touchstart", "scroll"] as const;
        activityEvents.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                // If tab is placed in background, mark idle
                updateFirestoreStatus("idle");
            } else {
                lastActiveTime = Date.now();
                updateFirestoreStatus("active");
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        const handleBeforeUnload = () => {
            updateFirestoreStatus("offline");
        };
        window.addEventListener("beforeunload", handleBeforeUnload);

        // Heartbeat timer every 45 seconds to refresh presence & catch idle state (> 3 minutes)
        const heartbeatInterval = setInterval(() => {
            const idleThreshold = 3 * 60 * 1000; // 3 minutes
            const isInactive = Date.now() - lastActiveTime > idleThreshold;
            const isHidden = document.visibilityState === "hidden";

            if (isInactive || isHidden) {
                if (currentStatus !== "idle") {
                    updateFirestoreStatus("idle");
                }
            } else {
                updateFirestoreStatus("active");
            }
        }, 45000);

        return () => {
            clearInterval(heartbeatInterval);
            activityEvents.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("beforeunload", handleBeforeUnload);
            updateFirestoreStatus("offline");
        };
    }, [user?.uid]);

    const updateUserProfile = async (profile: Partial<UserProfile>) => {
        if (!user) throw new Error("Must be signed in to update profile.");

        // 1. Update Firebase Auth if displayName is changing
        if (profile.displayName !== undefined && profile.displayName !== user.displayName) {
            await updateProfile(user, { displayName: profile.displayName });
        }

        // 2. Update Firestore document
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(
            userDocRef,
            {
                ...profile,
                updatedAt: new Date()
            },
            { merge: true }
        );

        setUserProfile((prev) => ({ ...prev, ...profile }));
    };

    const toggleWebCalls = async () => {
        const nextVal = !userProfile.enableWebCalls;
        await updateUserProfile({
            enableWebCalls: nextVal,
            webStatus: nextVal ? "active" : "offline"
        });
    };

    const signOut = async () => {
        await fbSignOut(auth);
        setUser(null);
        setUserProfile(EMPTY_PROFILE);
    };

    return (
        <UserContext.Provider
            value={{
                user,
                userProfile,
                isAuthLoading,
                updateUserProfile,
                toggleWebCalls,
                signOut
            }}
        >
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
}
