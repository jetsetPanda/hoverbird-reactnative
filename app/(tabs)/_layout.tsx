import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';

import { GlassTabButton } from '@/components/glass-tab-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: GlassTabButton,
        // Floating "iOS glass" pill: content scrolls underneath (the bar is
        // absolutely positioned) and shows through the translucent fill.
        // True backdrop blur needs expo-blur (a native module — dev-client
        // rebuild); until then the frosted fill + light edge + soft shadow
        // carry the effect, which is also the cheaper path on Android.
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        tabBarActiveBackgroundColor: 'rgba(255, 255, 255, 0.9)',
        tabBarLabelStyle: styles.tabLabel,
      }}>
        <Tabs.Screen
        name="index"
        options={{
        title: 'Activity',
        tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
        />
        <Tabs.Screen
            name="family"
            options={{
                title: 'Family',
                tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
            }}
        />
        <Tabs.Screen
            name="info"
            options={{
                title: 'Account',
                tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.crop.circle.fill" color={color} />,
            }}
        />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    marginHorizontal: 16,
    bottom: Platform.select({ ios: 24, default: 16 }),
    height: 68,
    borderRadius: 20,
    // iOS renders softer, continuous "squircle" corners like native controls.
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
    // Soft drop shadow (elevation drives it on Android).
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    paddingBottom: 0,
  },
  tabItem: {
    marginVertical: 8,
    marginHorizontal: 8,
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
