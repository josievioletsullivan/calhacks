import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, View, useThemeColor } from '@/components/Themed';
import { stations } from '@/lib/gtfs/data';
import type { Station } from '@/lib/gtfs/types';

interface Props {
  label: string;
  value: Station | null;
  onChange: (station: Station) => void;
  placeholder?: string;
}

/** Tappable field that opens a searchable, north-to-south station list. */
export function StationPicker({ label, value, onChange, placeholder = 'Choose a station' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const muted = useThemeColor({}, 'muted');
  const tint = useThemeColor({}, 'tint');
  const text = useThemeColor({}, 'text');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? stations.filter((s) => s.name.toLowerCase().includes(q)) : stations;
  }, [query]);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, { backgroundColor: surface, borderColor: border }]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value?.name ?? placeholder}`}>
        <Text style={[styles.label, { color: muted }]}>{label}</Text>
        <Text style={[styles.value, !value && { color: muted }]}>{value?.name ?? placeholder}</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}>
                <Text style={{ color: tint, fontWeight: '600' }}>Done</Text>
              </Pressable>
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search stations"
              placeholderTextColor={muted}
              autoFocus
              clearButtonMode="while-editing"
              style={[styles.search, { backgroundColor: surface, borderColor: border, color: text }]}
            />
            <FlatList
              data={filtered}
              keyExtractor={(s) => s.id}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: border }]} />}
              renderItem={({ item }) => {
                const selected = item.id === value?.id;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item);
                      setQuery('');
                      setOpen(false);
                    }}
                    style={styles.row}>
                    <Text style={[styles.rowText, selected && { color: tint, fontWeight: '700' }]}>{item.name}</Text>
                    <Text style={{ color: muted, fontSize: 12 }}>Zone {zoneNumber(item)}</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

function zoneNumber(station: Station): string {
  // zone ids are 8178x..8179x; the readable number lives in fares.zones, but
  // for the picker a simple lookup table is enough.
  const map: Record<string, string> = {
    '81790': '1',
    '81791': '2',
    '81789': '3',
    '81792': '4',
    '81793': '5',
    '81794': '6',
  };
  return map[station.zoneId] ?? '?';
}

const styles = StyleSheet.create({
  field: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  label: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 17, fontWeight: '600' },
  sheet: { flex: 1, paddingHorizontal: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  search: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  rowText: { fontSize: 16 },
  separator: { height: StyleSheet.hairlineWidth },
});
