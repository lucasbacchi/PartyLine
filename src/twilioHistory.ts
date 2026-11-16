import type { User } from "firebase/auth";
import { getFirebaseAppCheckToken } from "./firebase";

export type TwilioCallHistoryItem = {
    sid: string;
    from: string;
    to: string;
    status: string;
    direction: string;
    duration: number | null;
    createdAt: string | null;
    startedAt: string | null;
};

export type TwilioTextHistoryItem = {
    sid: string;
    from: string;
    to: string;
    body: string;
    status: string;
    direction: string;
    createdAt: string | null;
    sentAt: string | null;
};

type HistoryResponse = {
    calls?: TwilioCallHistoryItem[];
    messages?: TwilioTextHistoryItem[];
    error?: string;
};

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

async function requestHistory(
    user: User,
    tenantId: string,
    resource: "calls" | "texts",
    signal?: AbortSignal
): Promise<HistoryResponse> {
    const [appCheckToken, idToken] = await Promise.all([getFirebaseAppCheckToken(), user.getIdToken()]);
    const response = await fetch(`${apiUrl}/api/tenants/${encodeURIComponent(tenantId)}/${resource}?limit=50`, {
        headers: {
            Authorization: `Bearer ${idToken}`,
            "X-Firebase-AppCheck": appCheckToken
        },
        signal
    });
    const body = (await response.json()) as HistoryResponse;
    if (!response.ok) {
        throw new Error(body.error ?? `Unable to load ${resource} from Twilio.`);
    }
    return body;
}

export async function fetchTwilioCalls(
    user: User,
    tenantId: string,
    signal?: AbortSignal
): Promise<TwilioCallHistoryItem[]> {
    const body = await requestHistory(user, tenantId, "calls", signal);
    if (!Array.isArray(body.calls)) throw new Error("The call history response was invalid.");
    return body.calls;
}

export async function fetchTwilioTexts(
    user: User,
    tenantId: string,
    signal?: AbortSignal
): Promise<TwilioTextHistoryItem[]> {
    const body = await requestHistory(user, tenantId, "texts", signal);
    if (!Array.isArray(body.messages)) throw new Error("The text history response was invalid.");
    return body.messages;
}

export async function sendTwilioText(
    user: User,
    tenantId: string,
    to: string,
    bodyText: string
): Promise<TwilioTextHistoryItem> {
    const [appCheckToken, idToken] = await Promise.all([getFirebaseAppCheckToken(), user.getIdToken()]);
    const response = await fetch(`${apiUrl}/api/tenants/${encodeURIComponent(tenantId)}/texts`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
            "X-Firebase-AppCheck": appCheckToken
        },
        body: JSON.stringify({ to, body: bodyText })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error ?? "Failed to send text message.");
    }
    return data.message as TwilioTextHistoryItem;
}

export async function initiateTwilioCall(
    user: User,
    tenantId: string,
    to: string,
    memberPhone?: string
): Promise<{ sid: string; status: string }> {
    const [appCheckToken, idToken] = await Promise.all([getFirebaseAppCheckToken(), user.getIdToken()]);
    const response = await fetch(`${apiUrl}/api/tenants/${encodeURIComponent(tenantId)}/calls`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
            "X-Firebase-AppCheck": appCheckToken
        },
        body: JSON.stringify({ to, memberPhone })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error ?? "Failed to initiate call back.");
    }
    return data.call;
}

export function formatHistoryTimestamp(value: string | null): string {
    if (!value) return "Date unavailable";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}
