"""Rebuild src/lib/gulu-places.json from an Overpass (OpenStreetMap) export of Gulu.
Download the two Overpass JSON files first (see queries in AGENTS.md), then run: python3 scripts/build-gulu-places.py
"""
import json, math, re
els = {}
for f in ["/tmp/gulu_osm.json", "/tmp/gulu_places_wide.json"]:
    for e in json.load(open(f))["elements"]:
        els[(e["type"], e["id"])] = e
def pos(e):
    if "lat" in e: return e["lon"], e["lat"]
    c = e.get("center"); return (c["lon"], c["lat"]) if c else None
def dist(a, b):
    dx = (a[0]-b[0])*111320*math.cos(math.radians(2.77)); dy = (a[1]-b[1])*110540
    return math.hypot(dx, dy)
LABEL = {"place_of_worship":"Church / mosque","school":"School","kindergarten":"Nursery school","college":"College","university":"University",
 "hospital":"Hospital","clinic":"Clinic","doctors":"Clinic","pharmacy":"Pharmacy","dentist":"Dentist","bank":"Bank","atm":"ATM",
 "fuel":"Fuel station","restaurant":"Restaurant","bar":"Bar","cafe":"Café","fast_food":"Fast food","pub":"Bar","marketplace":"Market",
 "police":"Police","townhall":"Government office","courthouse":"Court","post_office":"Post office","bus_station":"Bus park","taxi":"Taxi stage",
 "hotel":"Hotel","guest_house":"Guest house","hostel":"Hostel","motel":"Lodge","village":"Village","locality":"Area","suburb":"Area",
 "neighbourhood":"Area","hamlet":"Village","town":"Town","city":"City","supermarket":"Supermarket","stadium":"Stadium","pitch":"Sports ground",
 "park":"Park","community_centre":"Community centre","library":"Library","prison":"Prison","fire_station":"Fire station","water_point":"Water point",
 "toilets":"Toilets","drinking_water":"Water point","social_facility":"Social services","ngo":"NGO office","government":"Government office"}
def kind_label(t):
    if "place" in t: return ("area" if t["place"] not in ("city","town") else "city"), LABEL.get(t["place"], "Area")
    if "highway" in t:
        if t["highway"] in ("bus_stop",): return "poi", "Bus stop"
        return "road", "Road"
    for k in ("amenity","shop","tourism","leisure","office","healthcare","building","landuse","craft","man_made","historic","aeroway"):
        if k in t:
            v = t[k]
            lab = LABEL.get(v) or (("Shop" if k=="shop" else v.replace("_"," ").capitalize()) if v not in ("yes",) else k.capitalize())
            if k=="aeroway": lab="Airport" if v=="aerodrome" else "Airport"
            return "poi", lab
    return "poi", "Place"
raw = []
for e in els.values():
    t = e.get("tags", {}); p = pos(e)
    name = (t.get("name") or t.get("name:en") or "").strip()
    if not p or not name or name.lower() in ("no name","foot path","market","oding","yes"): continue
    if t.get("place") in ("state",): continue
    k, lab = kind_label(t)
    aliases = [t[a] for a in ("alt_name","old_name","official_name","short_name","name:en","loc_name") if t.get(a) and t[a] != name]
    raw.append(dict(n=name, k=k, c=lab, x=p[0], y=p[1], st=t.get("addr:street"), al=aliases))
# areas for context
areas = [r for r in raw if r["k"] in ("area",) or r["c"] in ("Village","Area")]
out = []
for r in raw:
    dup = next((o for o in out if o["n"].lower()==r["n"].lower() and dist((o["x"],o["y"]),(r["x"],r["y"])) < (2500 if r["k"]=="road" else 150)), None)
    if dup:
        dup["al"] = sorted(set(dup["al"]+r["al"])); continue
    out.append(r)
for r in out:
    if r["k"] in ("area","city"):
        r["a"] = r["c"]
    else:
        near = min((a for a in areas if a is not r), key=lambda a: dist((a["x"],a["y"]),(r["x"],r["y"])), default=None)
        bits = [r["c"]]
        if r.get("st"): bits.append(r["st"])
        elif near and dist((near["x"],near["y"]),(r["x"],r["y"])) < 1500: bits.append(near["n"])
        r["a"] = " · ".join(bits)
# Well-known local names that the maps don't carry yet (coordinates checked against public listings).
EXTRA = [
  dict(n="Custom Corner", al=["Customs Corner","Custom Corner Market","Custom Corner Roundabout"], k="area", a="Junction · Juba Road, Layibi", x=32.27854, y=2.76180),
]
# Common local road names → OSM names
ALIAS = {"Nimule - Gulu Road":["Juba Road","Gulu - Nimule Road","Nimule Road"],"Gulu - Lira - Kampala Road":["Kampala Road","Lira Road"],
         "Lumuba Avenue":["Lumumba Avenue"],"Jomo Kinyata Road":["Jomo Kenyatta Road"],"Gulu - Kitgum Road":["Kitgum Road"]}
for r in out:
    for k2, v in ALIAS.items():
        if r["n"] == k2: r["al"] = sorted(set(r["al"]+v))
rows = [[r["n"], r["a"], r["k"], round(r["x"],5), round(r["y"],5)] + ([r["al"]] if r["al"] else []) for r in EXTRA + out if 32.05 <= r["x"] <= 32.55 and 2.55 <= r["y"] <= 3.0]
json.dump(rows, open("src/lib/gulu-places.json","w"), ensure_ascii=False, separators=(",",":"))
print(len(rows))
import collections; print(collections.Counter(r[2] for r in rows))
print([r for r in rows if "Juba" in json.dumps(r)][:3])
