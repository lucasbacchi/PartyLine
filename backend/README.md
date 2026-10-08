# PartyLine Phone System Backend

This is the Express API for the PartyLine Phone System. It is packaged as a Cloud Run service and uses the Firebase Admin SDK for server-side Authentication, Firestore, Storage, and App Check.

## Local development

```powershell
npm install
npm run dev
```

The service listens on `http://localhost:8080` by default. Copy `.env.example` to `.env` for local development. The backend loads that file automatically; the Firebase emulator variables are only needed when using the Firebase emulators.

## Twilio setup

The backend is prepared to use Twilio's Node.js SDK with an API key. In the Twilio Console:

1. Open **Account > API keys & tokens**.
2. Create a **Standard** API key and copy the key SID and secret. The secret is shown only once.
3. Copy the Account SID and Auth Token from the Twilio Console.
4. Add the Account SID, API key SID, API key secret, and Auth Token to your local `backend/.env` using the names in `.env.example`. Do not add an individual phone number; numbers are tenant/location data.

The Twilio client is exposed by `src/twilio.ts` for future SMS and voice routes. It is initialized only when `getTwilioClient()` is called, so local development and Firebase health checks continue to work before Twilio credentials are configured. `getTwilioWebhookAuthToken()` provides the credential needed to validate signatures on inbound webhooks.

All purchased Twilio numbers should point to the same backend webhook paths. Incoming webhook `To` values will be normalized and used to look up the owning location in Firestore; the backend must never select a tenant from a client-provided Firebase user ID.

The initial webhook endpoints are:

- `POST /twilio/webhooks/voice` returns a basic TwiML voice response.
- `POST /twilio/webhooks/sms` returns a basic TwiML SMS response.
- `GET /twilio/health` verifies that the Twilio credentials are configured and that the API key can access the account's phone-number resources.

Both endpoints validate `X-Twilio-Signature`. Set `PUBLIC_BASE_URL` to the exact public URL Twilio calls (for example, `https://api.example.com`) when using Cloud Run or a tunnel. When testing directly on `localhost`, leave it as `http://localhost:8080` and use that URL in the Twilio Console only if Twilio can reach it through a tunnel.

The backend does not globally trust forwarded client IP headers. This keeps IP-based rate limiting effective; `PUBLIC_BASE_URL` is used for Twilio signature URL construction instead of trusting proxy headers.

Do not commit `.env` or place any Twilio secret in `deploy.ps1`. For Cloud Run, provide the four `TWILIO_*` values through Secret Manager-backed environment variables instead of storing them in source control or passing them as command-line arguments.

## Firebase connection endpoints

- `GET /firebase/health` checks server-side access to Firebase Authentication, Firestore, and Storage. It returns `200` when all three checks pass and `503` when one or more checks fail.
- `GET /firebase/protected` uses middleware to verify both the `X-Firebase-AppCheck` header and the Firebase ID token from the `Authorization: Bearer <token>` header. Requests without valid tokens return `401`.

Opening `/firebase/protected` directly in a browser or calling it without both headers is expected to return `401`. App Check tokens must be minted by the Firebase client SDK, and Firebase ID tokens must come from a signed-in user. Configure the web app's reCAPTCHA Enterprise site key as `VITE_FIREBASE_APPCHECK_SITE_KEY`; the frontend then sends both tokens in the required headers.

New application routes should be added to the protected router in `src/index.ts` so they inherit both checks. Keep liveness and health endpoints outside that router.

The protected router also applies an in-memory Express rate limit of 120 requests per authenticated user per minute. Public Firebase diagnostics are limited to 60 requests per IP per minute, while the liveness endpoint remains unrestricted for Cloud Run health checks. Use the exported `writeRateLimit` middleware for mutation routes; it allows 30 requests per authenticated user per minute.

These limits are per Cloud Run instance. They provide basic protection, but a shared store or an upstream control such as Cloud Armor should be added before relying on them for a multi-instance production deployment.

Cloud Run uses Application Default Credentials for the Admin SDK. Do not add a service-account key file to the repository. Set `FIREBASE_STORAGE_BUCKET` when the Storage bucket cannot be inferred from the runtime project.

## Deploy to Cloud Run

Prerequisites:

- Google Cloud CLI installed
- `gcloud auth login` completed
- Billing enabled for the Google Cloud project
- Cloud Run, Cloud Build, and Artifact Registry APIs enabled

From this directory:

```powershell
npm run deploy
```

The script defaults to the existing Firebase project, `partyline-phone-system`, and the `party-line-api` service. Override the project or service with parameters or environment variables:

```powershell
.\deploy.ps1 -Project my-project -Service my-api
```

The Cloud Run service account must have access to the Firebase resources it uses. Grant only the roles required by the API, such as ` roles/datastore.user` for Firestore access. Do not deploy a service-account key file; Firebase Admin uses Cloud Run Application Default Credentials.
