import { ActivityIndicator, StyleSheet } from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';

interface Props {
  title: string;
  detail?: string;
  loading?: boolean;
}

export function EmptyState({ title, detail, loading }: Props) {
  const muted = useThemeColor({}, 'muted');
  return (
    <View style={styles.wrap}>
      {loading ? <ActivityIndicator /> : null}
      <Text style={styles.title}>{title}</Text>
      {detail ? <Text style={[styles.detail, { color: muted }]}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 8 },
  title: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  detail: { fontSize: 14, textAlign: 'center' },
});
