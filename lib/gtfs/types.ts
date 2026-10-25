/** Types for the compiled GTFS data in /data (produced by scripts/build-gtfs.mjs). */

export type Direction = 'N' | 'S';

export interface Station {
  /** Parent stop id, e.g. "palo_alto". */
  id: string;
  name: string;
  lat: number;
  lon: number;
  zoneId: string;
  northboundStopId: string | null;
  southboundStopId: string | null;
  wheelchairBoarding: boolean;
}

export interface Route {
  id: string;
  name: string;
  color: string;
  textColor: string;
}

export interface Service {
  /** Sunday-first, matches Date.getDay(). */
  weekdays: boolean[];
  /** YYYYMMDD */
  start: string;
  end: string;
  added: string[];
  removed: string[];
}

/** [stopId, arrivalSeconds, departureSeconds] relative to service-day midnight. */
export type StopTime = [string, number, number];

export interface Trip {
  id: string;
  routeId: string;
  serviceId: string;
  direction: Direction;
  headsign: string;
  shortName: string;
  bikesAllowed: boolean;
  stops: StopTime[];
}

export interface Schedule {
  feedVersion: string | null;
  feedStart: string | null;
  feedEnd: string | null;
  generatedAt: string;
  routes: Record<string, Route>;
  services: Record<string, Service>;
  trips: Trip[];
}

export interface Fares {
  currency: string;
  validitySeconds: number;
  zones: Record<string, string>;
  /** key: `${originZoneId}-${destinationZoneId}` */
  byZonePair: Record<string, number>;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}
