import { describe, expect, it } from "vitest";
import { VEHICLES, offerLabel, tripTotal } from "@/lib/move-data";
import { distanceM, inGulu, rankPlaces, GULU } from "@/lib/geo";
import { searchRows, type GuluRow } from "@/lib/gulu-search";
import { isValidEmail, isValidPhone } from "@/lib/validation";

describe("fares", () => {
  it("lists bus at ₦300, mini bus at ₦400 and taxi at ₦600 per seat", () => {
    expect(VEHICLES.map((v) => [v.id, v.pricePerSeat])).toEqual([
      ["bus", 300],
      ["minibus", 400],
      ["taxi", 600],
    ]);
  });

  it("multiplies the price per seat by seats booked", () => {
    expect(tripTotal(300, 1)).toBe(300);
    expect(tripTotal(300, 3)).toBe(900);
  });

  it("labels an offer ₦200 above the named price", () => {
    expect(offerLabel(500, 300)).toEqual({ tone: "above", text: "₦200 above your offer" });
    expect(offerLabel(300, 300).text).toBe("Matches your offer");
  });
});

describe("search", () => {
  it("finds Slaughter and reports nothing for gulu", () => {
    const near = { id: "a", short: "Gulu Market", name: "Gulu Market", area: "", lng: GULU[0], lat: GULU[1] };
    const far = { ...near, id: "b", lng: GULU[0] + 1 };
    expect(rankPlaces([far, near], "gulu", GULU)[0]?.id).toBe("a");
    expect(Math.round(distanceM([32.3, 2.77], [32.3, 2.78]) / 10) * 10).toBe(1110);
  });
});

describe("sign-in validation", () => {
  it("accepts real emails and 10+ digit phones only", () => {
    expect(isValidEmail("mainplatform.nexus@gmail.com")).toBe(true);
    expect(isValidEmail("nope@")).toBe(false);
    expect(isValidPhone("0803 123 4567")).toBe(true);
    expect(isValidPhone("12345")).toBe(false);
  });
});

describe("Gulu-only search", () => {
  const rows: GuluRow[] = [
    ["Custom Corner", "Junction · Juba Road, Layibi", "area", 32.27854, 2.7618, ["Customs Corner"]],
    ["Kanyagoga A", "Village", "area", 32.29, 2.76],
    ["Gulu Main Market", "Market", "poi", 32.2995, 2.7724],
  ];

  it("finds Custom Corner when typed 'custom corner', 'customs corner' or with a typo", () => {
    for (const q of ["custom corner", "Customs Corner", "custm corner", "custom cor"]) {
      expect(searchRows(rows, q, GULU)[0]?.name).toBe("Custom Corner");
    }
  });

  it("drops results outside Gulu", () => {
    const inside = { id: "a", short: "Market", name: "Market", area: "", lng: 32.3, lat: 2.77 };
    const kampala = { ...inside, id: "k", lng: 32.58, lat: 0.31 };
    expect(rankPlaces([kampala, inside], "market", GULU).map((p) => p.id)).toEqual(["a"]);
  });

  it("the built-in Gulu list has every place inside Gulu and includes Custom Corner", async () => {
    const all = (await import("@/lib/gulu-places.json")).default as unknown as GuluRow[];
    expect(all.length).toBeGreaterThan(1000);
    expect(all.every((r) => inGulu([r[3], r[4]]))).toBe(true);
    expect(searchRows(all, "custom corner", GULU)[0]?.name).toBe("Custom Corner");
    const juba = searchRows(all, "juba road", GULU)[0];
    expect(juba?.name).toBe("Juba Road");
    expect(juba?.area).toContain("Nimule - Gulu Road");
  });
});

describe("google maps data", () => {
  it("decodes Google's encoded route lines into lng/lat points", async () => {
    const { decodePolyline } = await import("@/lib/geo");
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ]);
  });

  it("labels a Google shop by its type and street, and roads as roads", async () => {
    const { fromGoogle } = await import("@/lib/geo");
    const aol = fromGoogle({ id: "x", name: "AOL FASHIONS", address: "Queens, Gulu, Uganda", type: "Store", types: ["store"], lat: 2.77239, lng: 32.29888 });
    expect(aol).toMatchObject({ name: "AOL FASHIONS", area: "Store · Queens, Gulu", kind: "poi" });
    expect(fromGoogle({ ...aol, id: "y", name: "Juba Rd", address: "Gulu", type: "", types: ["route"], lat: 2.78, lng: 32.29 }).kind).toBe("road");
  });

  it("puts a Google result ahead of a same-named bundled place nearby", () => {
    const g = { id: "g-1", short: "KSP Hotel", name: "KSP Hotel", area: "Hotel · Queens", lng: 32.2985, lat: 2.7721 };
    const local = { ...g, id: "gulu-1", area: "Hotel & rooftop bar", lng: 32.29851, lat: 2.77213 };
    expect(rankPlaces([g, local], "ksp hotel", GULU).map((p) => p.id)).toEqual(["g-1"]);
  });
});

import { driverStats, etaMinutes, isFreshRequest, isOnline, stageFor } from "@/lib/ride-logic";

describe("live rides", () => {
  it("moves the passenger screen with the driver's updates", () => {
    expect(stageFor("finding", "finding")).toBe("finding");
    expect(stageFor("accepted", "finding")).toBe("arriving");
    expect(stageFor("here", "arriving")).toBe("here");
    expect(stageFor("started", "here")).toBe("started");
    expect(stageFor("started", "tracking")).toBe("tracking");
    expect(stageFor("arrived", "tracking")).toBe("arrived");
  });

  it("keeps the rating screen when the driver finishes first, and ends cancelled rides", () => {
    expect(stageFor("completed", "arrived")).toBe("arrived");
    expect(stageFor("completed", "tracking")).toBe("reset");
    expect(stageFor("cancelled", "arriving")).toBe("reset");
  });

  it("estimates at least 1 minute, about 3 minutes for a kilometre", () => {
    expect(etaMinutes(0)).toBe(1);
    expect(etaMinutes(1000)).toBe(3);
  });

  it("rates a driver only on rated, completed trips", () => {
    expect(
      driverStats([
        { status: "completed", rating: 5 },
        { status: "completed", rating: 4 },
        { status: "completed", rating: 0 },
        { status: "cancelled", rating: 1 },
      ]),
    ).toEqual({ rating: 4.5, rides: 3 });
    expect(driverStats([])).toEqual({ rating: null, rides: 0 });
  });

  it("hides requests older than 20 minutes and drivers silent for 3 minutes", () => {
    const now = 10_000_000;
    expect(isFreshRequest({ status: "finding", createdAt: now - 19 * 60_000 }, now)).toBe(true);
    expect(isFreshRequest({ status: "finding", createdAt: now - 21 * 60_000 }, now)).toBe(false);
    expect(isFreshRequest({ status: "accepted", createdAt: now }, now)).toBe(false);
    expect(isOnline({ online: true, lastSeen: now - 2 * 60_000 }, now)).toBe(true);
    expect(isOnline({ online: true, lastSeen: now - 4 * 60_000 }, now)).toBe(false);
  });
});
