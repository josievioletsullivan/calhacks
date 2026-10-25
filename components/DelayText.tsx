import { Text, useThemeColor } from '@/components/Themed';
import { formatDelay } from '@/lib/time';

/** "on time" / "+4 min" / "scheduled", colored by severity. */
export function DelayText({ delaySeconds, style }: { delaySeconds: number | null | undefined; style?: object }) {
  const success = useThemeColor({}, 'success');
  const warning = useThemeColor({}, 'warning');
  const danger = useThemeColor({}, 'danger');
  const muted = useThemeColor({}, 'muted');
  const minutes = delaySeconds == null ? null : Math.round(delaySeconds / 60);
  const color =
    minutes == null ? muted : minutes <= 0 ? success : minutes < 10 ? warning : danger;
  return <Text style={[{ color, fontSize: 13, fontWeight: '600' }, style]}>{formatDelay(delaySeconds)}</Text>;
}
