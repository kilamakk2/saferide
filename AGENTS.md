<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- The app is a phone-first prototype: every screen renders inside `PhoneShell` (root layout), and overlays/sheets are absolutely positioned inside the frame instead of Radix portals, so they stay within the device on desktop.
- The backend is the user's own Firebase project (config in `src/lib/firebase-config.ts`, public by design), not Lovable Cloud: Firebase Auth (email/password, Google, Apple popups) and Firestore (`users/{uid}`, `rides/{id}`, `rides/{id}/offers/{driverUid}`); `firestore.rules` in the repo must be pasted into the Firebase console by hand because nothing deploys it.
- `src/lib/move-store.ts` is a local cache (current ride, profile mirror) persisted to localStorage; the Firestore profile is synced in by `src/lib/session.ts`, so write profile changes through `saveProfile()`, and keep selectors returning existing references to avoid render loops.
- Ride status transitions live in `src/lib/ride-logic.ts` (pure, tested); the passenger screen follows the ride document via `stageFor()`, and only the assigned driver moves a trip forward from the driver screen (`src/components/driver/`).
- File uploads go to the user's R2 upload worker: the browser asks `createUploadUrl` (server fn, verifies the Firebase ID token, holds `R2_UPLOAD_TOKEN`) for a one-time PUT link, then uploads directly — the worker token must never reach the browser.
- The ride flow on `/home` is driven by `ride.stage` (idle → choose → finding → arriving → here → started → tracking → arrived), not separate routes, so the map and sheet stay mounted between steps.
- Fares, vehicles and pickup points are static data in `src/lib/move-data.ts` (drivers are real accounts, never seeded); fare math is covered by `src/test/fares.test.ts`.

- The map is Google Maps JS (loaded by `src/lib/google-maps-loader.ts` with the managed browser key); its container stops at the top of the bottom sheet so Google's logo/terms stay visible, and all markers are React portals in `OverlayView`s — Google's terms forbid mixing its places with a Mapbox map, so no Mapbox code remains.
- Place search, pin naming and driving routes go through `src/lib/maps.functions.ts` (server functions → Lovable connector gateway, Gulu bbox enforced in the validators) and are cached client-side in `src/lib/maps.ts`; the bundled `src/lib/gulu-places.json` OSM snapshot (rebuilt by `scripts/build-gulu-places.py`) answers instantly and offline, and `rankPlaces` drops it when Google has the same place nearby.
