import React, { createContext, useContext, useEffect, useState } from "react";
import {
    collection,
    doc,
    onSnapshot,
    setDoc,
    updateDoc,
    deleteDoc,
    getDoc,
    getDocs,
    query,
    where,
    writeBatch
} from "firebase/firestore";
import { db } from "../firebase";
import { useUser, type UserProfile } from "./UserContext";
import type { User } from "firebase/auth";

export type TenantRole = "owner" | "admin" | "member" | "viewer";

export type PhoneNumberItem = {
    id: string;
    number: string;
    label: string;
    isPrimary: boolean;
};

export type OrgSettings = {
    routingStrategy: "round_robin" | "sequential" | "simultaneous";
    ringTimeoutSeconds: number;
    answerMessage: string;
    fallbackAction: "voicemail" | "forward" | "hangup";
    fallbackPhone: string;
    smsAutoReplyEnabled: boolean;
    smsAutoReplyMessage: string;
    timezone: string;
};

export type OrgMember = {
    uid: string;
    displayName: string;
    email: string;
    phoneNumber?: string;
    role: TenantRole;
    active: boolean;
    joinedAt: string;
};

export type OrgInvite = {
    id: string;
    code: string;
    role: TenantRole;
    createdAt: string;
    expiresAt: string;
    tenantId: string;
    tenantName: string;
};

export type TenantInfo = {
    id: string;
    name: string;
    ownerUid: string;
    inviteCode: string;
    phoneNumbers: PhoneNumberItem[];
    settings: OrgSettings;
    userRole: TenantRole;
};

export type UserInvite = {
    id: string;
    tenantId: string;
    tenantName: string;
    role: TenantRole;
    invitedAt: string;
};

type AppContextType = {
    currentTenant: TenantInfo | null;
    tenants: Array<{ id: string; name: string; role: TenantRole }>;
    members: OrgMember[];
    invites: OrgInvite[];
    userInvites: UserInvite[];
    isLoadingTenants: boolean;
    isLoadingMembers: boolean;
    switchTenant: (tenantId: string) => void;
    createOrganization: (
        name: string,
        initialPhone?: string,
        initialSettings?: Partial<OrgSettings>,
        initialMembers?: Array<{ email: string; displayName?: string; phoneNumber?: string; role?: TenantRole }>
    ) => Promise<string>;
    updateOrgSettings: (newSettings: Partial<OrgSettings>) => Promise<void>;
    addPhoneNumber: (phone: { number: string; label: string; isPrimary?: boolean }) => Promise<void>;
    removePhoneNumber: (id: string) => Promise<void>;
    setPrimaryPhoneNumber: (id: string) => Promise<void>;
    addMember: (member: {
        displayName: string;
        email: string;
        phoneNumber?: string;
        role: TenantRole;
    }) => Promise<void>;
    updateMemberRole: (uid: string, role: TenantRole) => Promise<void>;
    toggleMemberActive: (uid: string, active: boolean) => Promise<void>;
    removeMember: (uid: string) => Promise<void>;
    createInvite: (role: TenantRole) => Promise<string>;
    revokeInvite: (inviteId: string) => Promise<void>;
    joinOrganizationByCode: (code: string) => Promise<boolean>;
    leaveOrganization: (tenantId: string) => Promise<void>;
    respondToUserInvite: (inviteId: string, accept: boolean) => Promise<void>;
    // Passthroughs from user context for convenience
    user: User | null;
    userProfile: UserProfile;
    isAuthLoading: boolean;
    updateUserProfile: (profile: Partial<UserProfile>) => Promise<void>;
};

