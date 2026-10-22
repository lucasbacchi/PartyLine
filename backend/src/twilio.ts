import twilio, { type Twilio } from "twilio";

type TwilioConfig = {
    accountSid: string;
    apiKeySid: string;
    apiKeySecret: string;
};

function getRequiredEnvironmentVariable(name: string): string {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(`Missing required Twilio environment variable: ${name}`);
    }

    return value;
}

export function getTwilioConfig(): TwilioConfig {
    return {
        accountSid: getRequiredEnvironmentVariable("TWILIO_ACCOUNT_SID"),
        apiKeySid: getRequiredEnvironmentVariable("TWILIO_API_KEY_SID"),
        apiKeySecret: getRequiredEnvironmentVariable("TWILIO_API_KEY_SECRET")
    };
}

export function getTwilioClient(): Twilio {
    const config = getTwilioConfig();
    return twilio(config.apiKeySid, config.apiKeySecret, { accountSid: config.accountSid });
}

export function getTwilioWebhookAuthToken(): string {
    return getRequiredEnvironmentVariable("TWILIO_AUTH_TOKEN");
}

export function validateTwilioPhoneNumber(value: unknown, fieldName: string): string {
    if (typeof value !== "string" || !/^\+[1-9]\d{7,14}$/.test(value.trim())) {
        throw new Error(`${fieldName} must be an E.164 phone number, such as +15551234567.`);
    }

    return value.trim();
}

export async function checkTwilioServices(): Promise<Record<string, "ok" | "error">> {
    let configStatus: "ok" | "error" = "ok";

    try {
        getTwilioConfig();
        getTwilioWebhookAuthToken();
    } catch {
        configStatus = "error";
    }

    if (configStatus === "error") {
        return {
            config: configStatus,
            api: "error"
        };
    }

    try {
        await getTwilioClient().incomingPhoneNumbers.list({ limit: 1 });
        return {
            config: "ok",
            api: "ok"
        };
    } catch (error) {
        console.error("Twilio API health check failed", error);
        return {
            config: "ok",
            api: "error"
        };
    }
}
