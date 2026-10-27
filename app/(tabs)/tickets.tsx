/**
 * My tickets: a device-local wallet of tickets. Nothing here talks to a
 * payment provider; tickets are demo records kept in AsyncStorage.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useNow } from '@/hooks/useNow';
import { getStation } from '@/lib/gtfs/data';
import { formatPrice } from '@/lib/gtfs/fares';
import { deleteTicket, loadTickets, type Ticket } from '@/lib/storage';
import { formatClock, formatCountdown } from '@/lib/time';

export default function TicketsScreen() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const now = useNow(30_000);

  useFocusEffect(
    useCallback(() => {
      loadTickets().then(setTickets);
    }, [])
  );

  const remove = (ticket: Ticket) => {
    Alert.alert('Remove ticket?', 'This only removes it from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => setTickets(await deleteTicket(ticket.id)) },
    ]);
  };

  return (
    <FlatList
      data={tickets}
      keyExtractor={(t) => t.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<Text style={styles.sectionTitle}>My tickets</Text>}
      ListEmptyComponent={
        <EmptyState
          title="No tickets yet"
          detail="Tickets you add will show up here with their expiry and code."
        />
      }
      renderItem={({ item }) => <TicketCard ticket={item} now={now} onLongPress={() => remove(item)} />}
    />
  );
}

function TicketCard({ ticket, now, onLongPress }: { ticket: Ticket; now: Date; onLongPress: () => void }) {
  const border = useThemeColor({}, 'border');
  const surface = useThemeColor({}, 'surface');
  const muted = useThemeColor({}, 'muted');
  const success = useThemeColor({}, 'success');
  const tint = useThemeColor({}, 'tint');
  const validUntil = new Date(ticket.validUntil);
  const active = validUntil.getTime() > now.getTime();
  const origin = getStation(ticket.originId)?.name ?? ticket.originId;
  const destination = getStation(ticket.destinationId)?.name ?? ticket.destinationId;

  return (
    <Pressable onLongPress={onLongPress} style={[styles.ticket, { borderColor: border, backgroundColor: surface, opacity: active ? 1 : 0.55 }]}>
      <View style={[styles.ticketStripe, { backgroundColor: active ? tint : muted }]} />
      <View style={styles.ticketBody}>
        <View style={styles.ticketHeader}>
          <Text style={styles.ticketRoute}>
            {origin} → {destination}
          </Text>
          <Text style={{ color: active ? success : muted, fontWeight: '700', fontSize: 12 }}>
            {active ? 'VALID' : 'EXPIRED'}
          </Text>
        </View>
        <Text style={{ color: muted, fontSize: 13 }}>
          {ticket.zonesTravelled} zone{ticket.zonesTravelled === 1 ? '' : 's'} · {formatPrice(ticket.price, ticket.currency)} · bought{' '}
          {formatClock(new Date(ticket.purchasedAt))}
        </Text>
        <Text style={{ color: muted, fontSize: 13 }}>
          {active ? `Expires in ${formatCountdown(validUntil, now)}` : `Expired ${formatClock(validUntil)}`}
        </Text>
        <Text style={styles.code}>{ticket.code}</Text>
        <Text style={{ color: muted, fontSize: 11 }}>Long-press to remove</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  ticket: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  ticketStripe: { width: 8 },
  ticketBody: { flex: 1, gap: 6, paddingRight: 14, paddingBottom: 12, paddingLeft: 12 },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 },
  ticketRoute: { fontSize: 16, fontWeight: '700', flex: 1, paddingRight: 8 },
  code: { fontFamily: 'SpaceMono', fontSize: 18, letterSpacing: 2, paddingVertical: 4 },
});
