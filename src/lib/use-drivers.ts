import { useEffect, useState } from "react";
import { listenOnlineDrivers, type OnlineDriver } from "./rides";
import { isOnline } from "./ride-logic";

/** Drivers who are online right now (null until the first answer arrives). */
export function useOnlineDrivers(enabled = true) {
  const [all, setAll] = useState<OnlineDriver[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const off = listenOnlineDrivers(setAll);
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      off();
      clearInterval(t);
    };
  }, [enabled]);
  return all ? all.filter((d) => isOnline(d, now)) : null;
}
