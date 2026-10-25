# CalHacks — Caltrain app plan

## Mobile app

### Features
- Live updates
- Departure times
- Time estimations from departure to desired arrival time
- Notifications for upcoming stop
- Trip planner

### Technical feasibility and architecture
- GTFS (General Transit Feed Specification) via 511 SF Bay (API key kept in `.env`, never committed)
- GTFS Static — station names and coordinates, scheduled train times
- GTFS Realtime — trip updates (delays), vehicle positions

### Screens
- My tickets
- Schedule
- Map

## Mapping plan → implementation

| Plan item                                   | Where it lives                                                     |
| ------------------------------------------- | ------------------------------------------------------------------ |
| Live updates                                | `hooks/useLiveData.ts` polling the three 511 realtime feeds        |
| Departure times                             | Schedule tab (`app/(tabs)/index.tsx`)                              |
| Time estimations to desired arrival         | Plan tab, "Arrive by" mode (`app/(tabs)/plan.tsx`, `lib/gtfs/planner.ts`) |
| Notifications for upcoming stop             | Trip detail bell (`app/trip/[tripId].tsx`, `lib/notifications.ts`) |
| Trip planner                                | Plan tab                                                           |
| GTFS static (stations, scheduled times)     | `scripts/build-gtfs.mjs` → `data/*.json`, read by `lib/gtfs/data.ts` |
| GTFS realtime                               | `lib/api/tripUpdates.ts`, `lib/api/vehiclePositions.ts`, `lib/api/stopMonitoring.ts` |
| My tickets                                  | Tickets tab (`app/(tabs)/tickets.tsx`, fares from `lib/gtfs/fares.ts`) |
| Schedule                                    | Schedule tab                                                       |
| Map                                         | Map tab (`app/(tabs)/map.tsx`, react-native-maps)                  |

## Ideas for the demo / stretch
- Background task that re-schedules stop alerts as delays change
- Favorite stations and a home-screen widget
- Service alerts (511 `servicealerts` feed)
- Fare capping / Clipper deep link
