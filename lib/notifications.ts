/**
 * "Upcoming stop" alerts. Schedules a local notification a few minutes before
 * the train is predicted to reach the rider's stop.
 *
 * Notifications need a physical device; Expo Go on iOS no longer supports
 * remote push, but local scheduled notifications still work.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

export const DEFAULT_LEAD_MINUTES = 3;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('stops', {
      name: 'Upcoming stops',
      importance: AndroidImportance.HIGH,
    });
  }
  return requested.granted;
}

export interface StopAlertInput {
  tripId: string;
  stationName: string;
  arrival: Date;
  leadMinutes?: number;
}

/**
 * Schedule an alert `leadMinutes` before `arrival`. Returns the notification id
 * (so it can be cancelled) or null if the alert time has already passed.
 */
export async function scheduleStopAlert({
  tripId,
  stationName,
  arrival,
  leadMinutes = DEFAULT_LEAD_MINUTES,
}: StopAlertInput): Promise<string | null> {
  const fireAt = new Date(arrival.getTime() - leadMinutes * 60_000);
  if (fireAt.getTime() <= Date.now()) return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: `${stationName} in ${leadMinutes} min`,
      body: `Train ${tripId} is approaching ${stationName}. Gather your things!`,
      sound: true,
      data: { tripId, stationName },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
      channelId: Platform.OS === 'android' ? 'stops' : undefined,
    },
  });
}

export async function cancelStopAlert(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
