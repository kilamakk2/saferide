import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { UPLOAD_BASE, firebaseConfig } from "./firebase-config";

const input = z.object({
  idToken: z.string().min(20).max(5000),
  filename: z.string().min(1).max(120),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().positive().max(8_000_000),
  folder: z.enum(["avatars"]),
});

/**
 * Hands a signed-in user a one-time upload link from the R2 upload worker.
 * The worker token never leaves the server.
 */
export const createUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }) => {
    const who = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: data.idToken }),
    });
    const uid = who.ok ? ((await who.json()) as { users?: { localId?: string }[] }).users?.[0]?.localId : undefined;
    if (!uid) throw new Error("Please sign in again to upload a photo");

    const token = process.env["R2_UPLOAD_TOKEN"];
    if (!token) throw new Error("Uploads aren't set up yet");
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const res = await fetch(`${UPLOAD_BASE}/uploads/single`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ filename: `${uid}-${safe}`, contentType: data.contentType, size: data.size, folder: data.folder }),
    });
    if (!res.ok) {
      console.error("Upload worker refused", res.status, await res.text().catch(() => ""));
      throw new Error("The upload service didn't accept the photo. Try again.");
    }
    const out = (await res.json()) as { url?: string; publicUrl?: string };
    if (!out.url || !out.publicUrl) throw new Error("The upload service sent an unexpected reply");
    return { url: out.url, publicUrl: out.publicUrl };
  });
