/**
 * GTFS service-calendar logic: which trips run on a given service day.
 *
 * A "service day" in GTFS can extend past midnight (a 25:10:00 departure means
 * 1:10 AM the next calendar day), so callers that want "trips around now"
 * should consider both today's and yesterday's service days.
 */
import { schedule } from './data';
import type { Trip } from './types';

/** Format a Date as the GTFS YYYYMMDD string in the device's local timezone. */
export function toServiceDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** Local midnight for a YYYYMMDD service date. */
export function serviceDateToMidnight(serviceDate: string): Date {
  const y = Number(serviceDate.slice(0, 4));
  const m = Number(serviceDate.slice(4, 6)) - 1;
  const d = Number(serviceDate.slice(6, 8));
  return new Date(y, m, d, 0, 0, 0, 0);
}

export function isServiceActive(serviceId: string, serviceDate: string): boolean {
  const svc = schedule.services[serviceId];
  if (!svc) return false;
  if (svc.removed.includes(serviceDate)) return false;
  if (svc.added.includes(serviceDate)) return true;
  if (serviceDate < svc.start || serviceDate > svc.end) return false;
  const weekday = serviceDateToMidnight(serviceDate).getDay();
  return svc.weekdays[weekday];
}

const cache = new Map<string, Trip[]>();

export function tripsOnServiceDate(serviceDate: string): Trip[] {
  const cached = cache.get(serviceDate);
  if (cached) return cached;
  const result = schedule.trips.filter((t) => isServiceActive(t.serviceId, serviceDate));
  cache.set(serviceDate, result);
  return result;
}

/** Convert GTFS seconds-after-midnight on a service day to an absolute Date. */
export function serviceTimeToDate(serviceDate: string, seconds: number): Date {
  const midnight = serviceDateToMidnight(serviceDate);
  return new Date(midnight.getTime() + seconds * 1000);
}

/** The service dates whose trips could still be relevant at `at`: yesterday and today. */
export function relevantServiceDates(at: Date): string[] {
  const yesterday = new Date(at);
  yesterday.setDate(yesterday.getDate() - 1);
  return [toServiceDate(yesterday), toServiceDate(at)];
}
