import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let cached: Firestore | null = null;

function resolveCredential() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    try {
      return cert(JSON.parse(json));
    } catch (error) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Copy the whole " +
          "private key file contents, or set FIREBASE_PROJECT_ID, " +
          "FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY instead.",
        { cause: error },
      );
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  // Vercel and other hosts store newlines escaped in env vars.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

  if (projectId && clientEmail && privateKey) {
    return cert({ projectId, clientEmail, privateKey });
  }

  // Fall back to Application Default Credentials, which covers `firebase emulators`
  // and Google-hosted runtimes.
  return undefined;
}

export function getDb(): Firestore {
  if (cached) return cached;

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !process.env.FIREBASE_PROJECT_ID) {
    throw new Error(
      "Firebase is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON (or " +
        "FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY) " +
        "in .env.local. For offline UI work set FIREBASE_USE_LOCAL_STORE=1 instead.",
    );
  }

  const app: App =
    getApps()[0] ??
    initializeApp({
      credential: resolveCredential(),
      projectId: process.env.FIREBASE_PROJECT_ID?.trim() || undefined,
    });

  cached = getFirestore(app);
  return cached;
}
