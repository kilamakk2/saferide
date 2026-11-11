import { toast } from "sonner";
import { setState } from "./move-store";

/**
 * Ride alerts for passengers and drivers.
 * In the app: a banner, a short chime and a buzz. In the background: a phone notification
 * (through the service worker, which Android Chrome needs), as long as the app is still open in a tab.
 */

let reg: Promise<ServiceWorkerRegistration | null> | null = null;

/** Register the small notification service worker once (browser only, never fatal). */
export function registerNotifier() {
  if (reg || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  reg = navigator.serviceWorker.register("/sw.js").catch((e: unknown) => {
    console.warn("Notifications worker not available", e);
    return null;
  });
}

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;
export const notificationsAllowed = () => notificationsSupported() && Notification.permission === "granted";

/** Ask for permission (call from a tap). Returns true when allowed. */
export async function askNotifications() {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      /* old Safari */
    }
  }
  const on = Notification.permission === "granted";
  setState((s) => ({ ...s, permissions: { ...s.permissions, notifications: on } }));
  if (on) registerNotifier();
  return on;
}

let audio: AudioContext | null = null;
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    const t = audio.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = audio!.createOscillator();
      const g = audio!.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.25);
      o.connect(g).connect(audio!.destination);
      o.start(t + i * 0.18);
      o.stop(t + i * 0.18 + 0.3);
    });
  } catch {
    /* sound is a nice-to-have */
  }
}

const recent = new Map<string, number>();

/** Alert the user. `tag` stops the same alert firing twice within a minute. */
export async function notify(title: string, body: string, tag?: string) {
  if (typeof window === "undefined") return;
  if (tag) {
    const at = recent.get(tag);
    if (at && Date.now() - at < 60_000) return;
    recent.set(tag, Date.now());
  }
  chime();
  try {
    navigator.vibrate?.([180, 80, 180]);
  } catch {
    /* not supported */
  }
  if (document.visibilityState === "visible") {
    toast(title, { description: body });
    return;
  }
  if (!notificationsAllowed()) return;
  const options: NotificationOptions = { body, icon: "/favicon.ico", badge: "/favicon.ico", ...(tag ? { tag } : {}) };
  try {
    registerNotifier();
    const r = await reg;
    if (r) {
      await r.showNotification(title, options);
      return;
    }
    new Notification(title, options);
  } catch (e) {
    console.warn("Couldn't show notification", e);
  }
}
