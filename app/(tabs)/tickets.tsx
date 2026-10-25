/**
 * My tickets: buy a (demo) zone ticket and keep it on the device.
 * Fares come from GTFS fare_rules; nothing here talks to a payment provider.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { StationPicker } from '@/components/StationPicker';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useNow } from '@/hooks/useNow';
import { getStation, stations } from '@/lib/gtfs/data';
import { formatPrice, quoteFare } from '@/lib/gtfs/fares';
import type { Station } from '@/lib/gtfs/types';
import { deleteTicket, loadTickets, newId, saveTicket, type Ticket } from '@/lib/storage';
import { formatClock, formatCountdown } from '@/lib/time';

export default function TicketsScreen() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [origin, setOrigin] = useState<Station | null>(getStation('san_francisco') ?? stations[0]);
  const [destination, setDestination] = useState<Station | null>(getStation('palo_alto') ?? stations[1]);
  const now = useNow(30_000);
  const tint = useThemeColor({}, 'tint');
  const muted = useThemeColor({}, 'muted');

  useFocusEffect(
    useCallback(() => {
      loadTickets().then(setTickets);
    }, [])
  );

  const fare = origin && destination && origin.id !== destination.id ? quoteFare(origin, destination) : null;

  const buy = async () => {
    if (!origin || !destination || !fare) return;
    const purchasedAt = new Date();
    const ticket: Ticket = {
      id: newId(),
      originId: origin.id,
      destinationId: destination.id,
      price: fare.price,
      currency: fare.currency,
      zonesTravelled: fare.zonesTravelled,
      purchasedAt: purchasedAt.toISOString(),
      validUntil: new Date(purchasedAt.getTime() + fare.validitySeconds * 1000).toISOString(),
      code: ticketCode(),
    };
    setTickets(await saveTicket(ticket));
  };

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
      ListHeaderComponent={
        <View style={styles.buyBox}>
          <Text style={styles.sectionTitle}>Buy a ticket</Text>
          <StationPicker label="From" value={origin} onChange={setOrigin} />
          <StationPicker label="To" value={destination} onChange={setDestination} />
          <View style={styles.quoteRow}>
            <View>
              <Text style={{ color: muted, fontSize: 12 }}>Adult one-way</Text>
              <Text style={styles.price}>{fare ? formatPrice(fare.price, fare.currency) : '—'}</Text>
              {fare ? (
                <Text style={{ color: muted, fontSize: 12 }}>
                  {fare.zonesTravelled} zone{fare.zonesTravelled === 1 ? '' : 's'} · valid {Math.round(fare.validitySeconds / 3600)} hours
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={buy}
              disabled={!fare}
              style={[styles.buyButton, { backgroundColor: tint, opacity: fare ? 1 : 0.4 }]}
              accessibilityRole="button">
              <Text style={styles.buyButtonText}>Buy</Text>
            </Pressable>
          </View>
          <Text style={{ color: muted, fontSize: 11 }}>
            Demo only: tickets are stored on this device and are not valid for travel. Use Clipper or the official Caltrain app to pay.
          </Text>
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>My tickets</Text>
        </View>
      }
      ListEmptyComponent={<EmptyState title="No tickets yet" detail="Buy one above and it will appear here." />}
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

function ticketCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CT-';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32 },
  buyBox: { gap: 12, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { fontSize: 28, fontWeight: '800' },
  buyButton: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  buyButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  ticket: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  ticketStripe: { width: 8 },
  ticketBody: { flex: 1, gap: 6, paddingRight: 14, paddingBottom: 12, paddingLeft: 12 },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 },
  ticketRoute: { fontSize: 16, fontWeight: '700', flex: 1, paddingRight: 8 },
  code: { fontFamily: 'SpaceMono', fontSize: 18, letterSpacing: 2, paddingVertical: 4 },
});
