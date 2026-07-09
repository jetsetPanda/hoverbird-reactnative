import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { Animated } from 'react-native';

// Tab button with the iOS "glass" press feel: scales to 0.95 while pressed
// (with a light haptic on iOS) and springs back on release. The glass look
// itself (translucent fill, border, shadow) lives on the tab bar styles in
// app/(tabs)/_layout.tsx.
export function GlassTabButton(props: BottomTabBarButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressTo = (value: number) =>
    Animated.spring(scale, {
      toValue: value,
      speed: 40,
      bounciness: 6,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <PlatformPressable
        {...props}
        onPressIn={(ev) => {
          pressTo(0.95);
          if (process.env.EXPO_OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          props.onPressIn?.(ev);
        }}
        onPressOut={(ev) => {
          pressTo(1);
          props.onPressOut?.(ev);
        }}
      />
    </Animated.View>
  );
}
