/**
 * Trip planner: pick origin + destination, leave now or arrive by a time, and
 * see direct trains with scheduled times, realtime estimates, and the fare.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { DelayText } from '@/components/DelayText';
import { EmptyState } from '@/components/EmptyState';
import { RouteBadge } from '@/components/RouteBadge';
import { StationPicker } from '@/components/StationPicker';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useTripUpdates } from '@/hooks/useLiveData';
import { useNow } from '@/hooks/useNow';
import type { TripPredictions } from '@/lib/api/tripUpdates';
import { getStation, stations } from '@/lib/gtfs/data';
import { formatPrice, quoteFare } from '@/lib/gtfs/fares';
import { planTrips, type TripOption } from '@/lib/gtfs/planner';
import type { Station } from '@/lib/gtfs/types';
import { formatClock, formatDuration } from '@/lib/time';

type Mode = 'depart' | 'arrive';

interface EstimatedOption extends TripOption {
  estimatedDeparture: Date;
  estimatedArrival: Date;
  delaySeconds: number | null;
  cancelled: boolean;
}

export default function PlanScreen() {
  const [origin, setOrigin] = useState<Station | null>(getStation('san_francisco') ?? stations[0]);
  const [destination, setDestination] = useState<Station | null>(getStation('palo_alto') ?? stations[1]);
  const [mode, setMode] = useState<Mode>('depart');
  // Minutes offset from "now" used when mode === 'arrive'. Starts at +90 min.
  const [arriveOffsetMin, setArriveOffsetMin] = useState(90);
  const now = useNow(30_000);
  const updates = useTripUpdates();

  const targetTime = useMemo(
    () => (mode === 'depart' ? now : new Date(now.getTime() + arriveOffsetMin * 60_000)),
    [mode, now, arriveOffsetMin]
  );

  const options = useMemo<EstimatedOption[]>(() => {
    if (!origin || !destination) return [];
    return planTrips({ origin, destination, at: targetTime, mode, limit: 10 }).map((o) =>
      withEstimates(o, updates.data)
    );
  }, [origin, destination, targetTime, mode, updates.data]);

  const fare = origin && destination ? quoteFare(origin, destination) : null;

  const fastest = useMemo(() => {
    const upcoming = options.filter((o) => !o.cancelled && o.estimatedDeparture.getTime() >= now.getTime());
    return upcoming.length ? upcoming.reduce((a, b) => (tripMinutes(b) < tripMinutes(a) ? b : a)) : null;
  }, [options, now]);

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={options}
        keyExtractor={(o) => `${o.serviceDate}-${o.trip.id}`}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.controls}>
            <StationPicker label="From" value={origin} onChange={setOrigin} />
            <View style={styles.swapRow}>
              <View style={{ flex: 1 }}>
                <StationPicker label="To" value={destination} onChange={setDestination} />
              </View>
              <SwapButton onPress={swap} />
            </View>
            <ModeToggle mode={mode} onChange={setMode} />
            {mode === 'arrive' ? (
              <ArriveByStepper target={targetTime} onStep={(delta) => setArriveOffsetMin((m) => Math.max(15, m + delta))} />
            ) : null}
            <Summary origin={origin} destination={destination} fare={fare} count={options.length} />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={origin?.id === destination?.id ? 'Pick two different stations' : 'No direct trains found'}
            detail={
              mode === 'arrive'
                ? 'Try a later arrival time.'
                : 'Service may have ended for today — check back tomorrow morning.'
            }
          />
        }
        renderItem={({ item }) => (
          <OptionRow option={item} now={now} fare={fare?.price ?? null} fastest={item === fastest} mode={mode} />
        )}
      />
    </View>
  );
}

function withEstimates(option: TripOption, predictions: TripPredictions | null): EstimatedOption {
  const prediction = predictions?.get(option.trip.id);
  const originPrediction = prediction?.stops.get(option.originStopId);
  const destinationPrediction = prediction?.stops.get(option.destinationStopId);
  const estimatedDeparture = originPrediction?.departure ?? originPrediction?.arrival ?? option.scheduledDeparture;
  const estimatedArrival = destinationPrediction?.arrival ?? destinationPrediction?.departure ?? option.scheduledArrival;
  return {
    ...option,
    estimatedDeparture,
    estimatedArrival,
    delaySeconds: originPrediction
      ? Math.round((estimatedDeparture.getTime() - option.scheduledDeparture.getTime()) / 1000)
      : null,
    cancelled: prediction?.cancelled ?? false,
  };
}

function tripMinutes(o: EstimatedOption): number {
  return Math.round((o.estimatedArrival.getTime() - o.estimatedDeparture.getTime()) / 60_000);
}

function OptionRow({
  option,
  now,
  fare,
  fastest,
  mode,
}: {
  option: EstimatedOption;
  now: Date;
  fare: number | null;
  fastest: boolean;
  mode: Mode;
}) {
  const border = useThemeColor({}, 'border');
  const surface = useThemeColor({}, 'surface');
  const muted = useThemeColor({}, 'muted');
  const danger = useThemeColor({}, 'danger');
  const success = useThemeColor({}, 'success');
  const departed = option.estimatedDeparture.getTime() < now.getTime();
  const minutesToLeave = Math.round((option.estimatedDeparture.getTime() - now.getTime()) / 60_000);
  const changed = Math.abs(option.estimatedDeparture.getTime() - option.scheduledDeparture.getTime()) >= 60_000;

  // "Leave now" / "Leave in 12 min" / "Leave at 6:45 PM" — same ladder Maps uses.
  const leaveLabel = departed
    ? 'Departed'
    : minutesToLeave <= 0
      ? 'Leave now'
      : minutesToLeave < 60
        ? `Leave in ${minutesToLeave} min`
        : `Leave at ${formatClock(option.estimatedDeparture)}`;

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/trip/[tripId]',
          params: {
            tripId: option.trip.id,
            serviceDate: option.serviceDate,
            originStopId: option.originStopId,
            destinationStopId: option.destinationStopId,
          },
        })
      }
      style={[styles.card, { borderColor: border, backgroundColor: surface, opacity: departed ? 0.5 : 1 }]}>
      {/* Row 1: duration and arrival — the two numbers a rider actually decides on. */}
      <View style={[styles.cardRow, { backgroundColor: 'transparent' }]}>
        <View style={[styles.cardRow, { gap: 8, backgroundColor: 'transparent' }]}>
          <Text style={styles.duration}>{formatDuration(tripMinutes(option))}</Text>
          {fastest ? (
            <Text style={[styles.pill, { color: success, borderColor: success }]}>Fastest</Text>
          ) : null}
        </View>
        <Text style={styles.arrive}>
          {mode === 'arrive' ? 'Arrives ' : 'Arrive '}
          {formatClock(option.estimatedArrival)}
        </Text>
      </View>

      {/* Row 2: departure → arrival with the delay called out. */}
      <View style={[styles.cardRow, { justifyContent: 'flex-start', gap: 8, backgroundColor: 'transparent' }]}>
        <Text style={[styles.times, { color: muted }]}>
          {formatClock(option.estimatedDeparture)} – {formatClock(option.estimatedArrival)}
        </Text>
        {changed ? (
          <Text style={[styles.strike, { color: muted }]}>
            {formatClock(option.scheduledDeparture)} – {formatClock(option.scheduledArrival)}
          </Text>
        ) : null}
        {option.cancelled ? (
          <Text style={{ color: danger, fontWeight: '700', fontSize: 12 }}>CANCELLED</Text>
        ) : (
          <DelayText delaySeconds={option.delaySeconds} />
        )}
      </View>

      {/* Row 3: when to leave, which train, and the fare. */}
      <View style={[styles.cardRow, { backgroundColor: 'transparent' }]}>
        <View style={[styles.cardRow, { justifyContent: 'flex-start', gap: 8, backgroundColor: 'transparent' }]}>
          <Text style={[styles.leave, departed && { color: muted }]}>{leaveLabel}</Text>
          <Text style={{ color: muted, fontSize: 13 }}>·</Text>
          <RouteBadge route={option.route} compact />
          <Text style={{ color: muted, fontSize: 12 }}>
            #{option.trip.shortName} · {option.stopsBetween === 0 ? 'non-stop' : `${option.stopsBetween} stop${option.stopsBetween === 1 ? '' : 's'}`}
          </Text>
        </View>
        {fare != null ? <Text style={styles.fare}>{formatPrice(fare)}</Text> : null}
      </View>
    </Pressable>
  );
}

