/** Persistence for stop alerts (AsyncStorage, device-local). */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StopAlert {
  notificationId: string;
  tripId: string;
  stationId: string;
  stationName: string;
  arrival: string; // ISO
}

const ALERTS_KEY = 'caltrain.alerts.v1';

async function readList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

async function writeList<T>(key: string, list: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(list));
}

export const loadAlerts = () => readList<StopAlert>(ALERTS_KEY);
export async function saveAlert(alert: StopAlert): Promise<StopAlert[]> {
  const alerts = [alert, ...(await loadAlerts())];
  await writeList(ALERTS_KEY, alerts);
  return alerts;
}
export async function deleteAlert(notificationId: string): Promise<StopAlert[]> {
  const alerts = (await loadAlerts()).filter((a) => a.notificationId !== notificationId);
  await writeList(ALERTS_KEY, alerts);
  return alerts;
}
