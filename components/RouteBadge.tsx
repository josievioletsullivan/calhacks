import { StyleSheet, Text } from 'react-native';

import type { Route } from '@/lib/gtfs/types';

/** Colored pill with the service type (Local, Limited, Express…). */
export function RouteBadge({ route, compact = false }: { route: Route; compact?: boolean }) {
  const label = route.name.replace(/ Week(day|end)$/, '');
  return (
    <Text
      style={[
        styles.badge,
        compact && styles.compact,
        { backgroundColor: route.color, color: route.textColor },
      ]}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  compact: { fontSize: 10, paddingHorizontal: 6, paddingVertical: 2 },
});
