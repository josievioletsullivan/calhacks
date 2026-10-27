/**
 * Trip detail: every stop on a train with scheduled and predicted times, plus
 * a bell on each stop to get an "upcoming stop" notification.
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet } from 'react-native';

import { DelayText } from '@/components/DelayText';
import { EmptyState } from '@/components/EmptyState';
import { RouteBadge } from '@/components/RouteBadge';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useTripUpdates } from '@/hooks/useLiveData';
import { useNow } from '@/hooks/useNow';
import { getRoute, getStationForStop, getTrip } from '@/lib/gtfs/data';
import { relevantServiceDates, serviceTimeToDate } from '@/lib/gtfs/service';
import { cancelStopAlert, DEFAULT_LEAD_MINUTES, ensureNotificationPermission, scheduleStopAlert } from '@/lib/notifications';
import { deleteAlert, loadAlerts, saveAlert, type StopAlert } from '@/lib/storage';
import { formatClock, formatCountdown } from '@/lib/time';

interface StopRow {
  stopId: string;
  stationId: string;
  stationName: string;
  scheduledArrival: Date;
  scheduledDeparture: Date;
  predictedArrival: Date | null;
  delaySeconds: number | null;
  isOrigin: boolean;
  isDestination: boolean;
  inSegment: boolean;
}

export default function TripScreen() {
  const params = useLocalSearchParams<{
    tripId: string;
    serviceDate?: string;
    originStopId?: string;
    destinationStopId?: string;
  }>();
  const trip = getTrip(params.tripId);
  const now = useNow();
  const updates = useTripUpdates();
  const [alerts, setAlerts] = useState<StopAlert[]>([]);
  const tint = useThemeColor({}, 'tint');
  const muted = useThemeColor({}, 'muted');
  const border = useThemeColor({}, 'border');

  useEffect(() => {
    loadAlerts().then(setAlerts);
  }, []);

  // Trips launched from the map have no service date; assume today.
  const serviceDate = params.serviceDate ?? relevantServiceDates(now)[1];

  const rows = useMemo<StopRow[]>(() => {
    if (!trip) return [];
    const prediction = updates.data?.get(trip.id);
    const originIdx = trip.stops.findIndex(([id]) => id === params.originStopId);
    const destIdx = trip.stops.findIndex(([id]) => id === params.destinationStopId);
    return trip.stops.map(([stopId, arr, dep], i) => {
      const station = getStationForStop(stopId);
      const scheduledArrival = serviceTimeToDate(serviceDate, arr);
      const predicted = prediction?.stops.get(stopId);
      const predictedArrival = predicted?.arrival ?? predicted?.departure ?? null;
      return {
        stopId,
        stationId: station?.id ?? stopId,
        stationName: station?.name ?? stopId,
        scheduledArrival,
        scheduledDeparture: serviceTimeToDate(serviceDate, dep),
        predictedArrival,
        delaySeconds: predictedArrival ? Math.round((predictedArrival.getTime() - scheduledArrival.getTime()) / 1000) : null,
        isOrigin: i === originIdx,
        isDestination: i === destIdx,
        inSegment: originIdx >= 0 && destIdx >= 0 ? i >= originIdx && i <= destIdx : true,
      };
    });
  }, [trip, serviceDate, updates.data, params.originStopId, params.destinationStopId]);

  const toggleAlert = useCallback(
    async (row: StopRow) => {
      if (!trip) return;
      const existing = alerts.find((a) => a.tripId === trip.id && a.stationId === row.stationId);
      if (existing) {
        await cancelStopAlert(existing.notificationId);
        setAlerts(await deleteAlert(existing.notificationId));
        return;
      }
      const granted = await ensureNotificationPermission();
      if (!granted) {
        Alert.alert('Notifications are off', 'Enable notifications for Caltrain in Settings to get stop alerts.');
        return;
      }
      const arrival = row.predictedArrival ?? row.scheduledArrival;
      const id = await scheduleStopAlert({ tripId: trip.shortName, stationName: row.stationName, arrival });
      if (!id) {
        Alert.alert('Too late to alert', `This train reaches ${row.stationName} in under ${DEFAULT_LEAD_MINUTES} minutes.`);
        return;
      }
      setAlerts(
        await saveAlert({
          notificationId: id,
          tripId: trip.id,
          stationId: row.stationId,
          stationName: row.stationName,
          arrival: arrival.toISOString(),
        })
      );
    },
    [alerts, trip]
  );

  if (!trip) {
    return <EmptyState title="Trip not found" detail={`No trip ${params.tripId} in the bundled schedule. Run npm run gtfs to refresh.`} />;
  }

  const route = getRoute(trip.routeId);
  const prediction = updates.data?.get(trip.id);

  return (
    <>
      <Stack.Screen options={{ title: `Train ${trip.shortName}` }} />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.stopId}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <RouteBadge route={route} />
              <Text style={styles.headsign}>to {trip.headsign}</Text>
            </View>
            <Text style={{ color: muted, fontSize: 13 }}>
              {trip.direction === 'N' ? 'Northbound' : 'Southbound'} · {trip.stops.length} stops
              {trip.bikesAllowed ? ' · bikes allowed' : ''}
            </Text>
            <Text style={{ color: muted, fontSize: 13 }}>
              {prediction
                ? `Live · updated ${prediction.updatedAt ? formatClock(prediction.updatedAt) : 'just now'}`
                : updates.loading
                  ? 'Loading live data…'
                  : 'No live data for this train yet — showing schedule.'}
            </Text>
            <Text style={{ color: muted, fontSize: 12, marginTop: 4 }}>
              Tap the alert button on a stop to be notified {DEFAULT_LEAD_MINUTES} minutes before arrival.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const armed = alerts.some((a) => a.tripId === trip.id && a.stationId === item.stationId);
          const eta = item.predictedArrival ?? item.scheduledArrival;
          const past = eta.getTime() < now.getTime() - 60_000;
          const isLast = index === rows.length - 1;
          return (
            <View style={[styles.row, { opacity: item.inSegment ? 1 : 0.45 }]}>
              <View style={styles.timeline}>
                <View style={[styles.dot, { borderColor: tint, backgroundColor: item.isOrigin || item.isDestination ? tint : 'transparent' }]} />
                {!isLast ? <View style={[styles.line, { backgroundColor: border }]} /> : null}
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.station, (item.isOrigin || item.isDestination) && { fontWeight: '800' }]}>{item.stationName}</Text>
                <View style={styles.timeRow}>
                  <Text style={[styles.time, item.delaySeconds != null && Math.abs(item.delaySeconds) >= 60 && styles.strike, { color: past ? muted : undefined }]}>
                    {formatClock(item.scheduledArrival)}
                  </Text>
                  {item.predictedArrival && item.delaySeconds != null && Math.abs(item.delaySeconds) >= 60 ? (
                    <Text style={styles.time}>{formatClock(item.predictedArrival)}</Text>
                  ) : null}
                  <DelayText delaySeconds={item.delaySeconds} />
                  {!past ? <Text style={{ color: muted, fontSize: 12 }}>· {formatCountdown(eta, now)}</Text> : null}
                </View>
              </View>
              {!past ? (
                <Pressable
                  onPress={() => toggleAlert(item)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={armed ? `Cancel alert for ${item.stationName}` : `Alert me before ${item.stationName}`}
                  style={[styles.bell, { borderColor: armed ? tint : border, backgroundColor: armed ? tint : 'transparent' }]}>
                  <SymbolView
                    name={armed ? { ios: 'bell.fill', android: 'notifications_active', web: 'notifications_active' } : { ios: 'bell', android: 'notifications', web: 'notifications' }}
                    tintColor={armed ? '#fff' : muted}
                    size={18}
                  />
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 32 },
  header: { padding: 16, gap: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headsign: { fontSize: 20, fontWeight: '700' },
  row: { flexDirection: 'row', paddingHorizontal: 16, minHeight: 64 },
  timeline: { width: 24, alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, marginTop: 4 },
  line: { flex: 1, width: 2, marginTop: 2 },
  rowBody: { flex: 1, paddingLeft: 12, paddingBottom: 18, gap: 4 },
  station: { fontSize: 16, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  time: { fontSize: 14, fontVariant: ['tabular-nums'] },
  strike: { textDecorationLine: 'line-through' },
  bell: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
