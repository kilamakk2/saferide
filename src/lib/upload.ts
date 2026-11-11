import { createUploadUrl } from "./uploads.functions";
import { idToken } from "./session";

/** Uploads an image to the R2 storage and returns its public web address. */
export async function uploadImage(blob: Blob, filename: string, folder: "avatars" = "avatars") {
  const contentType = (["image/jpeg", "image/png", "image/webp"] as const).find((t) => t === blob.type) ?? "image/jpeg";
  const { url, publicUrl } = await createUploadUrl({
    data: { idToken: await idToken(), filename, contentType, size: blob.size, folder },
  });
  const put = await fetch(url, { method: "PUT", headers: { "content-type": contentType }, body: blob });
  if (!put.ok) throw new Error("The photo didn't finish uploading. Try again.");
  return publicUrl;
}
