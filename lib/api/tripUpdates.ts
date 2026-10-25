/**
 * GTFS-Realtime TripUpdates (511 serves a JSON rendering of the protobuf).
 * Gives predicted arrival/departure per upcoming stop for every active trip,
 * which is what the trip planner needs to turn scheduled times into estimates.
 */
import { CALTRAIN_AGENCY, fetch511 } from './client';

interface RtStopTimeEvent {
  Time?: number;
  Delay?: number;
}

interface RtStopTimeUpdate {
  StopId: string;
  StopSequence?: number;
  Arrival?: RtStopTimeEvent | null;
  Departure?: RtStopTimeEvent | null;
  ScheduleRelationship?: number | string;
}

interface RtEntity {
  Id: string;
  TripUpdate: {
    Trip: { TripId: string; RouteId: string; DirectionId: number; ScheduleRelationship?: number | string };
    Vehicle?: { Id: string } | null;
    StopTimeUpdates: RtStopTimeUpdate[];
    Timestamp?: number;
  } | null;
}

interface TripUpdatesResponse {
  Header: { Timestamp: number };
  Entities: RtEntity[];
}

export interface StopPrediction {
  stopId: string;
  arrival: Date | null;
  departure: Date | null;
}

export interface TripPrediction {
  tripId: string;
  routeId: string;
  vehicleId: string | null;
  updatedAt: Date | null;
  cancelled: boolean;
  /** Keyed by platform stop id. */
  stops: Map<string, StopPrediction>;
}

export type TripPredictions = Map<string, TripPrediction>;

export async function fetchTripUpdates(): Promise<TripPredictions> {
  const data = await fetch511<TripUpdatesResponse>('tripupdates', { agency: CALTRAIN_AGENCY });
  const predictions: TripPredictions = new Map();
  for (const entity of data.Entities ?? []) {
    const update = entity.TripUpdate;
    if (!update) continue;
    const stops = new Map<string, StopPrediction>();
    for (const stu of update.StopTimeUpdates ?? []) {
      stops.set(stu.StopId, {
        stopId: stu.StopId,
        arrival: toDate(stu.Arrival?.Time),
        departure: toDate(stu.Departure?.Time),
      });
    }
    const rel = update.Trip.ScheduleRelationship;
    predictions.set(update.Trip.TripId, {
      tripId: update.Trip.TripId,
      routeId: update.Trip.RouteId,
      vehicleId: update.Vehicle?.Id ?? null,
      updatedAt: toDate(update.Timestamp),
      cancelled: rel === 3 || rel === 'CANCELED' || rel === 'CANCELLED',
      stops,
    });
  }
  return predictions;
}

function toDate(epochSeconds: number | undefined | null): Date | null {
  return epochSeconds ? new Date(epochSeconds * 1000) : null;
}
