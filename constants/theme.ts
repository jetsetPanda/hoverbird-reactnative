/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

// Per-role accent for primary action buttons, distinct from the tab/icon tint
// above so parents and nannies can tell their own screens apart at a glance.
export const RoleColors = {
  parent: 'rgba(255, 165, 0, 1.00)',
  nanny: tintColorLight,
};

// Icon + color per activity_category, used to make the feed/log screens
// scannable at a glance instead of plain text rows.
export const CategoryStyles: Record<string, { icon: string; color: string }> = {
  meal: { icon: 'restaurant', color: '#E8973C' },
  nap: { icon: 'bedtime', color: '#7B8FD6' },
  play: { icon: 'toys', color: '#4FAE7A' },
  learning: { icon: 'menu-book', color: '#5B8DEF' },
  diaper: { icon: 'child-care', color: '#D87FB0' },
  outdoor: { icon: 'park', color: '#3FA34D' },
  mood: { icon: 'mood', color: '#E0A93E' },
  milestone: { icon: 'star', color: '#D6A53C' },
  other: { icon: 'more-horiz', color: '#9AA1A6' },
};

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const Radii = { sm: 8, md: 12, lg: 16, pill: 999 };

// Bottom padding for scroll content on tab screens so the last items clear
// the floating glass tab bar (68 tall + ~24 bottom offset + breathing room).
export const TabBarClearance = 104;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
