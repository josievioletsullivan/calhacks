/** Small date/time helpers shared across screens. */

export function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** "3 min", "Now", "1 hr 5 min" relative to `now`. */
export function formatCountdown(target: Date, now: Date = new Date()): string {
  const minutes = Math.round((target.getTime() - now.getTime()) / 60000);
  if (minutes <= 0) return 'Now';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** "+4 min" / "on time" / "-1 min" for a realtime delay in seconds. */
export function formatDelay(delaySeconds: number | null | undefined): string {
  if (delaySeconds == null) return 'scheduled';
  const minutes = Math.round(delaySeconds / 60);
  if (minutes === 0) return 'on time';
  return minutes > 0 ? `+${minutes} min` : `${minutes} min`;
}

export function fromEpochSeconds(seconds: number): Date {
  return new Date(seconds * 1000);
}
