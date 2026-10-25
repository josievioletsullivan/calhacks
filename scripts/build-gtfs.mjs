#!/usr/bin/env node
/**
 * Downloads the Caltrain GTFS static feed from 511 SF Bay and compiles it into
 * compact JSON the app bundles (data/*.json).
 *
 * Usage:  EXPO_PUBLIC_511_API_KEY=... node scripts/build-gtfs.mjs
 *    or:  npm run gtfs            (reads .env automatically)
 *
 * Outputs:
 *   data/stations.json  – one entry per station (parent stop) with NB/SB platform ids
 *   data/schedule.json  – routes, service calendars, and every trip with stop times
 *   data/fares.json     – zone-to-zone adult fares
 *   data/shape.json     – a downsampled polyline of the full SF → Gilroy alignment
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'data');

loadDotEnv(resolve(root, '.env'));
const apiKey = process.env.EXPO_PUBLIC_511_API_KEY;
if (!apiKey) {
  console.error('Missing EXPO_PUBLIC_511_API_KEY (set it in .env or the environment).');
  process.exit(1);
}

const url = `https://api.511.org/transit/datafeeds?api_key=${apiKey}&operator_id=CT`;
console.log('Downloading Caltrain GTFS static from 511…');
const res = await fetch(url);
if (!res.ok) {
  console.error(`511 returned HTTP ${res.status}`);
  process.exit(1);
}
const zip = unzipSync(new Uint8Array(await res.arrayBuffer()));
const table = (name) => parseCsv(strFromU8(zip[`${name}.txt`]));

const stops = table('stops');
const routes = table('routes');
const trips = table('trips');
const stopTimes = table('stop_times');
const calendar = table('calendar');
const calendarDates = table('calendar_dates');
const fareAttributes = table('fare_attributes');
const fareRules = table('fare_rules');
const zones = table('farezone_attributes');
const shapes = table('shapes');
const feedInfo = table('feed_info')[0];

// ---------------------------------------------------------------- stations
// GTFS models each station as a parent stop (location_type=1) with two child
// platforms. Odd child ids are northbound, even are southbound.
const platformsByParent = new Map();
for (const s of stops) {
  if (s.location_type !== '0' || !s.parent_station) continue;
  const list = platformsByParent.get(s.parent_station) ?? [];
  list.push(s);
  platformsByParent.set(s.parent_station, list);
}

const stations = stops
  .filter((s) => s.location_type === '1')
  .map((parent) => {
    const platforms = platformsByParent.get(parent.stop_id) ?? [];
    const northbound = platforms.find((p) => /Northbound/i.test(p.stop_name)) ?? platforms[0];
    const southbound = platforms.find((p) => /Southbound/i.test(p.stop_name)) ?? platforms[1];
    // The parent row's zone_id is unreliable in this feed; use the platform's.
    const zoneId = northbound?.zone_id || parent.zone_id;
    return {
      id: parent.stop_id,
      name: parent.stop_name,
      lat: Number(parent.stop_lat),
      lon: Number(parent.stop_lon),
      zoneId,
      northboundStopId: northbound?.stop_id ?? null,
      southboundStopId: southbound?.stop_id ?? null,
      wheelchairBoarding: northbound?.wheelchair_boarding === '1',
    };
  })
  // Order north → south so pickers read like the line map.
  .sort((a, b) => b.lat - a.lat);

// ---------------------------------------------------------------- schedule
const routesOut = Object.fromEntries(
  routes.map((r) => [
    r.route_id,
    {
      id: r.route_id,
      name: r.route_short_name || r.route_long_name || r.route_id,
      color: `#${r.route_color || 'cccccc'}`,
      textColor: `#${r.route_text_color || '000000'}`,
    },
  ])
);

const services = {};
for (const c of calendar) {
  services[c.service_id] = {
    // Sunday-first to match JS Date.getDay()
    weekdays: [c.sunday, c.monday, c.tuesday, c.wednesday, c.thursday, c.friday, c.saturday].map(
      (d) => d === '1'
    ),
    start: c.start_date,
    end: c.end_date,
    added: [],
    removed: [],
  };
}
for (const cd of calendarDates) {
  services[cd.service_id] ??= {
    weekdays: [false, false, false, false, false, false, false],
    start: cd.date,
    end: cd.date,
    added: [],
    removed: [],
  };
  (cd.exception_type === '1' ? services[cd.service_id].added : services[cd.service_id].removed).push(cd.date);
}

const stopTimesByTrip = new Map();
for (const st of stopTimes) {
  const list = stopTimesByTrip.get(st.trip_id) ?? [];
  list.push(st);
  stopTimesByTrip.set(st.trip_id, list);
}

const tripsOut = trips.map((t) => {
  const times = (stopTimesByTrip.get(t.trip_id) ?? []).sort(
    (a, b) => Number(a.stop_sequence) - Number(b.stop_sequence)
  );
  return {
    id: t.trip_id,
    routeId: t.route_id,
    serviceId: t.service_id,
    direction: t.direction_id === '0' ? 'N' : 'S',
    headsign: t.trip_headsign,
    shortName: t.trip_short_name || t.trip_id,
    bikesAllowed: t.bikes_allowed === '1',
    // [stopId, arrivalSeconds, departureSeconds] — seconds after midnight of the
    // service day; may exceed 86400 for trips that run past midnight.
    stops: times.map((st) => [st.stop_id, toSeconds(st.arrival_time), toSeconds(st.departure_time)]),
  };
});

const schedule = {
  feedVersion: feedInfo?.feed_version ?? null,
  feedStart: feedInfo?.feed_start_date ?? null,
  feedEnd: feedInfo?.feed_end_date ?? null,
  generatedAt: new Date().toISOString(),
  routes: routesOut,
  services,
  trips: tripsOut,
};

// ------------------------------------------------------------------- fares
const priceByFare = Object.fromEntries(fareAttributes.map((f) => [f.fare_id, Number(f.price)]));
const transferSeconds = Number(fareAttributes[0]?.transfer_duration ?? 14400);
const fareByZonePair = {};
for (const r of fareRules) {
  if (!r.origin_id || !r.destination_id) continue;
  fareByZonePair[`${r.origin_id}-${r.destination_id}`] = priceByFare[r.fare_id];
}
const fares = {
  currency: fareAttributes[0]?.currency_type ?? 'USD',
  validitySeconds: transferSeconds,
  zones: Object.fromEntries(zones.map((z) => [z.zone_id, z.zone_name])),
  byZonePair: fareByZonePair,
};

// ------------------------------------------------------------------- shape
// Pick the shape with the most points (the full-line alignment) and keep every
// 4th point: plenty for a map polyline, small enough to bundle.
const shapeCounts = new Map();
for (const p of shapes) shapeCounts.set(p.shape_id, (shapeCounts.get(p.shape_id) ?? 0) + 1);
const [longestShapeId] = [...shapeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
const shape = shapes
  .filter((p) => p.shape_id === longestShapeId)
  .sort((a, b) => Number(a.shape_pt_sequence) - Number(b.shape_pt_sequence))
  .filter((_, i, arr) => i % 4 === 0 || i === arr.length - 1)
  .map((p) => ({ latitude: Number(p.shape_pt_lat), longitude: Number(p.shape_pt_lon) }));

// ------------------------------------------------------------------- write
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
write('stations.json', stations);
write('schedule.json', schedule);
write('fares.json', fares);
write('shape.json', shape);
console.log(
  `Done. ${stations.length} stations, ${tripsOut.length} trips, ${stopTimes.length} stop times, feed ${schedule.feedVersion}.`
);

// ----------------------------------------------------------------- helpers
function write(name, value) {
  const path = resolve(outDir, name);
  writeFileSync(path, JSON.stringify(value));
  console.log(`  wrote ${name} (${(readFileSync(path).length / 1024).toFixed(0)} KB)`);
}

function toSeconds(hms) {
  const [h, m, s] = hms.split(':').map(Number);
  return h * 3600 + m * 60 + (s || 0);
}

/** Minimal RFC-4180 CSV parser (handles quoted fields with commas). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0] !== '');
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