const DEFAULT_SETTINGS: OrgSettings = {
    routingStrategy: "sequential",
    ringTimeoutSeconds: 20,
    answerMessage: "Thank you for calling PartyLine. Connecting your call to our on-duty team member...",
    fallbackAction: "voicemail",
    fallbackPhone: "",
    smsAutoReplyEnabled: true,
    smsAutoReplyMessage:
        "Thank you for reaching out to PartyLine! A host on duty has received your message and will reply shortly.",
    timezone: "America/New_York"
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const { user, userProfile, isAuthLoading, updateUserProfile } = useUser();

    const [currentTenant, setCurrentTenant] = useState<TenantInfo | null>(null);
    const [tenants, setTenants] = useState<Array<{ id: string; name: string; role: TenantRole }>>([]);
    const [members, setMembers] = useState<OrgMember[]>([]);
    const [invites, setInvites] = useState<OrgInvite[]>([]);
    const [userInvites, setUserInvites] = useState<UserInvite[]>([]);

    const [isLoadingTenants, setIsLoadingTenants] = useState(true);
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);

    // 1. Listen to real organizations user belongs to in Firestore: users/{uid}/memberships
    useEffect(() => {
        if (!user) {
            setTenants([]);
            setCurrentTenant(null);
            setMembers([]);
            setInvites([]);
            setIsLoadingTenants(false);
            return;
        }

        setIsLoadingTenants(true);
        const membershipsRef = collection(db, "users", user.uid, "memberships");

        const unsubscribe = onSnapshot(
            membershipsRef,
            (snapshot) => {
                const loadedTenants = snapshot.docs.map((docSnap) => {
                    const data = docSnap.data();
                    return {
                        id: docSnap.id,
                        name: data.tenantName || data.name || "Organization",
                        role: (data.role as TenantRole) || "member"
                    };
                });

                setTenants(loadedTenants);
                setIsLoadingTenants(false);

                // Auto-select active tenant if not set or if current one was removed
                setCurrentTenant((prev) => {
                    if (loadedTenants.length === 0) return null;
                    if (prev && loadedTenants.some((t) => t.id === prev.id)) {
                        return prev; // keep existing selected
                    }
                    // otherwise pick first
                    const first = loadedTenants[0];
                    return {
                        id: first.id,
                        name: first.name,
                        ownerUid: "",
                        inviteCode: "",
                        phoneNumbers: [],
                        settings: { ...DEFAULT_SETTINGS },
                        userRole: first.role
                    };
                });
            },
            (error) => {
                console.warn("Firestore memberships listener error:", error);
                setIsLoadingTenants(false);
            }
        );

        return () => unsubscribe();
    }, [user]);

    // 2. Listen to active tenant details from Firestore: tenants/{tenantId}
    useEffect(() => {
        if (!currentTenant?.id) {
            setMembers([]);
            setInvites([]);
            return;
        }

        const tenantDocRef = doc(db, "tenants", currentTenant.id);
        const unsubscribe = onSnapshot(
            tenantDocRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    setCurrentTenant((prev) => {
                        if (!prev) return null;
                        return {
                            ...prev,
                            name: data.name || prev.name,
                            ownerUid: data.ownerUid || "",
                            inviteCode: data.inviteCode || "",
                            phoneNumbers: Array.isArray(data.phoneNumbers) ? data.phoneNumbers : [],
                            settings: data.settings ? { ...DEFAULT_SETTINGS, ...data.settings } : prev.settings
                        };
                    });
                }
            },
            (error) => {
                console.warn("Firestore tenant doc listener error:", error);
            }
        );

        return () => unsubscribe();
    }, [currentTenant?.id]);

    // 3. Listen to live members from Firestore: tenants/{tenantId}/members
    useEffect(() => {
        if (!currentTenant?.id) {
            setMembers([]);
            return;
        }

        setIsLoadingMembers(true);
        const membersRef = collection(db, "tenants", currentTenant.id, "members");

        const unsubscribe = onSnapshot(
            membersRef,
            (snapshot) => {
                const loadedMembers: OrgMember[] = snapshot.docs.map((d) => {
                    const data = d.data();
                    const joined = data.joinedAt?.toDate
                        ? data.joinedAt.toDate().toISOString().split("T")[0]
                        : typeof data.joinedAt === "string"
                          ? data.joinedAt.split("T")[0]
                          : "Recently";

                    return {
                        uid: d.id,
                        displayName: data.displayName || "Member",
                        email: data.email || "",
                        phoneNumber: data.phoneNumber || "",
                        role: (data.role as TenantRole) || "member",
                        active: data.active !== false,
                        joinedAt: joined
                    };
                });

                setMembers(loadedMembers);
                setIsLoadingMembers(false);
            },
            (error) => {
                console.warn("Firestore members listener error:", error);
                setIsLoadingMembers(false);
            }
        );

        return () => unsubscribe();
    }, [currentTenant?.id]);

    // 4. Listen to live invites for current tenant from Firestore: tenants/{tenantId}/invites
    useEffect(() => {
        if (!currentTenant?.id) {
            setInvites([]);
            return;
        }

        const invitesRef = collection(db, "tenants", currentTenant.id, "invites");
        const unsubscribe = onSnapshot(
            invitesRef,
            (snapshot) => {
                const loadedInvites: OrgInvite[] = snapshot.docs
                    .map((d) => {
                        const data = d.data();
                        const created = data.createdAt?.toDate
                            ? data.createdAt.toDate().toISOString().split("T")[0]
                            : typeof data.createdAt === "string"
                              ? data.createdAt.split("T")[0]
                              : "";
                        const exp = data.expiresAt?.toDate
                            ? data.expiresAt.toDate().toISOString().split("T")[0]
                            : typeof data.expiresAt === "string"
                              ? data.expiresAt.split("T")[0]
                              : "";

                        return {
                            id: d.id,
                            code: data.code || "",
                            role: (data.role as TenantRole) || "member",
                            createdAt: created,
                            expiresAt: exp,
                            tenantId: currentTenant.id,
                            tenantName: data.tenantName || currentTenant.name
                        };
                    })
                    .filter((inv) => Boolean(inv.code));

                setInvites(loadedInvites);
            },
            (error) => {
                console.warn("Firestore invites listener error:", error);
            }
        );

        return () => unsubscribe();
    }, [currentTenant?.id, currentTenant?.name]);

    // 5. Switch active tenant
    const switchTenant = (tenantId: string) => {
        const found = tenants.find((t) => t.id === tenantId);
        if (!found) return;

        setCurrentTenant({
            id: found.id,
            name: found.name,
            ownerUid: "",
            inviteCode: "",
            phoneNumbers: [],
            settings: { ...DEFAULT_SETTINGS },
            userRole: found.role
        });
    };

    // 6. Create new organization in Firestore
    const createOrganization = async (
        name: string,
        initialPhone?: string,
        initialSettings?: Partial<OrgSettings>,
        initialMembers?: Array<{ email: string; displayName?: string; phoneNumber?: string; role?: TenantRole }>
    ): Promise<string> => {
        if (!user) throw new Error("Must be signed in to create an organization.");

        const cleanName = name.trim().slice(0, 100);
        const tenantId = `org-${cleanName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "-")
            .slice(0, 25)}-${Math.floor(100 + Math.random() * 900)}`;
        const masterInviteCode = `${cleanName
            .slice(0, 4)
            .toUpperCase()
            .replace(/[^A-Z]/g, "PL")}-${Math.floor(1000 + Math.random() * 9000)}`;

        const phoneNumbersList: PhoneNumberItem[] = [];
        if (initialPhone?.trim()) {
            phoneNumbersList.push({
                id: `pn-${Date.now()}`,
                number: initialPhone.trim(),
                label: "Main Organization Line",
                isPrimary: true
            });
        }

        const now = new Date();
        const batch = writeBatch(db);

        // A. Tenant document
        const tenantDocRef = doc(db, "tenants", tenantId);
        batch.set(tenantDocRef, {
            id: tenantId,
            name: cleanName,
            ownerUid: user.uid,
            inviteCode: masterInviteCode,
            phoneNumbers: phoneNumbersList,
            settings: { ...DEFAULT_SETTINGS, ...initialSettings },
            createdAt: now,
            updatedAt: now
        });

        // B. Member record for creator as Owner
        const memberDocRef = doc(db, "tenants", tenantId, "members", user.uid);
        batch.set(memberDocRef, {
            uid: user.uid,
            displayName: userProfile.displayName || user.displayName || "Admin",
            email: userProfile.email || user.email || "",
            phoneNumber: userProfile.phoneNumber || user.phoneNumber || "",
            role: "owner",
            active: true,
            joinedAt: now,
            updatedAt: now
        });

        // C. Record membership in user's profile
        const userMembershipRef = doc(db, "users", user.uid, "memberships", tenantId);
        batch.set(userMembershipRef, {
            tenantId,
            tenantName: cleanName,
            role: "owner",
            joinedAt: now
        });

        // D. Create invite index document for join code
        const inviteIndexRef = doc(db, "invites", masterInviteCode);
        batch.set(inviteIndexRef, {
            code: masterInviteCode,
            tenantId,
            tenantName: cleanName,
            role: "member",
            createdBy: user.uid,
            createdAt: now,
            status: "active"
        });

        // E. Add initial members if specified during onboarding
        if (Array.isArray(initialMembers) && initialMembers.length > 0) {
            initialMembers.forEach((m, idx) => {
                if (m.email?.trim()) {
                    const tempMemberUid = `mem-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`;
                    const memRef = doc(db, "tenants", tenantId, "members", tempMemberUid);
                    batch.set(memRef, {
                        uid: tempMemberUid,
                        displayName: m.displayName?.trim() || m.email.split("@")[0],
                        email: m.email.trim(),
                        phoneNumber: m.phoneNumber?.trim() || "",
                        role: m.role || "member",
                        active: true,
                        joinedAt: now,
                        updatedAt: now
                    });
                }
            });
        }

        await batch.commit();

        switchTenant(tenantId);
        return tenantId;
    };

    // 7. Update organization settings in Firestore
    const updateOrgSettings = async (newSettings: Partial<OrgSettings>) => {
        if (!currentTenant?.id) return;

        const tenantDocRef = doc(db, "tenants", currentTenant.id);
        await updateDoc(tenantDocRef, {
            settings: {
                ...currentTenant.settings,
                ...newSettings
            },
            updatedAt: new Date()
        });
    };

    // 8. Add phone number in Firestore
    const addPhoneNumber = async (phone: { number: string; label: string; isPrimary?: boolean }) => {
        if (!currentTenant?.id) return;

        const newItem: PhoneNumberItem = {
            id: `pn-${Date.now()}`,
            number: phone.number.trim(),
            label: phone.label.trim() || "Main Line",
            isPrimary: phone.isPrimary || currentTenant.phoneNumbers.length === 0
        };

        const list = phone.isPrimary
            ? currentTenant.phoneNumbers.map((p) => ({ ...p, isPrimary: false }))
            : [...currentTenant.phoneNumbers];

        const updatedNumbers = [...list, newItem];

        const tenantDocRef = doc(db, "tenants", currentTenant.id);
        await updateDoc(tenantDocRef, {
            phoneNumbers: updatedNumbers,
            updatedAt: new Date()
        });
    };

    // 9. Remove phone number in Firestore
    const removePhoneNumber = async (id: string) => {
        if (!currentTenant?.id) return;

        const remaining = currentTenant.phoneNumbers.filter((p) => p.id !== id);
        if (remaining.length > 0 && !remaining.some((p) => p.isPrimary)) {
            remaining[0].isPrimary = true;
        }

        const tenantDocRef = doc(db, "tenants", currentTenant.id);
        await updateDoc(tenantDocRef, {
            phoneNumbers: remaining,
            updatedAt: new Date()
        });
    };

    // 10. Set primary phone number
    const setPrimaryPhoneNumber = async (id: string) => {
        if (!currentTenant?.id) return;

        const updatedNumbers = currentTenant.phoneNumbers.map((p) => ({
            ...p,
            isPrimary: p.id === id
        }));

        const tenantDocRef = doc(db, "tenants", currentTenant.id);
        await updateDoc(tenantDocRef, {
            phoneNumbers: updatedNumbers,
            updatedAt: new Date()
        });
    };

    // 11. Add member to organization
    const addMember = async (member: {
        displayName: string;
        email: string;
        phoneNumber?: string;
        role: TenantRole;
    }) => {
        if (!currentTenant?.id) return;

        // Generate or resolve a member ID
        const memberUid = `mem-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const now = new Date();

        const memberData = {
            uid: memberUid,
            displayName: member.displayName.trim(),
            email: member.email.trim(),
            phoneNumber: member.phoneNumber?.trim() || "",
            role: member.role,
            active: true,
            joinedAt: now,
            updatedAt: now
        };

        const memberDocRef = doc(db, "tenants", currentTenant.id, "members", memberUid);
        await setDoc(memberDocRef, memberData);
    };

    // 12. Update member role
    const updateMemberRole = async (uid: string, role: TenantRole) => {
        if (!currentTenant?.id) return;

        const memberDocRef = doc(db, "tenants", currentTenant.id, "members", uid);
        await updateDoc(memberDocRef, { role, updatedAt: new Date() });

        // Also update user's personal membership reference if exists
        const userMembershipRef = doc(db, "users", uid, "memberships", currentTenant.id);
        setDoc(userMembershipRef, { role }, { merge: true }).catch(() => {});
    };

    // 13. Toggle member active status
    const toggleMemberActive = async (uid: string, active: boolean) => {
        if (!currentTenant?.id) return;

        const memberDocRef = doc(db, "tenants", currentTenant.id, "members", uid);
        await updateDoc(memberDocRef, { active, updatedAt: new Date() });
    };

    // 14. Remove member
    const removeMember = async (uid: string) => {
        if (!currentTenant?.id) return;

        const memberDocRef = doc(db, "tenants", currentTenant.id, "members", uid);
        await deleteDoc(memberDocRef);

        const userMembershipRef = doc(db, "users", uid, "memberships", currentTenant.id);
        deleteDoc(userMembershipRef).catch(() => {});
    };

    // 15. Create shareable invite
    const createInvite = async (role: TenantRole): Promise<string> => {
        if (!currentTenant?.id || !user) throw new Error("Organization required.");

        const prefix = currentTenant.name
            .slice(0, 3)
            .toUpperCase()
            .replace(/[^A-Z]/g, "PL");
        const code = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

        const now = new Date();
        const exp = new Date();
        exp.setDate(exp.getDate() + 30);

        const inviteData = {
            code,
            role,
            tenantId: currentTenant.id,
            tenantName: currentTenant.name,
            createdBy: user.uid,
            createdAt: now,
            expiresAt: exp,
            status: "active"
        };

        const batch = writeBatch(db);

        // Subcollection
        const inviteDocRef = doc(collection(db, "tenants", currentTenant.id, "invites"));
        batch.set(inviteDocRef, { id: inviteDocRef.id, ...inviteData });

        // Global index
        const globalRef = doc(db, "invites", code);
        batch.set(globalRef, { inviteId: inviteDocRef.id, ...inviteData });

        await batch.commit();
        return code;
    };

    // 16. Revoke invite
    const revokeInvite = async (inviteId: string) => {
        if (!currentTenant?.id) return;

        const invite = invites.find((i) => i.id === inviteId);
        const inviteDocRef = doc(db, "tenants", currentTenant.id, "invites", inviteId);
        await deleteDoc(inviteDocRef);

        if (invite?.code) {
            deleteDoc(doc(db, "invites", invite.code)).catch(() => {});
        }
    };

    // 17. Join organization by invite code
    const joinOrganizationByCode = async (code: string): Promise<boolean> => {
        if (!user) throw new Error("Must be signed in to join an organization.");

        const cleanCode = code.trim().toUpperCase();
        if (!cleanCode) return false;

        let tenantId = "";
        let tenantName = "";
        let assignedRole: TenantRole = "member";

        // Check global invites collection
        const inviteDocRef = doc(db, "invites", cleanCode);
        const inviteDoc = await getDoc(inviteDocRef);

        if (inviteDoc.exists()) {
            const data = inviteDoc.data();
            tenantId = data.tenantId;
            tenantName = data.tenantName;
            assignedRole = (data.role as TenantRole) || "member";
        } else {
            // Check if matches master inviteCode on tenant
            const q = query(collection(db, "tenants"), where("inviteCode", "==", cleanCode));
            const querySnap = await getDocs(q);
            if (!querySnap.empty) {
                const matchDoc = querySnap.docs[0];
                tenantId = matchDoc.id;
                tenantName = matchDoc.data().name;
                assignedRole = "member";
            } else {
                return false;
            }
        }

        const now = new Date();
        const batch = writeBatch(db);

        // Add to tenant members
        const memberDocRef = doc(db, "tenants", tenantId, "members", user.uid);
        batch.set(
            memberDocRef,
            {
                uid: user.uid,
                displayName: userProfile.displayName || user.displayName || "Member",
                email: userProfile.email || user.email || "",
                phoneNumber: userProfile.phoneNumber || user.phoneNumber || "",
                role: assignedRole,
                active: true,
                joinedAt: now,
                updatedAt: now
            },
            { merge: true }
        );

        // Add to user memberships
        const userMembershipRef = doc(db, "users", user.uid, "memberships", tenantId);
        batch.set(userMembershipRef, {
            tenantId,
            tenantName,
            role: assignedRole,
            joinedAt: now
        });

        await batch.commit();

        switchTenant(tenantId);
        return true;
    };

    // 18. Leave organization
    const leaveOrganization = async (tenantId: string) => {
        if (!user) return;

        const memberDocRef = doc(db, "tenants", tenantId, "members", user.uid);
        await deleteDoc(memberDocRef);

        const userMembershipRef = doc(db, "users", user.uid, "memberships", tenantId);
        await deleteDoc(userMembershipRef);

        if (currentTenant?.id === tenantId) {
            const remaining = tenants.filter((t) => t.id !== tenantId);
            if (remaining.length > 0) {
                switchTenant(remaining[0].id);
            } else {
                setCurrentTenant(null);
            }
        }
    };

    const respondToUserInvite = async (inviteId: string, accept: boolean) => {
        const invite = userInvites.find((i) => i.id === inviteId);
        if (invite && accept) {
            await joinOrganizationByCode(invite.tenantId);
        }
        setUserInvites((prev) => prev.filter((i) => i.id !== inviteId));
    };

    return (
        <AppContext.Provider
            value={{
                currentTenant,
                tenants,
                members,
                invites,
                userInvites,
                isLoadingTenants,
                isLoadingMembers,
                switchTenant,
                createOrganization,
                updateOrgSettings,
                addPhoneNumber,
                removePhoneNumber,
                setPrimaryPhoneNumber,
                addMember,
                updateMemberRole,
                toggleMemberActive,
                removeMember,
                createInvite,
                revokeInvite,
                joinOrganizationByCode,
                leaveOrganization,
                respondToUserInvite,
                user,
                userProfile,
                isAuthLoading,
                updateUserProfile
            }}
        >
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error("useApp must be used within an AppProvider");
    }
    return context;
}
