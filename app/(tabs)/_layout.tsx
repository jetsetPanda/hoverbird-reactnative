import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';

import { GlassTabButton } from '@/components/glass-tab-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ContentMaxWidth } from '@/constants/theme';
import { useThemeColors } from '@/hooks/use-theme-color';

export default function TabLayout() {
  const c = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.tint,
        headerShown: false,
        tabBarButton: GlassTabButton,
        // Floating "iOS glass" pill: content scrolls underneath (the bar is
        // absolutely positioned) and shows through the translucent fill.
        // True backdrop blur needs expo-blur (a native module — dev-client
        // rebuild); until then the frosted fill + light edge + soft shadow
        // carry the effect. Glass colors are themed (dark glass in dark mode).
        tabBarStyle: [
          styles.tabBar,
          { backgroundColor: c.glassBg, borderColor: c.glassBorder, borderTopColor: c.glassBorder },
          Platform.OS === 'web' && styles.tabBarWeb,
        ],
        tabBarItemStyle: styles.tabItem,
        tabBarActiveBackgroundColor: c.glassActive,
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
    // background + border colors are themed inline (glassBg / glassBorder).
    borderWidth: 1,
    borderTopWidth: 1,
    // Soft drop shadow (elevation drives it on Android).
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    paddingBottom: 0,
  },
  // Web only: an absolutely-positioned element can't be centered with
  // alignSelf, so pin both edges and use auto side margins to center a pill
  // capped at the content width (instead of stretching across the desktop
  // viewport). left/right:16 keeps a 16px edge gap on mobile-web viewports
  // narrower than the cap (where the auto margins would otherwise collapse to
  // 0); above the cap the auto margins center the pill. Overrides the native
  // marginHorizontal:16 on web only.
  tabBarWeb: {
    left: 16,
    right: 16,
    marginHorizontal: 'auto',
    maxWidth: ContentMaxWidth,
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
