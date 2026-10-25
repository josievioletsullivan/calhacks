/**
 * Accessors for the bundled GTFS data. Everything here is synchronous and
 * pure so it can be used from the planner, the UI, and tests alike.
 */
import stationsJson from '@/data/stations.json';
import scheduleJson from '@/data/schedule.json';
import faresJson from '@/data/fares.json';
import shapeJson from '@/data/shape.json';

import type { Fares, LatLng, Route, Schedule, Station, Trip } from './types';

export const stations = stationsJson as Station[];
export const schedule = scheduleJson as unknown as Schedule;
export const fares = faresJson as Fares;
export const lineShape = shapeJson as LatLng[];

const stationById = new Map(stations.map((s) => [s.id, s]));
const stationByPlatform = new Map<string, Station>();
for (const s of stations) {
  if (s.northboundStopId) stationByPlatform.set(s.northboundStopId, s);
  if (s.southboundStopId) stationByPlatform.set(s.southboundStopId, s);
}
const tripById = new Map(schedule.trips.map((t) => [t.id, t]));

export function getStation(id: string): Station | undefined {
  return stationById.get(id);
}

/** Resolve a platform stop id (e.g. "70171") to its station. */
export function getStationForStop(stopId: string): Station | undefined {
  return stationByPlatform.get(stopId);
}

export function getTrip(tripId: string): Trip | undefined {
  return tripById.get(tripId);
}

export function getRoute(routeId: string): Route {
  return (
    schedule.routes[routeId] ?? { id: routeId, name: routeId, color: '#cccccc', textColor: '#000000' }
  );
}

/** Platform id a train in the given direction uses at this station. */
export function platformFor(station: Station, direction: 'N' | 'S'): string | null {
  return direction === 'N' ? station.northboundStopId : station.southboundStopId;
}

/** Great-circle distance in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestStation(point: LatLng): Station {
  let best = stations[0];
  let bestDist = Infinity;
  for (const s of stations) {
    const d = distanceKm(point, { latitude: s.lat, longitude: s.lon });
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
