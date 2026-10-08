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
- `GET /firebase/protected` verifies the `X-Firebase-AppCheck` header and returns the verified Firebase App ID. Requests without a valid App Check token return `401`.

Opening `/firebase/protected` directly in a browser or calling it without a header is expected to return `{"error":"Missing Firebase App Check token"}`. The token must be minted by the Firebase client SDK. Configure the web app's reCAPTCHA Enterprise site key as `VITE_FIREBASE_APPCHECK_SITE_KEY`; the frontend then sends the token in the required header.

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
