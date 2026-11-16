import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import type { Device, Call, TwilioError } from "@twilio/voice-sdk";
import { useUser } from "./UserContext";
import { useApp } from "./AppContext";
import {
    fetchTwilioVoiceToken,
    initiateTwilioCall,
    startAdHocCallRecording,
    stopAdHocCallRecording
} from "../twilioHistory";
import {
    IconPhone,
    IconPhoneOutgoing,
    IconPhoneHangup,
    IconMicrophone,
    IconMicrophoneSlash,
    IconKeypad,
    IconMinimize,
    IconMaximize,
    IconClock
} from "../components/Icons";

export type CallStatus =
    | "idle"
    | "requesting_token"
    | "requesting_mic"
    | "connecting"
    | "ringing"
    | "ringing_inbound"
    | "connected"
    | "disconnected"
    | "error";

export type CallDirection = "inbound" | "outbound";

interface WebRTCCallContextType {
    callStatus: CallStatus;
    callDirection: CallDirection;
    activeNumber: string | null;
    contactName: string | null;
    eventContext: string | null;
    callerId: string | null;
    duration: number;
    isMuted: boolean;
    isRecording: boolean;
    isRecordingLoading: boolean;
    isCallModalOpen: boolean;
    isKeypadOpen: boolean;
    errorMessage: string | null;
    startCall: (targetNumber: string, contactName?: string, eventContext?: string) => Promise<void>;
    acceptIncomingCall: () => Promise<void>;
    rejectIncomingCall: () => void;
    hangUp: () => void;
    toggleMute: () => void;
    toggleCallRecording: () => Promise<void>;
    sendDigits: (digit: string) => void;
    setIsKeypadOpen: React.Dispatch<React.SetStateAction<boolean>>;
    triggerPhoneBridge: () => Promise<void>;
    closeCallModal: () => void;
}

const WebRTCCallContext = createContext<WebRTCCallContextType | undefined>(undefined);

