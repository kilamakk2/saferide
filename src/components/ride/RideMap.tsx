import { ChevronRight, Layers, Navigation, PersonStanding } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  bearing,
  distanceM,
  lngLat,
  nextStep,
  offsetPoint,
  remainingOn,
  trimRoute,
  alongRoute,
  type LngLat,
  type Place,
  type Route,
  type RouteStep,
} from "@/lib/geo";
import { loadGoogleMaps, onMapsAuthFailure } from "@/lib/google-maps-loader";
import { getRoute } from "@/lib/maps";
import { vehicleById, type VehicleId } from "@/lib/move-data";
import { cn } from "@/lib/utils";

/**
 * idle: around the pickup · preview: the trip line before booking ·
 * arriving: driver coming to the pickup · here: driver at the pickup ·
 * tracking: on the way to the dropoff · pick: choosing a spot under the centre pin.
 */
export type MapMode = "idle" | "preview" | "arriving" | "here" | "tracking" | "pick";
type G = typeof google.maps;

/** Google paints lines itself, so route colours are hex mirrors of the --primary / --ink / --card tokens. */
const ROUTE_COLOR = "#16884f";
const APPROACH_COLOR = "#1f2326";
const CASING_COLOR = "#ffffff";

/** Live trip numbers worked out from the real route and the driver's real position. */
export interface LiveInfo {
  target: "pickup" | "dropoff";
  /** Metres and seconds still to go. */
  distance: number;
  duration: number;
  /** The next turn, when Google gave turn-by-turn steps. */
  next: { step: RouteStep; in: number } | null;
  /** False when no road route was found (straight-line estimate). */
  real: boolean;
}

interface Props {
  mode: MapMode;
  pickup: Place;
  dropoff?: Place | null | undefined;
  /** Height of whatever covers the bottom of the map (sheet), in px. */
  sheetHeight: number;
  /** Space covered at the top (status bar, route pill), in px. */
  topInset?: number;
  /** Where the map starts in "pick" mode. */
  pickStart?: LngLat | undefined;
  onPickupClick?: () => void;
  /** Label above the pickup pin (defaults to "Pickup"). */
  pickupLabel?: string | undefined;
  /** Online drivers to show in "idle" mode, at their real positions. */
  drivers?: { id: string; at: LngLat; vehicle: VehicleId }[] | undefined;
  /** Live position of the assigned driver (arriving / here / tracking). */
  driverAt?: LngLat | null | undefined;
  /** The assigned driver's vehicle type. */
  vehicle?: VehicleId | undefined;
  /** This phone's live position (blue dot). */
  meAt?: LngLat | null | undefined;
  /** Live passenger position, shown to the driver. */
  passengerAt?: LngLat | null | undefined;
  /** Keep the camera on the driver while they drive (until the map is dragged). */
  follow?: boolean | undefined;
  /** Remaining distance/time and the next turn, whenever they change. */
  onLive?: ((info: LiveInfo | null) => void) | undefined;
  /** "pick" mode: the coordinate under the centre pin after the map stops moving. */
  onCenter?: ((at: LngLat) => void) | undefined;
}

/** Builds an HTML overlay class once Google's library has loaded. */
function makeOverlay(g: G) {
  return class HtmlOverlay extends g.OverlayView {
    pos: google.maps.LatLng;
    div: HTMLDivElement;
    anchor: "center" | "bottom" | "top";
    offset: [number, number];
    rotation = 0;
    constructor(div: HTMLDivElement, at: LngLat, anchor: "center" | "bottom" | "top", offset: [number, number]) {
      super();
      this.div = div;
      this.pos = new g.LatLng(at[1], at[0]);
      this.anchor = anchor;
      this.offset = offset;
      div.style.position = "absolute";
      g.OverlayView.preventMapHitsAndGesturesFrom(div);
    }
    override onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(this.div);
    }
    override draw() {
      const pt = this.getProjection()?.fromLatLngToDivPixel(this.pos);
      if (!pt) return;
      const ty = this.anchor === "bottom" ? "-100%" : this.anchor === "top" ? "0%" : "-50%";
      this.div.style.left = `${pt.x + this.offset[0]}px`;
      this.div.style.top = `${pt.y + this.offset[1]}px`;
      this.div.style.transform = `translate(-50%, ${ty})${this.rotation ? ` rotate(${this.rotation}deg)` : ""}`;
    }
    override onRemove() {
      this.div.remove();
    }
    moveTo(at: LngLat, rotation = this.rotation) {
      this.pos = new g.LatLng(at[1], at[0]);
      this.rotation = rotation;
      this.draw();
    }
  };
}
type Overlay = InstanceType<ReturnType<typeof makeOverlay>>;
interface MapCtx {
  map: google.maps.Map;
  g: G;
  Overlay: ReturnType<typeof makeOverlay>;
}

