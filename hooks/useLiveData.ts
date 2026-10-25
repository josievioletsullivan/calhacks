/** Hooks around the three 511 realtime feeds, each polled at a rate-limit-friendly cadence. */
import { useCallback } from 'react';

import { fetchLiveDepartures, type LiveDeparture } from '@/lib/api/stopMonitoring';
import { fetchTripUpdates, type TripPredictions } from '@/lib/api/tripUpdates';
import { fetchVehiclePositions, type VehiclePosition } from '@/lib/api/vehiclePositions';

import { usePolling } from './usePolling';

export const LIVE_INTERVAL_MS = 60_000;

export function useLiveDepartures(stopIds: string[] | null, enabled = true) {
  // Fetch agency-wide once, filter locally: one request serves both platforms.
  const fetcher = useCallback(async () => {
    const all = await fetchLiveDepartures();
    return stopIds ? all.filter((d) => stopIds.includes(d.stopId)) : all;
  }, [stopIds]);
  return usePolling<LiveDeparture[]>(fetcher, LIVE_INTERVAL_MS, enabled);
}

export function useTripUpdates(enabled = true) {
  return usePolling<TripPredictions>(fetchTripUpdates, LIVE_INTERVAL_MS, enabled);
}

export function useVehiclePositions(enabled = true) {
  return usePolling<VehiclePosition[]>(fetchVehiclePositions, LIVE_INTERVAL_MS, enabled);
}
