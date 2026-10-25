/** GTFS-Realtime VehiclePositions: where each train is right now. */
import { CALTRAIN_AGENCY, fetch511 } from './client';

interface RtVehicleEntity {
  Id: string;
  Vehicle: {
    Trip: { TripId: string; RouteId: string; DirectionId: number };
    Vehicle: { Id: string; Label?: string };
    Position: { Latitude: number; Longitude: number; Bearing?: number; Speed?: number };
    Timestamp?: number;
    StopId?: string;
  } | null;
}

interface VehiclePositionsResponse {
  Header: { Timestamp: number };
  Entities: RtVehicleEntity[];
}

export interface VehiclePosition {
  vehicleId: string;
  tripId: string;
  routeId: string;
  direction: 'N' | 'S';
  latitude: number;
  longitude: number;
  bearing: number | null;
  updatedAt: Date | null;
}

export async function fetchVehiclePositions(): Promise<VehiclePosition[]> {
  const data = await fetch511<VehiclePositionsResponse>('vehiclepositions', { agency: CALTRAIN_AGENCY });
  const result: VehiclePosition[] = [];
  for (const entity of data.Entities ?? []) {
    const v = entity.Vehicle;
    if (!v?.Position) continue;
    result.push({
      vehicleId: v.Vehicle?.Id ?? entity.Id,
      tripId: v.Trip.TripId,
      routeId: v.Trip.RouteId,
      direction: v.Trip.DirectionId === 0 ? 'N' : 'S',
      latitude: v.Position.Latitude,
      longitude: v.Position.Longitude,
      bearing: v.Position.Bearing ?? null,
      updatedAt: v.Timestamp ? new Date(v.Timestamp * 1000) : null,
    });
  }
  return result;
}
