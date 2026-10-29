import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useSearchParams, Navigate, useLocation } from "react-router";
import {
    GoogleAuthProvider,
    signInWithPopup,
    signInWithPhoneNumber,
    RecaptchaVerifier,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    type ConfirmationResult
} from "firebase/auth";
import { auth } from "../firebase";
import { useApp } from "../context/AppContext";
import { IconBuilding, IconCheckCircle, IconShield, IconUsers } from "../components/Icons";

export function meta() {
    return [
        { title: "Sign In or Sign Up | PartyLine" },
        { name: "description", content: "Access your shared phone number and organization on PartyLine." }
    ];
}

type AuthMode = "signin" | "signup";
type SignupType = "new-org" | "join-org" | "individual";

export default function LoginPage() {
    const { user, isAuthLoading, createOrganization, joinOrganizationByCode, updateUserProfile } = useApp();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    const isSignupPath = location.pathname.startsWith("/signup");
    const modeParam = searchParams.get("mode");
    const authMode: AuthMode = isSignupPath || modeParam === "signup" ? "signup" : "signin";

    const [signupType, setSignupType] = useState<SignupType>(() => {
        const type = searchParams.get("type");
        if (type === "join-org" || type === "individual") return type;
        return "new-org";
    });

    // Form inputs
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [orgName, setOrgName] = useState("");
    const [inviteCode, setInviteCode] = useState(searchParams.get("invite") || "");

    useEffect(() => {
        const type = searchParams.get("type");
        if (type === "join-org" || type === "individual" || type === "new-org") {
            setSignupType(type);
        }
        const invite = searchParams.get("invite");
        if (invite) {
            setInviteCode(invite);
        }
    }, [searchParams]);

    function handleSwitchMode(targetMode: AuthMode) {
        setErrorMessage(null);
        setPhoneVerificationStep(false);

        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("mode");
        const queryString = nextParams.toString() ? `?${nextParams.toString()}` : "";

        if (targetMode === "signup") {
            navigate(`/signup${queryString}`);
        } else {
            navigate(`/login${queryString}`);
        }
    }

    // Auth status & verification
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [phoneVerificationStep, setPhoneVerificationStep] = useState(false);
    const [verificationCode, setVerificationCode] = useState("");
    const confirmationResultRef = useRef<ConfirmationResult | null>(null);
    const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);

    useEffect(() => {
        return () => {
            recaptchaVerifier.current?.clear();
        };
    }, []);

    // Redirect if already logged in and not in the middle of onboarding
    useEffect(() => {
        if (!isAuthLoading && user && !phoneVerificationStep && !isLoading && !successMessage) {
            navigate("/account", { replace: true });
        }
    }, [user, isAuthLoading, phoneVerificationStep, isLoading, successMessage, navigate]);

    // Google Sign-in
    async function handleGoogleAuth() {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);

            if (authMode === "signup") {
                if (signupType === "new-org" && orgName.trim()) {
                    await createOrganization(orgName.trim(), phoneNumber.trim());
                } else if (signupType === "join-org" && inviteCode.trim()) {
                    await joinOrganizationByCode(inviteCode.trim());
                }
            }

            if (displayName.trim()) {
                await updateUserProfile({ displayName: displayName.trim() });
            }

            setSuccessMessage("Signed in successfully! Redirecting...");
            setTimeout(() => navigate("/account"), 800);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Unable to authenticate with Google.");
        } finally {
            setIsLoading(false);
        }
    }

    // Phone Sign-in
    async function handleSendPhoneCode() {
        if (!phoneNumber.trim()) {
            setErrorMessage("Please enter a valid phone number with country code (e.g. +19785550142).");
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
            if (!recaptchaVerifier.current) {
                recaptchaVerifier.current = new RecaptchaVerifier(auth, "recaptcha-container", {
                    size: "invisible"
                });
            }

            const confirmation = await signInWithPhoneNumber(auth, phoneNumber.trim(), recaptchaVerifier.current);
            confirmationResultRef.current = confirmation;
            setPhoneVerificationStep(true);
            setSuccessMessage(`Verification code sent to ${phoneNumber.trim()}`);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to send SMS code. Check phone format.");
        } finally {
            setIsLoading(false);
        }
    }

    async function handleConfirmPhoneCode() {
        if (!verificationCode.trim()) {
            setErrorMessage("Please enter the 6-digit verification code.");
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
            if (!confirmationResultRef.current) {
                throw new Error("No pending SMS verification. Please request a new code.");
            }
            const result = await confirmationResultRef.current.confirm(verificationCode.trim());
            const authedUser = result.user;

            if (authMode === "signup") {
                if (displayName.trim()) {
                    await updateProfile(authedUser, { displayName: displayName.trim() });
                    await updateUserProfile({ displayName: displayName.trim(), phoneNumber: phoneNumber.trim() });
                }
                if (signupType === "new-org" && orgName.trim()) {
                    await createOrganization(orgName.trim(), phoneNumber.trim());
                } else if (signupType === "join-org" && inviteCode.trim()) {
                    await joinOrganizationByCode(inviteCode.trim());
                }
            }

            setSuccessMessage("Phone verification confirmed! Redirecting...");
            setTimeout(() => navigate("/account"), 800);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Invalid code. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }

    // Email & Password Auth
    async function handleEmailAuth(e: React.FormEvent) {
        e.preventDefault();
        setErrorMessage(null);
        setSuccessMessage(null);

        if (!email.trim() || !password) {
            setErrorMessage("Please fill out your email and password.");
            return;
        }

        setIsLoading(true);

        try {
            if (authMode === "signup") {
                if (signupType === "new-org" && !orgName.trim()) {
                    throw new Error("Please provide your organization name.");
                }
                if (signupType === "join-org" && !inviteCode.trim()) {
                    throw new Error("Please enter your organization invite code.");
                }

                const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
                if (displayName.trim()) {
                    await updateProfile(credential.user, { displayName: displayName.trim() });
                    await updateUserProfile({
                        displayName: displayName.trim(),
                        email: email.trim(),
                        phoneNumber: phoneNumber.trim()
                    });
                }

                if (signupType === "new-org") {
                    await createOrganization(orgName.trim(), phoneNumber.trim());
                } else if (signupType === "join-org") {
                    await joinOrganizationByCode(inviteCode.trim());
                }

                setSuccessMessage("Account created successfully! Redirecting...");
                setTimeout(() => navigate("/account"), 800);
            } else {
                await signInWithEmailAndPassword(auth, email.trim(), password);
                setSuccessMessage("Signed in successfully! Redirecting...");
                setTimeout(() => navigate("/account"), 800);
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Authentication failed.");
        } finally {
            setIsLoading(false);
        }
    }

    if (isAuthLoading) {
        return (
            <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-400">Loading...</p>
                </div>
            </main>
        );
    }

    if (user && !phoneVerificationStep && !isLoading && !successMessage) {
        return <Navigate to="/account" replace />;
    }

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Subtle background glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -z-10 h-96 w-96 rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <Link to="/" className="flex items-center justify-center gap-2.5 mb-2">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-linear-to-tr from-blue-600 to-indigo-500 text-lg font-black text-white shadow-lg shadow-blue-500/25">
                        P
                    </span>
                    <span className="text-2xl font-bold tracking-tight text-white">PartyLine</span>
                </Link>
                <h1 className="text-center text-xl font-semibold text-slate-200">
                    {authMode === "signin" ? "Sign in to your account" : "Create your PartyLine account"}
                </h1>
                <p className="mt-1 text-center text-xs text-slate-400">
                    {authMode === "signin"
                        ? "Manage your shared organization numbers, duty schedules, and calls."
                        : "One unified phone line for your facilities, events, and host teams."}
                </p>
            </div>

            <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
                    {/* Mode Switcher Tabs */}
                    <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-950 p-1 border border-slate-800">
                        <button
                            type="button"
                            onClick={() => handleSwitchMode("signin")}
                            className={`rounded-lg py-2 text-xs font-semibold transition ${
                                authMode === "signin"
                                    ? "bg-blue-600 text-white shadow"
                                    : "text-slate-400 hover:text-slate-200"
                            }`}
                        >
                            Sign In
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSwitchMode("signup")}
                            className={`rounded-lg py-2 text-xs font-semibold transition ${
                                authMode === "signup"
                                    ? "bg-blue-600 text-white shadow"
                                    : "text-slate-400 hover:text-slate-200"
                            }`}
                        >
                            Sign Up
                        </button>
                    </div>

                    {/* Sign Up Flow Selection */}
                    {authMode === "signup" && (
                        <div className="mb-6">
                            <label className="block text-xs font-medium text-slate-400 mb-2">
                                What would you like to do?
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSignupType("new-org")}
                                    className={`flex flex-col items-center justify-center rounded-xl p-3 text-center border transition ${
                                        signupType === "new-org"
                                            ? "border-blue-500 bg-blue-500/10 text-white ring-1 ring-blue-500"
                                            : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                                    }`}
                                >
                                    <IconBuilding className="h-5 w-5 mb-1 text-blue-400" />
                                    <span className="text-[11px] font-semibold leading-tight">Create Org</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSignupType("join-org")}
                                    className={`flex flex-col items-center justify-center rounded-xl p-3 text-center border transition ${
                                        signupType === "join-org"
                                            ? "border-blue-500 bg-blue-500/10 text-white ring-1 ring-blue-500"
                                            : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                                    }`}
                                >
                                    <IconUsers className="h-5 w-5 mb-1 text-emerald-400" />
                                    <span className="text-[11px] font-semibold leading-tight">Join with Code</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSignupType("individual")}
                                    className={`flex flex-col items-center justify-center rounded-xl p-3 text-center border transition ${
                                        signupType === "individual"
                                            ? "border-blue-500 bg-blue-500/10 text-white ring-1 ring-blue-500"
                                            : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                                    }`}
                                >
                                    <IconShield className="h-5 w-5 mb-1 text-purple-400" />
                                    <span className="text-[11px] font-semibold leading-tight">Individual</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Social Auth Providers */}
                    <div className="space-y-3 mb-6">
                        <button
                            type="button"
                            onClick={handleGoogleAuth}
                            disabled={isLoading}
                            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition shadow-sm disabled:opacity-60"
                        >
                            <svg className="h-4 w-4" viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.9c2.28-2.1 3.64-5.2 3.64-9.14z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.74-2.1-6.68-4.93H1.28v3.13C3.26 21.3 7.36 24 12 24z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.32 14.27A7.16 7.16 0 0 1 5 12c0-.79.13-1.57.32-2.27V6.6H1.28A11.967 11.967 0 0 0 0 12c0 1.92.45 3.74 1.28 5.4l4.04-3.13z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.7 1.28 6.6l4.04 3.13c.94-2.83 3.58-4.96 6.68-4.96z"
                                />
                            </svg>
                            Continue with Google
                        </button>
                    </div>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-800" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-slate-900 px-3 text-slate-500">Or continue with credentials</span>
                        </div>
                    </div>

                    {/* Email & Password Form */}
                    <form onSubmit={handleEmailAuth} className="space-y-4">
                        {/* If signing up, ask for name */}
                        {authMode === "signup" && (
                            <div>
                                <label className="block text-xs font-medium text-slate-300">Your Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Jane Doe"
                                    className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        )}

                        {/* Sign up for new organization fields */}
                        {authMode === "signup" && signupType === "new-org" && (
                            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-blue-300">
                                        Organization Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={orgName}
                                        onChange={(e) => setOrgName(e.target.value)}
                                        placeholder="e.g. Somerville Soccer Club, Veterans Hall"
                                        className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-300">
                                        Organization / Twilio Phone Number (Optional)
                                    </label>
                                    <input
                                        type="tel"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        placeholder="+19789972789"
                                        className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                    />
                                    <p className="mt-1 text-[11px] text-slate-500">
                                        You can also configure phone numbers anytime in Org Settings.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Sign up to join existing organization with invite code */}
                        {authMode === "signup" && signupType === "join-org" && (
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
                                <label className="block text-xs font-semibold text-emerald-300">
                                    Organization Invite Code
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={inviteCode}
                                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                    placeholder="e.g. HALL-8821"
                                    className="mt-1 block w-full uppercase tracking-wider rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                                />
                                <p className="text-[11px] text-slate-400">
                                    Ask your organization admin for their team invite code.
                                </p>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-medium text-slate-300">Email Address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@organization.com"
                                className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-medium text-slate-300">Password</label>
                            </div>
                            <input
                                type="password"
                                required
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500 transition disabled:opacity-60"
                        >
                            {isLoading
                                ? "Processing..."
                                : authMode === "signin"
                                  ? "Sign In"
                                  : signupType === "new-org"
                                    ? "Create Organization & Account"
                                    : "Complete Registration"}
                        </button>
                    </form>

                    {/* Phone Authentication Section */}
                    <div className="mt-6 border-t border-slate-800 pt-5">
                        <p className="text-xs font-medium text-slate-400 mb-3 text-center">Or sign in via SMS code</p>

                        {!phoneVerificationStep ? (
                            <div className="flex gap-2">
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    placeholder="+19785550142"
                                    className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={handleSendPhoneCode}
                                    disabled={isLoading}
                                    className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition disabled:opacity-50"
                                >
                                    Send Code
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={verificationCode}
                                        onChange={(e) => setVerificationCode(e.target.value)}
                                        placeholder="6-digit SMS code"
                                        className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs sm:text-sm font-mono tracking-widest text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleConfirmPhoneCode}
                                        disabled={isLoading}
                                        className="rounded-xl bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-500 transition disabled:opacity-50"
                                    >
                                        Verify & Login
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setPhoneVerificationStep(false)}
                                    className="text-[11px] text-slate-400 hover:text-slate-200"
                                >
                                    Change phone number
                                </button>
                            </div>
                        )}
                        <div id="recaptcha-container" />
                    </div>

                    {/* Feedback Messages */}
                    {errorMessage && (
                        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                            {errorMessage}
                        </div>
                    )}
                    {successMessage && (
                        <div className="mt-4 flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-300">
                            <IconCheckCircle className="h-4 w-4 shrink-0" />
                            <span>{successMessage}</span>
                        </div>
                    )}
                </div>

                {/* Footer Switcher */}
                <p className="mt-6 text-center text-xs text-slate-400">
                    {authMode === "signin" ? (
                        <>
                            Don't have an account yet?{" "}
                            <button
                                type="button"
                                onClick={() => handleSwitchMode("signup")}
                                className="font-semibold text-blue-400 hover:underline"
                            >
                                Sign up for PartyLine
                            </button>
                        </>
                    ) : (
                        <>
                            Already have an account?{" "}
                            <button
                                type="button"
                                onClick={() => handleSwitchMode("signin")}
                                className="font-semibold text-blue-400 hover:underline"
                            >
                                Sign in here
                            </button>
                        </>
                    )}
                </p>
            </div>
        </main>
    );
}
