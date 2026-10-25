/**
 * Schedule: live departures from one station.
 * Scheduled trips come from the bundled GTFS; realtime predictions from 511
 * StopMonitoring are merged in by trip id.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';

import { DelayText } from '@/components/DelayText';
import { EmptyState } from '@/components/EmptyState';
import { RouteBadge } from '@/components/RouteBadge';
import { StationPicker } from '@/components/StationPicker';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useLiveDepartures } from '@/hooks/useLiveData';
import { useNearestStation } from '@/hooks/useNearestStation';
import { useNow } from '@/hooks/useNow';
import type { LiveDeparture } from '@/lib/api/stopMonitoring';
import { getStation, stations } from '@/lib/gtfs/data';
import { scheduledDeparturesAt, type ScheduledDeparture } from '@/lib/gtfs/planner';
import type { Direction, Station } from '@/lib/gtfs/types';
import { formatClock, formatCountdown } from '@/lib/time';

type DirectionFilter = Direction | 'ALL';

interface DepartureRow extends ScheduledDeparture {
  live: LiveDeparture | null;
  /** Best known departure: realtime if available, else scheduled. */
  expectedDeparture: Date;
}

const DEFAULT_STATION = getStation('san_francisco') ?? stations[0];

export default function ScheduleScreen() {
  const nearest = useNearestStation();
  const [pickedStation, setPickedStation] = useState<Station | null>(null);
  const [direction, setDirection] = useState<DirectionFilter>('ALL');
  const now = useNow();
  // Until the rider picks a station, follow the nearest one as location resolves.
  const station = pickedStation ?? nearest ?? DEFAULT_STATION;

  const platformIds = useMemo(
    () => [station.northboundStopId, station.southboundStopId].filter((id): id is string => !!id),
    [station]
  );
  const live = useLiveDepartures(platformIds);

  const rows = useMemo<DepartureRow[]>(() => {
    const liveByTrip = new Map((live.data ?? []).map((d) => [d.tripId, d]));
    return scheduledDeparturesAt(station, now, 40)
      .filter((d) => direction === 'ALL' || d.direction === direction)
      .map((d) => {
        const match = liveByTrip.get(d.trip.id) ?? null;
        return { ...d, live: match, expectedDeparture: match?.expectedDeparture ?? d.scheduledDeparture };
      })
      // Drop trains that have already left according to realtime.
      .filter((d) => d.expectedDeparture.getTime() > now.getTime() - 60_000)
      .sort((a, b) => a.expectedDeparture.getTime() - b.expectedDeparture.getTime())
      .slice(0, 20);
  }, [station, direction, now, live.data]);

  return (
    <View style={styles.screen}>
      <View style={styles.controls}>
        <StationPicker
          label="Station"
          value={station}
          onChange={setPickedStation}
        />
        <DirectionToggle value={direction} onChange={setDirection} />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => `${r.serviceDate}-${r.trip.id}`}
        refreshControl={<RefreshControl refreshing={live.loading && !!live.data} onRefresh={live.refresh} />}
        ListEmptyComponent={
          <EmptyState
            title={live.loading && !live.data ? 'Loading departures…' : 'No departures in the next 3 hours'}
            detail={live.error ? live.error.message : 'Try the other direction or another station.'}
            loading={live.loading && !live.data}
          />
        }
        ListFooterComponent={<Footer updatedAt={live.updatedAt} error={live.error} />}
        renderItem={({ item }) => <DepartureListItem row={item} now={now} />}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

function DepartureListItem({ row, now }: { row: DepartureRow; now: Date }) {
  const border = useThemeColor({}, 'border');
  const muted = useThemeColor({}, 'muted');
  const isDelayed = row.live?.delaySeconds != null && row.live.delaySeconds >= 60;
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/trip/[tripId]',
          params: { tripId: row.trip.id, serviceDate: row.serviceDate, originStopId: row.stopId },
        })
      }
      style={[styles.row, { borderBottomColor: border }]}>
      <View style={styles.rowLeft}>
        <View style={styles.rowTop}>
          <RouteBadge route={row.route} compact />
          <Text style={[styles.tripNo, { color: muted }]}>#{row.trip.shortName}</Text>
          <Text style={{ color: muted, fontSize: 12 }}>{row.direction === 'N' ? 'Northbound' : 'Southbound'}</Text>
        </View>
        <Text style={styles.headsign}>to {row.headsign}</Text>
        <View style={styles.rowTop}>
          <Text style={[styles.time, isDelayed && styles.strike, { color: isDelayed ? muted : undefined }]}>
            {formatClock(row.scheduledDeparture)}
          </Text>
          {isDelayed ? <Text style={styles.time}>{formatClock(row.expectedDeparture)}</Text> : null}
          <DelayText delaySeconds={row.live ? row.live.delaySeconds : null} />
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.countdown}>{formatCountdown(row.expectedDeparture, now)}</Text>
        {row.live ? <LiveDot /> : null}
      </View>
    </Pressable>
  );
}

function LiveDot() {
  const success = useThemeColor({}, 'success');
  return (
    <View style={styles.liveWrap}>
      <View style={[styles.liveDot, { backgroundColor: success }]} />
      <Text style={{ fontSize: 11, color: success, fontWeight: '600' }}>LIVE</Text>
    </View>
  );
}

function DirectionToggle({ value, onChange }: { value: DirectionFilter; onChange: (v: DirectionFilter) => void }) {
  const surface = useThemeColor({}, 'surface');
  const tint = useThemeColor({}, 'tint');
  const muted = useThemeColor({}, 'muted');
  const options: { key: DirectionFilter; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'N', label: 'Northbound' },
    { key: 'S', label: 'Southbound' },
  ];
  return (
    <View style={[styles.toggle, { backgroundColor: surface }]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.toggleItem, active && { backgroundColor: tint }]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}>
            <Text style={[styles.toggleText, { color: active ? '#fff' : muted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Footer({ updatedAt, error }: { updatedAt: Date | null; error: Error | null }) {
  const muted = useThemeColor({}, 'muted');
  const danger = useThemeColor({}, 'danger');
  return (
    <View style={styles.footer}>
      {error ? <Text style={{ color: danger, fontSize: 12, textAlign: 'center' }}>{error.message}</Text> : null}
      <Text style={{ color: muted, fontSize: 12, textAlign: 'center' }}>
        {updatedAt ? `Live data updated ${formatClock(updatedAt)} · refreshes every minute` : 'Showing scheduled times'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  controls: { padding: 16, gap: 12 },
  list: { paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rowLeft: { flex: 1, gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tripNo: { fontSize: 12, fontVariant: ['tabular-nums'] },
  headsign: { fontSize: 16, fontWeight: '600' },
  time: { fontSize: 15, fontVariant: ['tabular-nums'] },
  strike: { textDecorationLine: 'line-through' },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  countdown: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  liveWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  toggle: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  toggleItem: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  toggleText: { fontSize: 13, fontWeight: '600' },
  footer: { padding: 16, gap: 4 },
});
