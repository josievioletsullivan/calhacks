import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { nearestStation } from '@/lib/gtfs/data';
import type { Station } from '@/lib/gtfs/types';

/** Resolves the closest station to the device once, if location permission is granted. */
export function useNearestStation(): Station | null {
  const [station, setStation] = useState<Station | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (Platform.OS === 'web') return;
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted) return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          setStation(nearestStation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        }
      } catch {
        // Location is a convenience; fall back silently to the default station.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return station;
}
