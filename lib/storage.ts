/** Persistence for tickets and stop alerts (AsyncStorage, device-local). */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Ticket {
  id: string;
  originId: string;
  destinationId: string;
  price: number;
  currency: string;
  zonesTravelled: number;
  purchasedAt: string; // ISO
  validUntil: string; // ISO
  /** Short code shown on the ticket; demo only — not a real fare product. */
  code: string;
}

export interface StopAlert {
  notificationId: string;
  tripId: string;
  stationId: string;
  stationName: string;
  arrival: string; // ISO
}

const TICKETS_KEY = 'caltrain.tickets.v1';
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

export const loadTickets = () => readList<Ticket>(TICKETS_KEY);
export async function saveTicket(ticket: Ticket): Promise<Ticket[]> {
  const tickets = [ticket, ...(await loadTickets())];
  await writeList(TICKETS_KEY, tickets);
  return tickets;
}
export async function deleteTicket(id: string): Promise<Ticket[]> {
  const tickets = (await loadTickets()).filter((t) => t.id !== id);
  await writeList(TICKETS_KEY, tickets);
  return tickets;
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

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
