# Roadmap

## Done
- [x] Real map centred on Gulu city (replaced the drawn map image)
- [x] Real place search (places, areas, roads, addresses, POIs) via Mapbox + OpenStreetMap
- [x] Real driving route between pickup and destination
- [x] 2D / 3D map switch (3D buildings + terrain) + satellite view
- [x] User's own Mapbox public token

## Next
- [x] Gulu-only search with built-in list of every named Gulu place (typo-friendly) + "Set it on the map"
- [x] Switched the whole map to Google Maps: live search of every Google place in Gulu, Google routes, satellite view (3D buildings dropped)
- [ ] Protect the Google search/route lookups behind real accounts (login now exists)
- [ ] "Use my current location" and the other search shortcuts (still "Coming soon")
- [ ] Switch fares from Naira (₦) to Ugandan shillings (UGX); rename drivers/plates to Ugandan ones
- [x] Real accounts on Firebase (email, Google, Apple), saved profiles and trips, live driver offers — no more pretend drivers
- [x] Profile photos upload to the user's own R2 storage
- [ ] Apple sign-in: needs Apple Developer setup in Firebase (user)
- [ ] Paste `firestore.rules` into Firebase and add the preview/published web addresses to Firebase authorized domains (user)
- [ ] Phone/SMS sign-in (removed for now)