export function WebRTCCallProvider({ children }: { children: React.ReactNode }) {
    const { user } = useUser();
    const { currentTenant, userProfile, members } = useApp();

    const [isCallModalOpen, setIsCallModalOpen] = useState<boolean>(false);
    const [callStatus, setCallStatus] = useState<CallStatus>("idle");
    const [callDirection, setCallDirection] = useState<CallDirection>("outbound");
    const [activeNumber, setActiveNumber] = useState<string | null>(null);
    const [contactName, setContactName] = useState<string | null>(null);
    const [eventContext, setEventContext] = useState<string | null>(null);
    const [callerId, setCallerId] = useState<string | null>(null);
    const [duration, setDuration] = useState<number>(0);
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isKeypadOpen, setIsKeypadOpen] = useState<boolean>(false);
    const [isBridgeFallbackLoading, setIsBridgeFallbackLoading] = useState<boolean>(false);
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isRecordingLoading, setIsRecordingLoading] = useState<boolean>(false);

    // References for Twilio Voice objects
    const deviceRef = useRef<Device | null>(null);
    const callRef = useRef<Call | null>(null);
    const incomingCallRef = useRef<Call | null>(null);
    const recordingSidRef = useRef<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const ringtoneStopRef = useRef<(() => void) | null>(null);

    // Helper: start Web Audio telephone ringtone
    const startRingtone = useCallback(() => {
        if (typeof window === "undefined") return;
        try {
            const AudioCtx =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            let isRunning = true;

            const playBurst = () => {
                if (!isRunning || ctx.state === "closed") return;
                try {
                    const now = ctx.currentTime;
                    const osc1 = ctx.createOscillator();
                    const osc2 = ctx.createOscillator();
                    const gain = ctx.createGain();

                    osc1.frequency.setValueAtTime(440, now);
                    osc2.frequency.setValueAtTime(480, now);

                    gain.gain.setValueAtTime(0.08, now);
                    gain.gain.setValueAtTime(0.08, now + 1.8);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

                    osc1.connect(gain);
                    osc2.connect(gain);
                    gain.connect(ctx.destination);

                    osc1.start(now);
                    osc2.start(now);
                    osc1.stop(now + 2.0);
                    osc2.stop(now + 2.0);
                } catch {
                    // ignore
                }
            };

            playBurst();
            const interval = setInterval(() => {
                if (!isRunning) return;
                playBurst();
            }, 5000);

            ringtoneStopRef.current = () => {
                isRunning = false;
                clearInterval(interval);
                try {
                    ctx.close();
                } catch {}
                ringtoneStopRef.current = null;
            };
        } catch {
            // ignore
        }
    }, []);

    // Stop ringtone
    const stopRingtone = useCallback(() => {
        if (ringtoneStopRef.current) {
            ringtoneStopRef.current();
            ringtoneStopRef.current = null;
        }
    }, []);

    // Stop duration timer
    const stopTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // Start duration timer
    const startTimer = useCallback(() => {
        stopTimer();
        setDuration(0);
        timerRef.current = setInterval(() => {
            setDuration((prev) => prev + 1);
        }, 1000);
    }, [stopTimer]);

    // Clean up local media tracks
    const stopLocalAudio = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    }, []);

    // Close modal & reset all states to idle
    const closeCallModal = useCallback(() => {
        stopTimer();
        stopLocalAudio();
        stopRingtone();
        if (callRef.current) {
            try {
                callRef.current.disconnect();
            } catch {}
            callRef.current = null;
        }
        if (incomingCallRef.current) {
            try {
                incomingCallRef.current.reject();
            } catch {}
            incomingCallRef.current = null;
        }
        setIsCallModalOpen(false);
        setCallStatus("idle");
        setActiveNumber(null);
        setContactName(null);
        setEventContext(null);
        setErrorMessage(null);
        setIsKeypadOpen(false);
        setIsExpanded(false);
        setIsMuted(false);
        setDuration(0);
    }, [stopTimer, stopLocalAudio, stopRingtone]);

    // Hang up active call
    const hangUp = useCallback(() => {
        stopRingtone();
        setIsRecording(false);
        recordingSidRef.current = null;
        try {
            if (callRef.current) {
                callRef.current.disconnect();
                callRef.current = null;
            }
            if (incomingCallRef.current) {
                incomingCallRef.current.reject();
                incomingCallRef.current = null;
            }
            if (deviceRef.current) {
                deviceRef.current.disconnectAll();
            }
        } catch (err) {
            console.warn("Error during call disconnect:", err);
        }
        stopTimer();
        stopLocalAudio();
        setCallStatus((prev) => (prev === "idle" ? "idle" : "disconnected"));
        setIsMuted(false);
    }, [stopTimer, stopLocalAudio, stopRingtone]);

    // Toggle ad hoc call recording
    const toggleCallRecording = useCallback(async () => {
        if (!user || !currentTenant || !callRef.current) return;
        const callSid = callRef.current.parameters?.CallSid;
        if (!callSid) {
            setErrorMessage("Recording is only available on an established call.");
            return;
        }

        setIsRecordingLoading(true);
        try {
            if (!isRecording) {
                const res = await startAdHocCallRecording(user, currentTenant.id, callSid);
                recordingSidRef.current = res.sid;
                setIsRecording(true);
            } else if (recordingSidRef.current) {
                await stopAdHocCallRecording(user, currentTenant.id, callSid, recordingSidRef.current);
                recordingSidRef.current = null;
                setIsRecording(false);
            }
        } catch (err) {
            console.warn("Failed to toggle call recording:", err);
            setErrorMessage(err instanceof Error ? err.message : "Unable to toggle recording.");
        } finally {
            setIsRecordingLoading(false);
        }
    }, [user, currentTenant, isRecording]);

    // Auto-dismiss call card 2.5 seconds after call ends
    useEffect(() => {
        if (callStatus === "disconnected") {
            const timeout = setTimeout(() => {
                closeCallModal();
            }, 2500);
            return () => clearTimeout(timeout);
        }
    }, [callStatus, closeCallModal]);

    // Manage ringtone on inbound call
    useEffect(() => {
        if (callStatus === "ringing_inbound") {
            startRingtone();
        } else {
            stopRingtone();
        }
        return () => {
            stopRingtone();
        };
    }, [callStatus, startRingtone, stopRingtone]);

    // Register Twilio Voice Device in background when signed in to receive incoming calls!
    useEffect(() => {
        if (!user || !currentTenant || userProfile.enableWebCalls === false || typeof window === "undefined") {
            if (deviceRef.current) {
                try {
                    deviceRef.current.destroy();
                } catch {}
                deviceRef.current = null;
            }
            return;
        }

        let isCancelled = false;

        async function initIncomingDevice() {
            try {
                const tokenData = await fetchTwilioVoiceToken(user!, currentTenant!.id);
                if (isCancelled) return;

                const { Device, Call } = await import("@twilio/voice-sdk");
                if (isCancelled) return;

                if (deviceRef.current) {
                    try {
                        deviceRef.current.destroy();
                    } catch {}
                }

                const device = new Device(tokenData.token, {
                    codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU]
                });

                device.on("registered", () => {
                    console.log("PartyLine WebRTC Device registered and listening for incoming calls.");
                });

                device.on("incoming", (incomingCall: Call) => {
                    console.log("Incoming Twilio WebRTC Call:", incomingCall);
                    incomingCallRef.current = incomingCall;
                    callRef.current = incomingCall;

                    const fromNumber = incomingCall.parameters?.From || "Unknown Caller";
                    const toNumber = incomingCall.parameters?.To || tokenData.tenantPhoneNumber;

                    setActiveNumber(fromNumber);
                    setCallerId(toNumber);
                    setCallDirection("inbound");
                    setCallStatus("ringing_inbound");
                    setIsCallModalOpen(true);
                    setIsMuted(false);
                    setErrorMessage(null);

                    incomingCall.on("accept", () => {
                        stopRingtone();
                        setCallStatus("connected");
                        startTimer();
                    });

                    incomingCall.on("disconnect", () => {
                        stopRingtone();
                        setCallStatus("disconnected");
                        stopTimer();
                        stopLocalAudio();
                        incomingCallRef.current = null;
                        callRef.current = null;
                    });

                    incomingCall.on("cancel", () => {
                        stopRingtone();
                        setCallStatus("disconnected");
                        stopTimer();
                        stopLocalAudio();
                        incomingCallRef.current = null;
                        callRef.current = null;
                    });

                    incomingCall.on("error", (err: TwilioError.TwilioError) => {
                        console.error("Incoming call error:", err);
                        stopRingtone();
                        setErrorMessage(err?.message || "Call encountered an error.");
                        setCallStatus("error");
                        stopTimer();
                        stopLocalAudio();
                        incomingCallRef.current = null;
                        callRef.current = null;
                    });
                });

                device.on("error", (error: TwilioError.TwilioError) => {
                    console.warn("Twilio Voice Device background notice:", error?.message);
                });

                await device.register();
                deviceRef.current = device;
            } catch (err) {
                console.warn("Could not register incoming Twilio Voice device in background:", err);
            }
        }

        initIncomingDevice();

        return () => {
            isCancelled = true;
            if (deviceRef.current) {
                try {
                    deviceRef.current.destroy();
                } catch {}
                deviceRef.current = null;
            }
        };
    }, [user?.uid, currentTenant?.id, userProfile.enableWebCalls, startTimer, stopTimer, stopLocalAudio, stopRingtone]);

    // Accept an incoming call
    const acceptIncomingCall = useCallback(async () => {
        if (!incomingCallRef.current) return;
        stopRingtone();
        try {
            // Request microphone on the accept button gesture
            if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
                try {
                    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    streamRef.current = micStream;
                } catch (micErr) {
                    console.warn("Mic access issue on accept:", micErr);
                }
            }

            incomingCallRef.current.accept();
            setCallStatus("connected");
            startTimer();
        } catch (err) {
            console.error("Failed to accept incoming call:", err);
            setErrorMessage(err instanceof Error ? err.message : "Failed to accept call.");
            setCallStatus("error");
        }
    }, [startTimer, stopRingtone]);

    // Reject an incoming call
    const rejectIncomingCall = useCallback(() => {
        stopRingtone();
        if (incomingCallRef.current) {
            try {
                incomingCallRef.current.reject();
            } catch {}
            incomingCallRef.current = null;
            callRef.current = null;
        }
        closeCallModal();
    }, [stopRingtone, closeCallModal]);

    // Toggle mute
    const toggleMute = useCallback(() => {
        if (!callRef.current) return;
        try {
            const nextMuted = !isMuted;
            callRef.current.mute(nextMuted);
            setIsMuted(nextMuted);
        } catch (err) {
            console.error("Failed to toggle mute:", err);
        }
    }, [isMuted]);

    // Send DTMF digits
    const sendDigits = useCallback((digit: string) => {
        if (!callRef.current) return;
        try {
            callRef.current.sendDigits(digit);
        } catch (err) {
            console.error("Failed to send digits:", err);
        }
    }, []);

    // Fallback: Trigger Twilio Phone Bridge
    const triggerPhoneBridge = useCallback(async () => {
        if (!user || !currentTenant || !activeNumber) return;
        setIsBridgeFallbackLoading(true);
        try {
            const memberPhone =
                userProfile.phoneNumber || members.find((m) => m.uid === user.uid)?.phoneNumber || undefined;
            await initiateTwilioCall(user, currentTenant.id, activeNumber, memberPhone);
            setCallStatus("connected");
            setErrorMessage(null);
            startTimer();
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to initiate phone bridge.");
            setCallStatus("error");
        } finally {
            setIsBridgeFallbackLoading(false);
        }
    }, [user, currentTenant, activeNumber, userProfile, members, startTimer]);

    // Start outbound WebRTC call (invoked ONLY when user clicks a Call button)
    const startCall = useCallback(
        async (targetNumber: string, contact?: string, context?: string) => {
            if (!user) {
                alert("Please sign in to make a call.");
                return;
            }
            if (!currentTenant) {
                alert("Please select an organization first.");
                return;
            }

            const cleanTarget = targetNumber.trim();
            if (!cleanTarget) return;

            // Open the call UI explicitly on user click
            setIsCallModalOpen(true);
            setCallDirection("outbound");
            setActiveNumber(cleanTarget);
            setContactName(contact ?? null);
            setEventContext(context ?? null);
            setErrorMessage(null);
            setIsKeypadOpen(false);
            setDuration(0);
            setIsMuted(false);

            try {
                // 1. Request microphone access immediately on user gesture
                setCallStatus("requesting_mic");
                if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
                    try {
                        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        streamRef.current = micStream;
                    } catch (micErr) {
                        console.warn("Microphone access denied or failed:", micErr);
                        setErrorMessage(
                            "Microphone access was denied. Please allow microphone permissions in your browser or use the Phone Bridge below."
                        );
                        setCallStatus("error");
                        return;
                    }
                }

                // 2. Fetch Voice Token from backend
                setCallStatus("requesting_token");
                const tokenData = await fetchTwilioVoiceToken(user, currentTenant.id);
                setCallerId(tokenData.tenantPhoneNumber);

                // 3. Import and initialize Twilio Voice SDK Device
                setCallStatus("connecting");
                const { Device, Call } = await import("@twilio/voice-sdk");

                let device = deviceRef.current;
                if (!device) {
                    device = new Device(tokenData.token, {
                        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU]
                    });
                    await device.register();
                    deviceRef.current = device;
                }

                // 4. Initiate outbound call
                const call = await device.connect({
                    params: {
                        To: cleanTarget,
                        tenantId: currentTenant.id,
                        callerId: tokenData.tenantPhoneNumber
                    }
                });

                callRef.current = call;

                call.on("ringing", () => {
                    setCallStatus("ringing");
                });

                call.on("accept", () => {
                    setCallStatus("connected");
                    startTimer();
                });

                call.on("disconnect", () => {
                    setCallStatus("disconnected");
                    stopTimer();
                    stopLocalAudio();
                });

                call.on("cancel", () => {
                    setCallStatus("disconnected");
                    stopTimer();
                    stopLocalAudio();
                });

                call.on("error", (error: TwilioError.TwilioError) => {
                    console.error("Twilio Call error:", error);
                    let userMsg = error?.message ?? "Call encountered an error.";
                    if (userMsg.includes("31005") || userMsg.includes("HANGUP") || userMsg.includes("gateway")) {
                        userMsg =
                            "Twilio could not reach the backend voice webhook (ConnectionError 31005). Please verify that the backend is running and reachable by Twilio, or use the Phone Bridge below.";
                    }
                    setErrorMessage(userMsg);
                    setCallStatus("error");
                    stopTimer();
                    stopLocalAudio();
                });

                call.on("mute", (muted: boolean) => {
                    setIsMuted(muted);
                });
            } catch (err) {
                console.error("Failed to start WebRTC call:", err);
                setErrorMessage(err instanceof Error ? err.message : "Failed to connect call via WebRTC.");
                setCallStatus("error");
                stopTimer();
                stopLocalAudio();
            }
        },
        [user, currentTenant, startTimer, stopTimer, stopLocalAudio]
    );

    // Format duration mm:ss
    const formatDuration = (totalSeconds: number) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const shouldShowCallWidget = isCallModalOpen && (activeNumber !== null || callStatus === "ringing_inbound");

    return (
        <WebRTCCallContext.Provider
            value={{
                callStatus,
                callDirection,
                activeNumber,
                contactName,
                eventContext,
                callerId,
                duration,
                isMuted,
                isRecording,
                isRecordingLoading,
                isCallModalOpen,
                isKeypadOpen,
                errorMessage,
                startCall,
                acceptIncomingCall,
                rejectIncomingCall,
                hangUp,
                toggleMute,
                toggleCallRecording,
                sendDigits,
                setIsKeypadOpen,
                triggerPhoneBridge,
                closeCallModal
            }}
        >
            {children}

            {/* In-Call VoIP Widget (Renders ONLY when an outbound or inbound call is active) */}
            {shouldShowCallWidget && (
                <>
                    {/* Centered Modal Mode when Expanded */}
                    {isExpanded && (
                        <div
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
                            onClick={(e) => {
                                if (e.target === e.currentTarget) setIsExpanded(false);
                            }}
                        >
                            <div className="relative w-full max-w-sm rounded-3xl border border-slate-700 bg-linear-to-b from-slate-900 via-slate-900 to-slate-950 p-6 text-white shadow-2xl">
                                {/* Header */}
                                <div className="flex items-center justify-between text-slate-400">
                                    <button
                                        type="button"
                                        onClick={() => setIsExpanded(false)}
                                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                                        title="Minimize to corner widget"
                                    >
                                        <IconMinimize className="h-4 w-4" />
                                    </button>
                                    <span className="text-[11px] font-semibold tracking-wider uppercase text-emerald-400 flex items-center gap-1.5">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                                        PartyLine Voice
                                    </span>
                                    <button
                                        type="button"
                                        onClick={closeCallModal}
                                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                                        title="Close"
                                    >
                                        ✕
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="mt-4 text-center">
                                    {callerId && (
                                        <p className="text-[11px] text-slate-400">
                                            {callDirection === "inbound" ? "Line: " : "From: "}
                                            <span className="text-emerald-400 font-semibold">{callerId}</span>
                                        </p>
                                    )}

                                    <div className="my-4 flex flex-col items-center">
                                        <div className="relative my-2 flex items-center justify-center">
                                            {callStatus === "connected" && (
                                                <div className="absolute -inset-3 rounded-full bg-emerald-500/20 animate-ping" />
                                            )}
                                            {callStatus === "ringing_inbound" && (
                                                <div className="absolute -inset-4 rounded-full bg-emerald-500/30 animate-ping" />
                                            )}
                                            <div
                                                className={`h-16 w-16 rounded-full flex items-center justify-center border-2 transition-all ${
                                                    callStatus === "connected" || callStatus === "ringing_inbound"
                                                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                                                        : callStatus === "error"
                                                          ? "border-rose-500 bg-rose-500/10 text-rose-400"
                                                          : "border-indigo-500 bg-indigo-500/10 text-indigo-400 animate-pulse"
                                                }`}
                                            >
                                                {callStatus === "connected" ? (
                                                    <IconPhone className="h-8 w-8 text-emerald-400" />
                                                ) : callStatus === "ringing_inbound" ? (
                                                    <IconPhone className="h-8 w-8 text-emerald-400 animate-bounce" />
                                                ) : callStatus === "disconnected" ? (
                                                    <IconPhoneHangup className="h-8 w-8 text-slate-400" />
                                                ) : (
                                                    <IconPhoneOutgoing className="h-8 w-8 animate-pulse" />
                                                )}
                                            </div>
                                        </div>

                                        <h3 className="text-lg font-bold text-white mt-1">
                                            {contactName || activeNumber}
                                        </h3>
                                        {contactName && (
                                            <p className="text-xs text-slate-400 font-mono">{activeNumber}</p>
                                        )}
                                        {eventContext && (
                                            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-medium text-indigo-300">
                                                Event: {eventContext}
                                            </span>
                                        )}
                                    </div>

                                    {/* Status Pill */}
                                    <div className="my-2 flex items-center justify-center">
                                        {callStatus === "connected" && (
                                            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-1 text-xs font-semibold text-emerald-300">
                                                <IconClock className="h-3.5 w-3.5 text-emerald-400" />
                                                <span className="font-mono">{formatDuration(duration)}</span>
                                            </div>
                                        )}
                                        {callStatus === "ringing_inbound" && (
                                            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3.5 py-1 text-xs font-bold text-emerald-300 animate-pulse">
                                                🔔 Incoming call ringing...
                                            </span>
                                        )}
                                        {callStatus === "ringing" && (
                                            <span className="text-xs font-semibold text-amber-300 animate-pulse">
                                                🔔 Ringing customer...
                                            </span>
                                        )}
                                        {callStatus === "connecting" && (
                                            <span className="text-xs font-semibold text-blue-300 animate-pulse">
                                                Connecting WebRTC audio...
                                            </span>
                                        )}
                                        {callStatus === "requesting_mic" && (
                                            <span className="text-xs font-semibold text-indigo-300 animate-pulse">
                                                Requesting microphone access...
                                            </span>
                                        )}
                                        {callStatus === "requesting_token" && (
                                            <span className="text-xs font-medium text-slate-400 animate-pulse">
                                                Authenticating voice session...
                                            </span>
                                        )}
                                        {callStatus === "disconnected" && (
                                            <span className="text-xs font-medium text-slate-400">
                                                Call ended ({formatDuration(duration)})
                                            </span>
                                        )}
                                        {callStatus === "error" && (
                                            <span className="text-xs text-rose-300 text-left bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 rounded-xl">
                                                ⚠️ {errorMessage || "Call failed to connect."}
                                            </span>
                                        )}
                                    </div>

                                    {/* DTMF Keypad View */}
                                    {isKeypadOpen && callStatus === "connected" && (
                                        <div className="mt-3 grid grid-cols-3 gap-1.5 p-2.5 bg-slate-950/60 rounded-2xl border border-slate-800">
                                            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((d) => (
                                                <button
                                                    key={d}
                                                    type="button"
                                                    onClick={() => sendDigits(d)}
                                                    className="h-9 rounded-xl bg-slate-800 text-base font-bold text-slate-200 hover:bg-slate-700 active:bg-indigo-600 transition"
                                                >
                                                    {d}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Phone Bridge Fallback */}
                                    {callStatus === "error" && (
                                        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-left">
                                            <p className="text-xs font-semibold text-slate-200">
                                                Prefer using your mobile phone?
                                            </p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                PartyLine can call your phone (
                                                {userProfile?.phoneNumber || "your contact number"}) and bridge you to
                                                the customer.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={triggerPhoneBridge}
                                                disabled={isBridgeFallbackLoading}
                                                className="mt-2.5 w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50"
                                            >
                                                <IconPhoneOutgoing className="h-4 w-4" />
                                                {isBridgeFallbackLoading ? "Connecting..." : "Bridge Call via My Phone"}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Controls */}
                                <div className="mt-5 flex items-center justify-center gap-3">
                                    {callStatus === "ringing_inbound" ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={acceptIncomingCall}
                                                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/30"
                                            >
                                                <IconPhone className="h-4 w-4" />
                                                Accept Call
                                            </button>
                                            <button
                                                type="button"
                                                onClick={rejectIncomingCall}
                                                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 transition shadow-lg shadow-rose-600/30"
                                            >
                                                <IconPhoneHangup className="h-4 w-4" />
                                                Decline
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            {callStatus === "connected" && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={toggleMute}
                                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                                                            isMuted
                                                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                                                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                                        }`}
                                                    >
                                                        {isMuted ? (
                                                            <IconMicrophoneSlash className="h-4 w-4" />
                                                        ) : (
                                                            <IconMicrophone className="h-4 w-4" />
                                                        )}
                                                        {isMuted ? "Muted" : "Mute"}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => setIsKeypadOpen((prev) => !prev)}
                                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                                                            isKeypadOpen
                                                                ? "bg-indigo-600 text-white"
                                                                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                                        }`}
                                                    >
                                                        <IconKeypad className="h-4 w-4" />
                                                        Keypad
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={toggleCallRecording}
                                                        disabled={isRecordingLoading}
                                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                                                            isRecording
                                                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                                                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                                        }`}
                                                        title={isRecording ? "Stop call recording" : "Record call"}
                                                    >
                                                        <span
                                                            className={`h-2.5 w-2.5 rounded-full ${
                                                                isRecording
                                                                    ? "bg-rose-500 animate-pulse"
                                                                    : "bg-slate-400"
                                                            }`}
                                                        />
                                                        {isRecordingLoading ? "..." : isRecording ? "REC" : "Record"}
                                                    </button>
                                                </>
                                            )}

                                            {callStatus !== "disconnected" && callStatus !== "error" ? (
                                                <button
                                                    type="button"
                                                    onClick={hangUp}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 transition shadow-lg shadow-rose-600/30"
                                                >
                                                    <IconPhoneHangup className="h-4 w-4" />
                                                    End Call
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={closeCallModal}
                                                    className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition"
                                                >
                                                    Close
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Floating Bottom-Right VoIP Bar (Default, Non-Intrusive UX) */}
                    {!isExpanded && (
                        <aside
                            aria-label="Active Call Controller"
                            className="fixed bottom-5 right-5 z-50 w-84 rounded-2xl border border-slate-700/90 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-md text-white animate-fade-in transition-all duration-300"
                        >
                            {/* Card Top Row */}
                            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span
                                            className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                                callStatus === "connected" || callStatus === "ringing_inbound"
                                                    ? "animate-ping bg-emerald-400"
                                                    : callStatus === "error"
                                                      ? "bg-rose-400"
                                                      : "animate-ping bg-amber-400"
                                            }`}
                                        />
                                        <span
                                            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                                                callStatus === "connected" || callStatus === "ringing_inbound"
                                                    ? "bg-emerald-500"
                                                    : callStatus === "error"
                                                      ? "bg-rose-500"
                                                      : "bg-amber-500"
                                            }`}
                                        />
                                    </span>
                                    <span className="text-[11px] font-semibold tracking-wide uppercase text-slate-300">
                                        {callDirection === "inbound"
                                            ? `Incoming Line (${callerId || "PartyLine"})`
                                            : callerId
                                              ? `PartyLine (${callerId})`
                                              : "PartyLine Call"}
                                    </span>
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setIsExpanded(true)}
                                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                        title="Expand Call View"
                                    >
                                        <IconMaximize className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={closeCallModal}
                                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                        title="Close"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* Center Call Info */}
                            <div className="py-2.5 flex items-center justify-between">
                                <div className="truncate pr-2">
                                    <p className="text-sm font-bold text-white truncate">
                                        {contactName || activeNumber}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {contactName && (
                                            <span className="text-[11px] font-mono text-slate-400 truncate">
                                                {activeNumber}
                                            </span>
                                        )}
                                        <span className="text-[11px] text-slate-400">
                                            {callStatus === "connected" ? (
                                                <span className="font-mono text-emerald-400 font-semibold">
                                                    {formatDuration(duration)}
                                                </span>
                                            ) : callStatus === "ringing_inbound" ? (
                                                <span className="text-emerald-400 font-bold animate-pulse">
                                                    🔔 Incoming Call...
                                                </span>
                                            ) : callStatus === "ringing" ? (
                                                <span className="text-amber-400 animate-pulse">Ringing...</span>
                                            ) : callStatus === "connecting" ? (
                                                <span className="text-blue-400 animate-pulse">Connecting...</span>
                                            ) : callStatus === "requesting_mic" ? (
                                                <span className="text-indigo-400 animate-pulse">Mic request...</span>
                                            ) : callStatus === "disconnected" ? (
                                                <span className="text-slate-400">
                                                    Ended ({formatDuration(duration)})
                                                </span>
                                            ) : callStatus === "error" ? (
                                                <span className="text-rose-400">Call Error</span>
                                            ) : (
                                                callStatus
                                            )}
                                        </span>
                                    </div>
                                </div>

                                {/* Connected Animated Waveform */}
                                {callStatus === "connected" && (
                                    <div className="flex items-center gap-0.5 h-4 pr-1">
                                        {[0.4, 0.9, 0.5, 1.0, 0.6].map((h, i) => (
                                            <span
                                                key={i}
                                                className={`w-0.5 rounded-full transition-all duration-200 ${
                                                    isMuted ? "bg-slate-600 h-1.5" : "bg-emerald-400 animate-pulse"
                                                }`}
                                                style={{ height: isMuted ? "4px" : `${Math.max(4, h * 16)}px` }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Inbound Ringing Actions (Accept / Decline) */}
                            {callStatus === "ringing_inbound" && (
                                <div className="flex items-center gap-2 pt-1 pb-1">
                                    <button
                                        type="button"
                                        onClick={acceptIncomingCall}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/30"
                                    >
                                        <IconPhone className="h-4 w-4" />
                                        Accept
                                    </button>
                                    <button
                                        type="button"
                                        onClick={rejectIncomingCall}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 transition shadow-lg shadow-rose-600/30"
                                    >
                                        <IconPhoneHangup className="h-4 w-4" />
                                        Decline
                                    </button>
                                </div>
                            )}

                            {/* DTMF Keypad (inline drawer) */}
                            {isKeypadOpen && callStatus === "connected" && (
                                <div className="mb-2 grid grid-cols-3 gap-1 p-2 bg-slate-950/80 rounded-xl border border-slate-800">
                                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((d) => (
                                        <button
                                            key={d}
                                            type="button"
                                            onClick={() => sendDigits(d)}
                                            className="h-7 rounded-lg bg-slate-800 text-xs font-bold text-slate-200 hover:bg-slate-700 active:bg-indigo-600 transition"
                                        >
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Error with Phone Bridge Shortcut */}
                            {callStatus === "error" && (
                                <div className="mb-2 p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300">
                                    <p className="truncate">{errorMessage || "Call failed."}</p>
                                    <button
                                        type="button"
                                        onClick={triggerPhoneBridge}
                                        disabled={isBridgeFallbackLoading}
                                        className="mt-1.5 w-full flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-1 text-[11px] font-semibold text-white hover:bg-indigo-500 transition"
                                    >
                                        <IconPhoneOutgoing className="h-3 w-3" />
                                        {isBridgeFallbackLoading ? "Connecting..." : "Bridge Call via My Phone"}
                                    </button>
                                </div>
                            )}

                            {/* Card Bottom Actions (when not ringing inbound) */}
                            {callStatus !== "ringing_inbound" && (
                                <div className="flex items-center gap-1.5 pt-1">
                                    {callStatus === "connected" && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={toggleMute}
                                                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-medium transition ${
                                                    isMuted
                                                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                                }`}
                                                title={isMuted ? "Unmute microphone" : "Mute microphone"}
                                            >
                                                {isMuted ? (
                                                    <IconMicrophoneSlash className="h-3.5 w-3.5" />
                                                ) : (
                                                    <IconMicrophone className="h-3.5 w-3.5" />
                                                )}
                                                {isMuted ? "Muted" : "Mute"}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setIsKeypadOpen((prev) => !prev)}
                                                className={`p-1.5 rounded-xl text-xs transition ${
                                                    isKeypadOpen
                                                        ? "bg-indigo-600 text-white"
                                                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                                }`}
                                                title="Keypad"
                                            >
                                                <IconKeypad className="h-3.5 w-3.5" />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={toggleCallRecording}
                                                disabled={isRecordingLoading}
                                                className={`p-1.5 rounded-xl text-xs transition flex items-center justify-center ${
                                                    isRecording
                                                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                                }`}
                                                title={isRecording ? "Stop call recording" : "Record call"}
                                            >
                                                <span
                                                    className={`h-2.5 w-2.5 rounded-full ${
                                                        isRecording ? "bg-rose-500 animate-pulse" : "bg-slate-400"
                                                    }`}
                                                />
                                            </button>
                                        </>
                                    )}

                                    {callStatus !== "disconnected" && callStatus !== "error" ? (
                                        <button
                                            type="button"
                                            onClick={hangUp}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 transition shadow-lg shadow-rose-600/30"
                                        >
                                            <IconPhoneHangup className="h-3.5 w-3.5" />
                                            End Call
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={closeCallModal}
                                            className="w-full py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition"
                                        >
                                            Dismiss
                                        </button>
                                    )}
                                </div>
                            )}
                        </aside>
                    )}
                </>
            )}
        </WebRTCCallContext.Provider>
    );
}

export function useWebRTCCall() {
    const context = useContext(WebRTCCallContext);
    if (!context) {
        throw new Error("useWebRTCCall must be used within a WebRTCCallProvider");
    }
    return context;
}
