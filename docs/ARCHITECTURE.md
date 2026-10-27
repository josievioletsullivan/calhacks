# Architecture

## Data sources (511 SF Bay, operator `CT`)

| Feed                | Endpoint                               | Format        | Used for                                   |
| ------------------- | -------------------------------------- | ------------- | ------------------------------------------ |
| GTFS static         | `/transit/datafeeds?operator_id=CT`    | zip of CSVs   | Stations, trips, stop times, calendar, fares, line shape |
| SIRI StopMonitoring | `/transit/StopMonitoring?agency=CT`    | JSON          | Predicted departures per platform          |
| GTFS-RT TripUpdates | `/transit/tripupdates?agency=CT`       | JSON          | Predicted arrival/departure for every upcoming stop of active trips |
| GTFS-RT Vehicles    | `/transit/vehiclepositions?agency=CT`  | JSON          | Train dots on the map                      |

All 511 responses are gzipped and the JSON starts with a UTF-8 BOM; `lib/api/client.ts`
handles both. The free tier allows 60 requests/hour per key, so each feed is
polled at most once a minute and paused while the app is in the background.

## Static schedule is bundled, realtime is overlaid

```
scripts/build-gtfs.mjs   (run at dev time)
   │  downloads GTFS zip, compacts it
   ▼
data/schedule.json  data/stations.json  data/fares.json  data/shape.json
   │  imported at build time
   ▼
lib/gtfs/data.ts ── lib/gtfs/service.ts ── lib/gtfs/planner.ts ── lib/gtfs/fares.ts
   │  pure, synchronous, no network
   ▼
screens  ◄──  hooks/useLiveData.ts  ◄──  lib/api/*  (511 realtime, polled)
```

Why bundle the static feed instead of fetching it at runtime?

- It is small (~250 KB of JSON) and changes a few times a year.
- The planner and schedule work offline and instantly; no loading state on launch.
- The realtime feeds only cover trains that are currently running, so the static
  schedule is the only source for "the 6:14 tomorrow morning".

Realtime data is matched to static trips by **trip id** — 511's `DatedVehicleJourneyRef`
and GTFS-RT `TripId` are the same ids as `trips.txt`, which makes merging trivial.

## GTFS modelling notes

- Each station is a parent stop (`location_type = 1`) with two platform children.
  Odd platform ids are northbound (`direction_id 0`), even are southbound.
- Stop times are stored as seconds after midnight of the *service day* and may
  exceed 24:00 for late trains. `lib/gtfs/service.ts` therefore always considers
  both yesterday's and today's service days when asking "what runs around now".
- Caltrain is a single north–south line, so trip direction between two stations
  is decided by latitude (`planner.directionBetween`).
- Fares are zone-based (`fare_rules.origin_id/destination_id` are zone ids); the
  parent stop's `zone_id` is wrong in this feed, so the generator uses the platform's.

## Screens → modules

- **Schedule** (`app/(tabs)/index.tsx`): `scheduledDeparturesAt` + `useLiveDepartures`
- **Plan** (`app/(tabs)/plan.tsx`): `planTrips` + `useTripUpdates` + `quoteFare`
- **Map** (`app/(tabs)/map.tsx`): `lineShape`, `stations`, `useVehiclePositions`
- **Trip** (`app/trip/[tripId].tsx`): `getTrip` + `useTripUpdates` + `lib/notifications.ts`

## Conventions

- Business logic in `lib/` is framework-free and testable; screens stay thin.
- `@/` resolves to the repo root (see `tsconfig.json`).
- Use `npx expo install <pkg>` for dependencies so versions match the Expo SDK.
