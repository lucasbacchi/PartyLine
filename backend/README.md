# PartyLine Phone System Backend

This is the Express API for the PartyLine Phone System. It is packaged as a Cloud Run service and uses the Firebase Admin SDK for server-side Authentication, Firestore, Storage, and App Check.

## Local development

```powershell
npm install
npm run dev
```

The service listens on `http://localhost:8080` by default. Copy `.env.example` to `.env` when using the Firebase emulators.

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
