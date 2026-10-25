/**
 * SIRI StopMonitoring: realtime predicted arrivals/departures.
 * One request without a stopCode returns every monitored visit on the agency,
 * which lets the schedule screen poll once and filter locally.
 */
import { CALTRAIN_AGENCY, fetch511 } from './client';

interface SiriCall {
  StopPointRef: string;
  StopPointName: string;
  DestinationDisplay: string;
  AimedArrivalTime: string | null;
  ExpectedArrivalTime: string | null;
  AimedDepartureTime: string | null;
  ExpectedDepartureTime: string | null;
}

interface SiriVisit {
  RecordedAtTime: string;
  MonitoringRef: string;
  MonitoredVehicleJourney: {
    LineRef: string;
    DirectionRef: 'N' | 'S';
    FramedVehicleJourneyRef: { DataFrameRef: string; DatedVehicleJourneyRef: string };
    OriginRef: string;
    OriginName: string;
    DestinationRef: string;
    DestinationName: string;
    VehicleRef?: string;
    VehicleLocation?: { Longitude: string; Latitude: string } | null;
    MonitoredCall: SiriCall;
  };
}

interface StopMonitoringResponse {
  ServiceDelivery: {
    ResponseTimestamp: string;
    StopMonitoringDelivery: { MonitoredStopVisit?: SiriVisit[] };
  };
}

export interface LiveDeparture {
  /** GTFS trip id (matches schedule.json). */
  tripId: string;
  routeId: string;
  direction: 'N' | 'S';
  stopId: string;
  destinationDisplay: string;
  aimedDeparture: Date | null;
  expectedDeparture: Date | null;
  aimedArrival: Date | null;
  expectedArrival: Date | null;
  /** expected − aimed departure, seconds. null when no prediction. */
  delaySeconds: number | null;
  vehicleLocation: { latitude: number; longitude: number } | null;
  recordedAt: Date;
}

export async function fetchLiveDepartures(stopId?: string): Promise<LiveDeparture[]> {
  const params: Record<string, string> = { agency: CALTRAIN_AGENCY };
  if (stopId) params.stopCode = stopId;
  const data = await fetch511<StopMonitoringResponse>('StopMonitoring', params);
  const visits = data.ServiceDelivery.StopMonitoringDelivery.MonitoredStopVisit ?? [];
  return visits.map(toLiveDeparture).sort(byDepartureTime);
}

function toLiveDeparture(visit: SiriVisit): LiveDeparture {
  const journey = visit.MonitoredVehicleJourney;
  const call = journey.MonitoredCall;
  const aimedDeparture = parseDate(call.AimedDepartureTime);
  const expectedDeparture = parseDate(call.ExpectedDepartureTime);
  const loc = journey.VehicleLocation;
  return {
    tripId: journey.FramedVehicleJourneyRef.DatedVehicleJourneyRef,
    routeId: journey.LineRef,
    direction: journey.DirectionRef,
    stopId: call.StopPointRef,
    destinationDisplay: call.DestinationDisplay || journey.DestinationName,
    aimedDeparture,
    expectedDeparture,
    aimedArrival: parseDate(call.AimedArrivalTime),
    expectedArrival: parseDate(call.ExpectedArrivalTime),
    delaySeconds:
      aimedDeparture && expectedDeparture
        ? Math.round((expectedDeparture.getTime() - aimedDeparture.getTime()) / 1000)
        : null,
    vehicleLocation:
      loc && loc.Latitude && loc.Longitude
        ? { latitude: Number(loc.Latitude), longitude: Number(loc.Longitude) }
        : null,
    recordedAt: new Date(visit.RecordedAtTime),
  };
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function byDepartureTime(a: LiveDeparture, b: LiveDeparture): number {
  const ta = (a.expectedDeparture ?? a.aimedDeparture)?.getTime() ?? Infinity;
  const tb = (b.expectedDeparture ?? b.aimedDeparture)?.getTime() ?? Infinity;
  return ta - tb;
}
