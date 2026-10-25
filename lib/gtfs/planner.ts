/**
 * Trip planner over the bundled static schedule.
 *
 * Given an origin and destination station it returns every direct trip that
 * serves both, in order, with scheduled departure and arrival as absolute
 * Dates. Realtime delays are layered on separately (see hooks/useTripUpdates)
 * so this module stays pure and testable.
 */
import { getRoute, platformFor } from './data';
import { relevantServiceDates, serviceTimeToDate, tripsOnServiceDate } from './service';
import type { Direction, Route, Station, Trip } from './types';

export interface TripOption {
  trip: Trip;
  route: Route;
  direction: Direction;
  serviceDate: string;
  originStopId: string;
  destinationStopId: string;
  /** Index into trip.stops for origin / destination. */
  originIndex: number;
  destinationIndex: number;
  scheduledDeparture: Date;
  scheduledArrival: Date;
  durationMinutes: number;
  stopsBetween: number;
}

export interface PlanQuery {
  origin: Station;
  destination: Station;
  /** Reference time; defaults to now. */
  at?: Date;
  /** "depart" → trips leaving at/after `at`. "arrive" → trips arriving at/before `at`. */
  mode?: 'depart' | 'arrive';
  limit?: number;
}

/** Caltrain runs north-south, so direction is determined by latitude. */
export function directionBetween(origin: Station, destination: Station): Direction {
  return destination.lat > origin.lat ? 'N' : 'S';
}

export function planTrips({ origin, destination, at = new Date(), mode = 'depart', limit = 8 }: PlanQuery): TripOption[] {
  if (origin.id === destination.id) return [];
  const direction = directionBetween(origin, destination);
  const originStopId = platformFor(origin, direction);
  const destinationStopId = platformFor(destination, direction);
  if (!originStopId || !destinationStopId) return [];

  const options: TripOption[] = [];
  for (const serviceDate of relevantServiceDates(at)) {
    for (const trip of tripsOnServiceDate(serviceDate)) {
      if (trip.direction !== direction) continue;
      const originIndex = trip.stops.findIndex(([stopId]) => stopId === originStopId);
      if (originIndex < 0) continue;
      const destinationIndex = trip.stops.findIndex(([stopId]) => stopId === destinationStopId);
      if (destinationIndex <= originIndex) continue;

      const scheduledDeparture = serviceTimeToDate(serviceDate, trip.stops[originIndex][2]);
      const scheduledArrival = serviceTimeToDate(serviceDate, trip.stops[destinationIndex][1]);
      if (mode === 'depart' && scheduledDeparture < at) continue;
      if (mode === 'arrive' && scheduledArrival > at) continue;

      options.push({
        trip,
        route: getRoute(trip.routeId),
        direction,
        serviceDate,
        originStopId,
        destinationStopId,
        originIndex,
        destinationIndex,
        scheduledDeparture,
        scheduledArrival,
        durationMinutes: Math.round((scheduledArrival.getTime() - scheduledDeparture.getTime()) / 60000),
        stopsBetween: destinationIndex - originIndex - 1,
      });
    }
  }

  options.sort((a, b) =>
    mode === 'depart'
      ? a.scheduledDeparture.getTime() - b.scheduledDeparture.getTime()
      : b.scheduledArrival.getTime() - a.scheduledArrival.getTime()
  );
  return options.slice(0, limit);
}

/** Scheduled departures from one station (both directions) around `at`. */
export interface ScheduledDeparture {
  trip: Trip;
  route: Route;
  direction: Direction;
  serviceDate: string;
  stopId: string;
  stopIndex: number;
  scheduledDeparture: Date;
  /** Final stop name for the headsign. */
  headsign: string;
}

export function scheduledDeparturesAt(station: Station, at: Date = new Date(), limit = 20): ScheduledDeparture[] {
  const result: ScheduledDeparture[] = [];
  const horizonMs = 3 * 60 * 60 * 1000;
  for (const serviceDate of relevantServiceDates(at)) {
    for (const trip of tripsOnServiceDate(serviceDate)) {
      const stopId = platformFor(station, trip.direction);
      if (!stopId) continue;
      const stopIndex = trip.stops.findIndex(([id]) => id === stopId);
      // Skip the last stop: nothing departs from there.
      if (stopIndex < 0 || stopIndex === trip.stops.length - 1) continue;
      const scheduledDeparture = serviceTimeToDate(serviceDate, trip.stops[stopIndex][2]);
      const delta = scheduledDeparture.getTime() - at.getTime();
      if (delta < -2 * 60 * 1000 || delta > horizonMs) continue;
      result.push({
        trip,
        route: getRoute(trip.routeId),
        direction: trip.direction,
        serviceDate,
        stopId,
        stopIndex,
        scheduledDeparture,
        headsign: trip.headsign,
      });
    }
  }
  result.sort((a, b) => a.scheduledDeparture.getTime() - b.scheduledDeparture.getTime());
  return result.slice(0, limit);
}
