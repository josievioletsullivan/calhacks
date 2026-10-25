/**
 * Map: the Caltrain alignment, every station, and live train positions from
 * the 511 GTFS-Realtime VehiclePositions feed.
 */
import { router } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useVehiclePositions } from '@/hooks/useLiveData';
import { getRoute, lineShape, stations } from '@/lib/gtfs/data';
import { formatClock } from '@/lib/time';

// react-native-maps has no web implementation; load it lazily so the web
// bundle doesn't fail to resolve native modules.
const Maps =
  Platform.OS === 'web'
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('react-native-maps') as typeof import('react-native-maps'));

const INITIAL_REGION = {
  latitude: 37.45,
  longitude: -122.15,
  latitudeDelta: 1.1,
  longitudeDelta: 0.9,
};

export default function MapScreen() {
  const vehicles = useVehiclePositions();
  const tint = useThemeColor({}, 'tint');
  const muted = useThemeColor({}, 'muted');

  if (!Maps) {
    return (
      <EmptyState
        title="Map is available on iOS and Android"
        detail="Open the app in Expo Go or a development build to see live train positions."
      />
    );
  }
  const { default: MapView, Marker, Polyline } = Maps;

  return (
    <View style={styles.screen}>
      <MapView style={styles.map} initialRegion={INITIAL_REGION} showsUserLocation>
        <Polyline coordinates={lineShape} strokeColor={tint} strokeWidth={3} />
        {stations.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat, longitude: s.lon }}
            title={s.name}
            description={`Zone ${s.zoneId}`}
            pinColor="#555"
            onCalloutPress={() => router.push('/')}
          />
        ))}
        {(vehicles.data ?? []).map((v) => {
          const route = getRoute(v.routeId);
          return (
            <Marker
              key={v.vehicleId}
              coordinate={{ latitude: v.latitude, longitude: v.longitude }}
              title={`Train ${v.tripId} · ${route.name}`}
              description={`${v.direction === 'N' ? 'Northbound' : 'Southbound'}${v.updatedAt ? ` · seen ${formatClock(v.updatedAt)}` : ''}`}
              onCalloutPress={() => router.push({ pathname: '/trip/[tripId]', params: { tripId: v.tripId } })}
              anchor={{ x: 0.5, y: 0.5 }}>
              <View style={[styles.train, { backgroundColor: route.color, borderColor: '#fff' }]}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: route.textColor }}>
                  {v.direction === 'N' ? '▲' : '▼'}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>
      <View style={styles.status} lightColor="rgba(255,255,255,0.9)" darkColor="rgba(0,0,0,0.75)">
        <Text style={{ fontSize: 12, color: muted }}>
          {vehicles.error
            ? vehicles.error.message
            : vehicles.data
              ? `${vehicles.data.length} train${vehicles.data.length === 1 ? '' : 's'} running · updated ${vehicles.updatedAt ? formatClock(vehicles.updatedAt) : ''}`
              : 'Loading live train positions…'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  map: { flex: 1 },
  train: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
