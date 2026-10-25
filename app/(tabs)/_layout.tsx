import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

type IconName = SymbolViewProps['name'];

function tabIcon(name: IconName) {
  function TabIcon({ color }: { color: ColorValue }) {
    return <SymbolView name={name} tintColor={color} size={26} />;
  }
  return TabIcon;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        tabBarInactiveTintColor: Colors[colorScheme].tabIconDefault,
        // Disable the static render of the header on web to prevent a hydration error.
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen name="index" options={{ title: 'Schedule', tabBarIcon: tabIcon({ ios: 'clock', android: 'schedule', web: 'schedule' }) }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarIcon: tabIcon({ ios: 'point.topleft.down.to.point.bottomright.curvepath', android: 'route', web: 'route' }) }} />
      <Tabs.Screen name="tickets" options={{ title: 'Tickets', tabBarIcon: tabIcon({ ios: 'ticket', android: 'confirmation_number', web: 'confirmation_number' }) }} />
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: tabIcon({ ios: 'map', android: 'map', web: 'map' }) }} />
    </Tabs>
  );
}