const Ctx = createContext<MapCtx | null>(null);

/** A DOM marker whose content is rendered by React through a portal. */
function MapMarker({
  at,
  anchor = "center",
  offset = [0, 0],
  children,
}: {
  at: LngLat;
  anchor?: "center" | "bottom" | "top";
  offset?: [number, number];
  children: ReactNode;
}) {
  const ctx = useContext(Ctx);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const marker = useRef<Overlay | null>(null);

  useEffect(() => {
    if (!ctx) return;
    const div = document.createElement("div");
    const m = new ctx.Overlay(div, at, anchor, offset);
    m.setMap(ctx.map);
    marker.current = m;
    setEl(div);
    return () => {
      m.setMap(null);
      marker.current = null;
    };
    // Recreate only when the map, anchor or offset changes; position updates below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, anchor, offset[0], offset[1]]);

  useEffect(() => {
    marker.current?.moveTo(at);
  }, [at[0], at[1]]);

  return el ? createPortal(children, el) : null;
}

/** A vehicle seen from above at its real position; glides smoothly between GPS updates and turns to face its direction. */
function LiveVehicle({ at, vehicle }: { at: LngLat; vehicle: VehicleId }) {
  const ctx = useContext(Ctx);
  const marker = useRef<Overlay | null>(null);
  const cur = useRef<{ at: LngLat; heading: number }>({ at, heading: 0 });
  const raf = useRef(0);

  useEffect(() => {
    if (!ctx) return;
    const v = vehicleById(vehicle);
    const div = document.createElement("div");
    const img = document.createElement("img");
    img.src = v.mapIcon;
    img.alt = v.name;
    img.style.width = `${v.mapWidth}px`;
    img.style.filter = "drop-shadow(0 2px 2px rgb(0 0 0 / 0.3))";
    div.appendChild(img);
    const m = new ctx.Overlay(div, cur.current.at, "center", [0, 0]);
    m.rotation = cur.current.heading;
    m.setMap(ctx.map);
    marker.current = m;
    return () => {
      cancelAnimationFrame(raf.current);
      m.setMap(null);
      marker.current = null;
    };
  }, [ctx, vehicle]);

  useEffect(() => {
    const m = marker.current;
    const from = cur.current.at;
    const d = distanceM(from, at);
    const heading = d > 3 ? bearing(from, at) : cur.current.heading;
    if (!m || d > 3000) {
      cur.current = { at, heading };
      m?.moveTo(at, heading);
      return;
    }
    if (d < 0.5) return;
    cancelAnimationFrame(raf.current);
    const t0 = performance.now();
    const dur = Math.min(2500, 400 + d * 25);
    const tick = (now: number) => {
      const f = Math.min(1, (now - t0) / dur);
      const p: LngLat = [from[0] + (at[0] - from[0]) * f, from[1] + (at[1] - from[1]) * f];
      cur.current = { at: p, heading };
      m.moveTo(p, heading);
      if (f < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at[0], at[1], ctx]);

  return null;
}

/**
 * A road route from a moving point to a target, refreshed only when needed:
 * first time, when the vehicle leaves the line by 80 m, or every 2 minutes after 150 m of driving
 * (never more than every 15 s), so the paid route lookups stay low.
 */
function useLiveRoute(from: LngLat | null | undefined, to: LngLat | null, enabled: boolean) {
  const [route, setRoute] = useState<Route | null>(null);
  const routeRef = useRef<Route | null>(null);
  routeRef.current = route;
  const last = useRef<{ from: LngLat; time: number } | null>(null);
  const busy = useRef(false);
  const toKey = to && enabled ? `${to[0].toFixed(5)},${to[1].toFixed(5)}` : "";

  useEffect(() => {
    setRoute(null);
    last.current = null;
  }, [toKey]);

  useEffect(() => {
    if (!toKey || !from || !to || busy.current) return;
    const prev = last.current;
    const now = Date.now();
    const r = routeRef.current;
    const off = r ? alongRoute(r.coords, from).off : Infinity;
    const need = !prev || (now - prev.time > 15_000 && (off > 80 || (now - prev.time > 120_000 && distanceM(prev.from, from) > 150)));
    if (!need) return;
    busy.current = true;
    last.current = { from, time: now };
    const key = toKey;
    void getRoute(from, to)
      .then((res) => {
        if (key === toKeyRef.current) setRoute(res);
      })
      .finally(() => {
        busy.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toKey, from?.[0], from?.[1]]);
  const toKeyRef = useRef(toKey);
  toKeyRef.current = toKey;

  return route;
}

function Label({ title, value, onClick, chevron = true }: { title: string; value: string; onClick?: (() => void) | undefined; chevron?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex max-w-[180px] items-center gap-2 rounded-md bg-card px-2 py-1 text-left text-foreground shadow-float"
    >
      <span className="min-w-0">
        <span className="block text-[8px] leading-tight text-muted-foreground">{title}</span>
        <span className="block truncate text-[11px] font-semibold leading-tight">{value}</span>
      </span>
      {chevron && <ChevronRight className="size-3 shrink-0 text-muted-foreground" />}
    </button>
  );
}

function PickupPin() {
  return (
    <div className="flex flex-col items-center">
      <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card shadow-float">
        <PersonStanding className="size-4" />
      </span>
      <span className="h-3 w-0.5 bg-primary" />
      <span className="relative flex size-3.5 items-center justify-center rounded-full bg-card ring-2 ring-primary">
        <span className="absolute inset-0 rounded-full bg-primary animate-pulse-ring" />
        <span className="size-1.5 rounded-full bg-primary" />
      </span>
    </div>
  );
}

function MeDot() {
  return (
    <span className="relative flex size-4 items-center justify-center">
      <span className="absolute inset-[-6px] rounded-full bg-locate/25 animate-pulse-ring" />
      <span className="size-4 rounded-full bg-locate ring-[3px] ring-card shadow-float" />
    </span>
  );
}

function PassengerPin() {
  return (
    <span className="flex size-7 items-center justify-center rounded-full bg-locate text-primary-foreground ring-2 ring-card shadow-float">
      <PersonStanding className="size-4" />
    </span>
  );
}

const toLatLng = (p: LngLat) => ({ lat: p[1], lng: p[0] });
/** Metres per screen pixel at a zoom level (Web Mercator). */
const mPerPx = (lat: number, zoom: number) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;

export function RideMap({
  mode,
  pickup,
  dropoff,
  sheetHeight,
  topInset = 48,
  pickStart,
  onPickupClick,
  pickupLabel,
  drivers = [],
  driverAt,
  vehicle = "boda",
  meAt,
  passengerAt,
  follow = false,
  onLive,
  onCenter,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const outer = useRef<HTMLDivElement>(null);
  const [ctx, setCtx] = useState<MapCtx | null>(null);
  const [failed, setFailed] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const [rootH, setRootH] = useState(800);
  const [trip, setTrip] = useState<Route | null>(null);
  const [dragged, setDragged] = useState(false);
  const lines = useRef<{ casing: google.maps.Polyline; route: google.maps.Polyline; approach: google.maps.Polyline } | null>(null);
  const probe = useRef<google.maps.OverlayView | null>(null);
  const centerRef = useRef(onCenter);
  centerRef.current = onCenter;
  const liveRef = useRef(onLive);
  liveRef.current = onLive;
  // The map stops where the sheet starts, so Google's logo and terms stay visible.
  const mapBottom = Math.max(0, Math.min(sheetHeight, rootH - 160));
  const mapH = rootH - mapBottom;
  const pickY = (topInset + mapH) / 2;
  const pickYRef = useRef(pickY);
  pickYRef.current = pickY;

  /* Create the map once, in the browser only. */
  useEffect(() => {
    let cancelled = false;
    const off = onMapsAuthFailure(() => setFailed(true));
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !box.current) return;
        const map = new g.Map(box.current, {
          center: toLatLng(lngLat(pickup)),
          zoom: 15,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          keyboardShortcuts: false,
          mapTypeId: "roadmap",
        });
        const casing = new g.Polyline({ map, path: [], strokeColor: CASING_COLOR, strokeWeight: 9, strokeOpacity: 1, zIndex: 1 });
        const route = new g.Polyline({ map, path: [], strokeColor: ROUTE_COLOR, strokeWeight: 5, strokeOpacity: 1, zIndex: 2 });
        const appr = new g.Polyline({
          map,
          path: [],
          strokeOpacity: 0,
          zIndex: 2,
          icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: APPROACH_COLOR, scale: 2.5 }, offset: "0", repeat: "9px" }],
        });
        lines.current = { casing, route, approach: appr };
        const p = new g.OverlayView();
        p.onAdd = () => undefined;
        p.draw = () => undefined;
        p.onRemove = () => undefined;
        p.setMap(map);
        probe.current = p;
        map.addListener("dragstart", () => setDragged(true));
        map.addListener("idle", () => {
          const cb = centerRef.current;
          const proj = probe.current?.getProjection();
          if (!cb || !proj || !box.current) return;
          const c = proj.fromContainerPixelToLatLng(new g.Point(box.current.clientWidth / 2, pickYRef.current));
          if (c) cb([c.lng(), c.lat()]);
        });
        setCtx({ map, g, Overlay: makeOverlay(g) });
      })
      .catch((e: unknown) => {
        console.error("Map failed to start", e);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRootH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => setDragged(false), [mode]);

  /* The planned trip on real roads (pickup → dropoff). */
  useEffect(() => {
    let live = true;
    setTrip(null);
    if (dropoff) void getRoute(lngLat(pickup), lngLat(dropoff)).then((r) => live && setTrip(r));
    return () => {
      live = false;
    };
  }, [pickup.lng, pickup.lat, dropoff?.lng, dropoff?.lat]);

  /* The live route from where the driver really is to where they're heading. */
  const target: "pickup" | "dropoff" | null =
    mode === "arriving" ? "pickup" : mode === "tracking" && dropoff ? "dropoff" : null;
  const targetAt = target === "pickup" ? lngLat(pickup) : target === "dropoff" && dropoff ? lngLat(dropoff) : null;
  const live = useLiveRoute(driverAt, targetAt, !!target && !!driverAt);

  /* Report remaining distance, time and the next turn. */
  useEffect(() => {
    const cb = liveRef.current;
    if (!cb) return;
    if (!target || !live || !driverAt) {
      cb(null);
      return;
    }
    const left = remainingOn(live, driverAt);
    cb({ target, distance: left.distance, duration: left.duration, next: nextStep(live, driverAt), real: live.real });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, target, driverAt?.[0], driverAt?.[1]]);

  /* Push route lines into the map. */
  const shown: { line: LngLat[]; style: "route" | "approach" } =
    mode === "preview" && trip
      ? { line: trip.coords, style: "route" }
      : mode === "arriving" && live && driverAt
        ? { line: trimRoute(live.coords, driverAt), style: "approach" }
        : mode === "tracking" && live && driverAt
          ? { line: trimRoute(live.coords, driverAt), style: "route" }
          : mode === "tracking" && trip
            ? { line: trip.coords, style: "route" }
            : { line: [], style: "route" };
  useEffect(() => {
    if (!lines.current) return;
    const path = shown.line.map(toLatLng);
    try {
      lines.current.casing.setPath(shown.style === "route" ? path : []);
      lines.current.route.setPath(shown.style === "route" ? path : []);
      lines.current.approach.setPath(shown.style === "approach" ? path : []);
    } catch (e) {
      // Google disables its objects when the key is rejected; keep the app usable.
      console.warn("Couldn't draw the route", e);
    }
  });

  /* Camera. */
  const frame = () => {
    if (!ctx) return;
    const { map, g } = ctx;
    const visible = Math.max(80, mapH - topInset);
    const fit = (pts: LngLat[]) => {
      if (pts.length < 2) return false;
      const b = new g.LatLngBounds();
      pts.forEach((p) => b.extend(toLatLng(p)));
      map.fitBounds(b, { top: topInset + Math.min(70, visible * 0.3), bottom: Math.min(40, visible * 0.15), left: 50, right: 50 });
      g.event.addListenerOnce(map, "idle", () => {
        if ((map.getZoom() ?? 0) > 17) map.setZoom(17);
      });
      return true;
    };
    // Put a point in the middle of the part of the map that isn't covered at the top.
    const centre = (at: LngLat, zoom: number) => {
      map.setZoom(zoom);
      map.panTo(toLatLng(offsetPoint(at, (mPerPx(at[1], zoom) * topInset) / 2, 0)));
    };

    if (follow && driverAt && (mode === "arriving" || mode === "tracking")) {
      centre(driverAt, 17);
    } else if (mode === "preview" && trip) {
      fit(trip.coords);
    } else if (mode === "tracking") {
      if (!fit(live && driverAt ? [driverAt, ...live.coords] : (trip?.coords ?? []))) centre(lngLat(pickup), 15);
    } else if (mode === "arriving") {
      if (!fit(driverAt ? [driverAt, lngLat(pickup), ...(live?.coords ?? [])] : [])) centre(lngLat(pickup), 16);
    } else if (mode === "here") {
      centre(lngLat(pickup), 17);
    } else if (mode === "pick") {
      centre(pickStart ?? lngLat(pickup), 16);
    } else {
      centre(lngLat(pickup), 15);
    }
  };
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const hasRoute = mode === "preview" ? !!trip : mode === "arriving" || mode === "tracking" ? !!live || !!trip : false;
  useEffect(() => {
    frameRef.current();
  }, [ctx, mode, pickup.lng, pickup.lat, hasRoute, mode === "pick" ? 0 : mapH, topInset, pickStart?.[0], pickStart?.[1], !!driverAt]);

  /* Follow the driver as they move, unless the map was dragged. */
  useEffect(() => {
    if (follow && !dragged) frameRef.current();
  }, [follow, dragged, driverAt?.[0], driverAt?.[1]]);

  const toggleSatellite = () => {
    const next = !satellite;
    setSatellite(next);
    ctx?.map.setMapTypeId(next ? "hybrid" : "roadmap");
  };

  const recenter = () => {
    setDragged(false);
    frameRef.current();
  };

  const pickupAt = lngLat(pickup);
  const showMe = meAt && !(driverAt && distanceM(meAt, driverAt) < 15 && mode === "tracking");

  return (
    <div ref={outer} className="absolute inset-0 overflow-hidden bg-map">
      <div className="move-map absolute inset-x-0 top-0" style={{ bottom: mapBottom }}>
        <div ref={box} className="size-full" />
      </div>

      {failed && (
        <div className="absolute inset-x-6 top-1/3 z-10 rounded-xl bg-card p-4 text-center text-xs text-muted-foreground shadow-float">
          The map couldn't load on this device. Check your connection and try again.
        </div>
      )}

      {ctx && (
        <Ctx.Provider value={ctx}>
          {mode !== "pick" && (
            <>
              <MapMarker at={pickupAt} anchor="bottom" offset={[0, 7]}>
                <PickupPin />
              </MapMarker>
              <MapMarker at={pickupAt} anchor="bottom" offset={[0, -48]}>
                <Label
                  title={pickupLabel ?? (mode === "idle" ? "Pickup" : "Pickup location")}
                  value={pickup.short}
                  onClick={onPickupClick}
                  chevron={mode === "idle"}
                />
              </MapMarker>
            </>
          )}

          {mode === "idle" && drivers.map((d) => <LiveVehicle key={d.id} at={d.at} vehicle={d.vehicle} />)}

          {(mode === "arriving" || mode === "here" || mode === "tracking") && driverAt && (
            <LiveVehicle key="driver" at={driverAt} vehicle={vehicle} />
          )}

          {passengerAt && (mode === "arriving" || mode === "here") && (
            <MapMarker at={passengerAt} anchor="center">
              <PassengerPin />
            </MapMarker>
          )}

          {showMe && mode !== "pick" && (
            <MapMarker at={meAt} anchor="center">
              <MeDot />
            </MapMarker>
          )}

          {(mode === "tracking" || mode === "preview") && dropoff && (
            <>
              <MapMarker at={lngLat(dropoff)} anchor="center">
                <span className="flex size-7 items-center justify-center rounded-full bg-ink text-ink-foreground ring-2 ring-card">
                  <Navigation className="size-3.5 rotate-90 fill-current" />
                </span>
              </MapMarker>
              <MapMarker at={lngLat(dropoff)} anchor="bottom" offset={[0, -20]}>
                <Label title="Dropoff location" value={dropoff.short} chevron={false} />
              </MapMarker>
            </>
          )}
        </Ctx.Provider>
      )}

      {mode === "pick" && (
        <div className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 -translate-y-full" style={{ top: pickY }}>
          <div className="flex flex-col items-center">
            <span className="flex size-9 items-center justify-center rounded-full bg-ink text-ink-foreground ring-4 ring-card shadow-float">
              <span className="size-2.5 rounded-full bg-card" />
            </span>
            <span className="h-4 w-0.5 bg-ink" />
          </div>
        </div>
      )}

      <div className="absolute right-4 z-10 flex flex-col gap-2" style={{ bottom: sheetHeight + 36 }}>
        <button
          aria-label={satellite ? "Show street map" : "Show satellite view"}
          aria-pressed={satellite}
          onClick={toggleSatellite}
          className={cn(
            "flex size-10 items-center justify-center rounded-full shadow-float transition-colors",
            satellite ? "bg-primary text-primary-foreground" : "bg-card text-foreground",
          )}
        >
          <Layers className="size-4" />
        </button>
        <button
          aria-label="Recenter map"
          onClick={recenter}
          className={cn(
            "flex size-10 items-center justify-center rounded-full shadow-float",
            follow && dragged ? "bg-primary text-primary-foreground" : "bg-card text-foreground",
          )}
        >
          <Navigation className="size-4" />
        </button>
      </div>
    </div>
  );
}
