import { fares } from './data';
import type { Station } from './types';

export interface FareQuote {
  price: number;
  currency: string;
  originZone: string;
  destinationZone: string;
  zonesTravelled: number;
  validitySeconds: number;
}

/** Adult one-way fare between two stations from the GTFS fare rules. */
export function quoteFare(origin: Station, destination: Station): FareQuote | null {
  const price = fares.byZonePair[`${origin.zoneId}-${destination.zoneId}`];
  if (price === undefined) return null;
  const zoneNumber = (zoneId: string) => Number(fares.zones[zoneId]?.match(/Zone (\d)/)?.[1] ?? 0);
  const zonesTravelled = Math.abs(zoneNumber(origin.zoneId) - zoneNumber(destination.zoneId)) + 1;
  return {
    price,
    currency: fares.currency,
    originZone: fares.zones[origin.zoneId] ?? origin.zoneId,
    destinationZone: fares.zones[destination.zoneId] ?? destination.zoneId,
    zonesTravelled,
    validitySeconds: fares.validitySeconds,
  };
}

export function formatPrice(price: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price);
}
