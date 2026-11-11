import { useSyncExternalStore } from "react";
import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  type User as FbUser,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { fb } from "./firebase";
import { emptyRide, emptyUser, getState, setLocalUser, setState, type DriverInfo, type Role, type User } from "./move-store";

export type AuthStatus = "loading" | "signed-out" | "signed-in";

let status: AuthStatus = "loading";
const listeners = new Set<() => void>();
const setStatus = (s: AuthStatus) => {
  status = s;
  listeners.forEach((l) => l());
};

export function useAuthStatus() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
    () => "loading" as AuthStatus,
  );
}

function profileFrom(uid: string, d: Record<string, unknown>, u: FbUser): User {
  const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
  return {
    id: uid,
    name: str(d["name"], u.displayName ?? ""),
    email: str(d["email"], u.email ?? ""),
    phone: str(d["phone"], u.phoneNumber ?? ""),
    role: d["role"] === "driver" || d["role"] === "passenger" ? (d["role"] as Role) : null,
    photo: typeof d["photo"] === "string" && d["photo"] ? (d["photo"] as string) : null,
    driver: d["driver"] && typeof d["driver"] === "object" ? (d["driver"] as DriverInfo) : null,
    online: d["online"] === true,
  };
}

let started = false;
let unsubProfile: (() => void) | undefined;

/** Starts listening for sign-in changes and keeps the profile in sync with the database. Call once in the browser. */
export function startSession() {
  if (started || typeof window === "undefined") return;
  started = true;
  const { auth, db } = fb();
  onAuthStateChanged(auth, async (u) => {
    unsubProfile?.();
    unsubProfile = undefined;
    if (!u) {
      setState((s) => ({ ...s, user: emptyUser, ride: emptyRide(s.ride.pickup) }));
      setStatus("signed-out");
      return;
    }
    // A different account on this device starts with a clean slate.
    if (getState().user.id && getState().user.id !== u.uid) setState((s) => ({ ...s, ride: emptyRide(s.ride.pickup) }));
    const ref = doc(db, "users", u.uid);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          name: u.displayName ?? "",
          email: u.email ?? "",
          phone: u.phoneNumber ?? "",
          photo: u.photoURL ?? null,
          role: null,
          driver: null,
          online: false,
          createdAt: Date.now(),
        });
      }
    } catch (e) {
      console.error("Couldn't load your profile", e);
    }
    let first = true;
    unsubProfile = onSnapshot(
      ref,
      (s) => {
        setLocalUser(profileFrom(u.uid, s.data() ?? {}, u));
        if (first) {
          first = false;
          setStatus("signed-in");
        }
      },
      (e) => {
        console.error("Profile sync failed", e);
        setLocalUser(profileFrom(u.uid, {}, u));
        setStatus("signed-in");
      },
    );
  });
}

/** Saves profile fields to the signed-in account (and shows them right away). */
export async function saveProfile(patch: Partial<Omit<User, "id">>) {
  setLocalUser(patch);
  const u = fb().auth.currentUser;
  if (!u) return;
  await setDoc(doc(fb().db, "users", u.uid), patch, { merge: true });
}

/** First screen a signed-in person still has to fill in. */
export function nextPath(user: User): "/name" | "/role" | "/home" {
  if (!user.name) return "/name";
  if (!user.role) return "/role";
  return "/home";
}

export async function signInWith(provider: "google" | "apple") {
  const { auth } = fb();
  if (provider === "google") {
    const p = new GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, p);
  } else {
    const p = new OAuthProvider("apple.com");
    p.addScope("email");
    p.addScope("name");
    await signInWithPopup(auth, p);
  }
}

export async function emailSignIn(email: string, password: string) {
  await signInWithEmailAndPassword(fb().auth, email.trim(), password);
}

export async function emailSignUp(email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(fb().auth, email.trim(), password);
  void sendEmailVerification(cred.user).catch(() => undefined);
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(fb().auth, email.trim());
}

export async function signOut() {
  const { user } = getState();
  if (user.role === "driver" && user.online) await saveProfile({ online: false }).catch(() => undefined);
  await fbSignOut(fb().auth);
}

/** Current sign-in token, for server calls that must know who's asking. */
export async function idToken() {
  const u = fb().auth.currentUser;
  if (!u) throw new Error("Please sign in first");
  return u.getIdToken();
}

/** Plain-language message for a Firebase sign-in error. */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-login-credentials":
      return "That email and password don't match. Try again or reset your password.";
    case "auth/email-already-in-use":
      return "There's already an account with this email. Sign in instead.";
    case "auth/weak-password":
      return "Use a password with at least 6 characters.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many tries. Wait a moment and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in window. Allow pop-ups and try again.";
    case "auth/unauthorized-domain":
      return `Sign-in isn't allowed on ${typeof window === "undefined" ? "this address" : window.location.hostname} yet. Add it under Authorized domains in Firebase.`;
    case "auth/operation-not-allowed":
      return "This sign-in option isn't switched on in Firebase yet.";
    case "auth/network-request-failed":
      return "No connection. Check your internet and try again.";
    default:
      return "Something went wrong signing in. Please try again.";
  }
}
