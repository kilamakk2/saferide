import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config";

let cache: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null;

/** Firebase app, auth and Firestore — browser only, created on first use. */
export function fb() {
  if (typeof window === "undefined") throw new Error("Firebase is only available in the browser");
  if (!cache) {
    const existing = getApps()[0];
    const app = existing ?? initializeApp(firebaseConfig);
    const db = existing ? getFirestore(app) : initializeFirestore(app, { ignoreUndefinedProperties: true });
    cache = { app, auth: getAuth(app), db };
    void import("firebase/analytics")
      .then(async (m) => {
        if (await m.isSupported()) m.getAnalytics(app);
      })
      .catch(() => undefined);
  }
  return cache;
}
