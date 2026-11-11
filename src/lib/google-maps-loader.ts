/** Loads the Google Maps JavaScript API once, in the browser only. */
let loader: Promise<typeof google.maps> | null = null;
const listeners = new Set<() => void>();

/** Called by Google when the browser key is rejected (wrong domain, disabled key). */
export function onMapsAuthFailure(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (loader) return loader;
  loader = new Promise<typeof google.maps>((resolve, reject) => {
    const w = window as unknown as Record<string, unknown> & { google?: typeof google };
    if (w.google?.maps?.Map) return resolve(w.google.maps);
    const env = import.meta.env as Record<string, string | undefined>;
    const key = env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
    const channel = env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] ?? "";
    if (!key) return reject(new Error("Google Maps browser key is not configured"));
    w["__moveMapsReady"] = () => resolve(w.google!.maps);
    w["gm_authFailure"] = () => listeners.forEach((l) => l());
    const s = document.createElement("script");
    const qs = new URLSearchParams({ key, loading: "async", callback: "__moveMapsReady", channel, language: "en", region: "UG", v: "weekly" });
    s.src = `https://maps.googleapis.com/maps/api/js?${qs.toString()}`;
    s.async = true;
    s.onerror = () => {
      loader = null;
      s.remove();
      reject(new Error("Google Maps failed to load"));
    };
    document.head.appendChild(s);
  });
  return loader;
}