function Summary({
  origin,
  destination,
  fare,
  count,
}: {
  origin: Station | null;
  destination: Station | null;
  fare: ReturnType<typeof quoteFare>;
  count: number;
}) {
  const muted = useThemeColor({}, 'muted');
  if (!origin || !destination || !fare) return null;
  return (
    <Text style={{ color: muted, fontSize: 13 }}>
      {count} train{count === 1 ? '' : 's'} · {fare.zonesTravelled} zone{fare.zonesTravelled === 1 ? '' : 's'} ·{' '}
      {formatPrice(fare.price, fare.currency)} adult one-way
    </Text>
  );
}

function SwapButton({ onPress }: { onPress: () => void }) {
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Swap origin and destination"
      style={[styles.swapButton, { backgroundColor: surface, borderColor: border }]}>
      <Text style={{ fontSize: 18 }}>⇅</Text>
    </Pressable>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const surface = useThemeColor({}, 'surface');
  const tint = useThemeColor({}, 'tint');
  const muted = useThemeColor({}, 'muted');
  return (
    <View style={[styles.toggle, { backgroundColor: surface }]}>
      {(['depart', 'arrive'] as Mode[]).map((m) => {
        const active = m === mode;
        return (
          <Pressable key={m} onPress={() => onChange(m)} style={[styles.toggleItem, active && { backgroundColor: tint }]}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#fff' : muted }}>
              {m === 'depart' ? 'Leave now' : 'Arrive by'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ArriveByStepper({ target, onStep }: { target: Date; onStep: (deltaMinutes: number) => void }) {
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const muted = useThemeColor({}, 'muted');
  return (
    <View style={[styles.stepper, { backgroundColor: surface, borderColor: border }]}>
      <Pressable onPress={() => onStep(-15)} hitSlop={8} style={styles.stepBtn}>
        <Text style={styles.stepBtnText}>−15</Text>
      </Pressable>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: muted, fontSize: 12 }}>Arrive by</Text>
        <Text style={{ fontSize: 20, fontWeight: '700' }}>{formatClock(target)}</Text>
      </View>
      <Pressable onPress={() => onStep(15)} hitSlop={8} style={styles.stepBtn}>
        <Text style={styles.stepBtnText}>+15</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingBottom: 24 },
  controls: { padding: 16, gap: 12 },
  swapRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swapButton: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  toggle: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  toggleItem: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, padding: 8 },
  stepBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  stepBtnText: { fontSize: 16, fontWeight: '700' },
  card: { marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  duration: { fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  arrive: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  times: { fontSize: 14, fontVariant: ['tabular-nums'] },
  strike: { fontSize: 12, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] },
  leave: { fontSize: 14, fontWeight: '600' },
  fare: { fontSize: 14, fontWeight: '700' },
  pill: { fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
});
