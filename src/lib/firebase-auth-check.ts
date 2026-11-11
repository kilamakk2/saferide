import { firebaseConfig } from "./firebase-config";

const ok = new Map<string, { uid: string; until: number }>();

/**
 * Server-side: confirm a Firebase ID token belongs to a real signed-in user.
 * Answers are remembered for 5 minutes so live map updates don't re-check every call.
 */
export async function verifyFirebaseUser(idToken: string): Promise<string> {
  const now = Date.now();
  const hit = ok.get(idToken);
  if (hit && hit.until > now) return hit.uid;
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const uid = res.ok ? ((await res.json()) as { users?: { localId?: string }[] }).users?.[0]?.localId : undefined;
  if (!uid) throw new Error("Please sign in again");
  if (ok.size > 500) ok.clear();
  ok.set(idToken, { uid, until: now + 5 * 60_000 });
  return uid;
}
