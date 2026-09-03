/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#4db8d8'; // lighter teal so links/active tint read on dark

// Semantic color tokens with light + dark values. Read them at render time via
// `useThemeColors()` (hooks/use-theme-color.ts) so screens adapt to the active
// scheme — StyleSheet.create can't, so per-screen styles take colors from here.
// Accent BUTTON colors (RoleColors), category colors, and text-on-accent white
// are deliberately NOT here: they read fine on both grounds and stay static.
export const Colors = {
  light: {
    text: '#11181C',
    textMuted: '#687076', // secondary text, placeholders
    textDisabled: '#DEDEDE', // disabled controls (e.g. no child selected)
    background: '#fff',
    surface: '#fff', // cards / elevated panels
    surfaceMuted: 'rgba(104, 112, 118, 0.06)', // subtle card fill (activity rows)
    border: '#e0e0e0', // list-row separators
    inputBorder: '#687076', // text input / outline-button borders
    icon: '#687076',
    iconFaint: '#9AA1A6', // empty-state icons
    tint: tintColorLight,
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    onAccent: '#fff', // text/icon on a colored accent button
    error: '#d33',
    errorText: '#c23b3b',
    errorSurface: 'rgba(194, 59, 59, 0.10)',
    success: '#2a9d3f',
    successSurface: 'rgba(42, 157, 63, 0.12)',
    badgeBg: 'rgba(104, 112, 118, 0.12)', // icon badge backgrounds
    tintSurface: 'rgba(10, 126, 164, 0.12)', // logo/hero badge fill
    tintSurfaceStrong: 'rgba(10, 126, 164, 0.08)', // share-code banner
    hairline: 'rgba(104, 112, 118, 0.25)', // faint borders (template chip, edit card)
    // Floating glass tab bar
    glassBg: 'rgba(255, 255, 255, 0.72)',
    glassBorder: 'rgba(255, 255, 255, 0.3)',
    glassActive: 'rgba(255, 255, 255, 0.9)',
  },
  dark: {
    text: '#ECEDEE',
    textMuted: '#9BA1A6',
    textDisabled: '#54595C',
    background: '#151718',
    surface: '#1E2123',
    surfaceMuted: 'rgba(255, 255, 255, 0.06)',
    border: 'rgba(255, 255, 255, 0.14)',
    inputBorder: 'rgba(255, 255, 255, 0.22)',
    icon: '#9BA1A6',
    iconFaint: '#6B7276',
    tint: tintColorDark,
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    onAccent: '#fff',
    error: '#ff6b6b',
    errorText: '#ff8080',
    errorSurface: 'rgba(255, 107, 107, 0.15)',
    success: '#4ade80',
    successSurface: 'rgba(74, 222, 128, 0.15)',
    badgeBg: 'rgba(255, 255, 255, 0.10)',
    tintSurface: 'rgba(77, 184, 216, 0.16)',
    tintSurfaceStrong: 'rgba(77, 184, 216, 0.12)',
    hairline: 'rgba(255, 255, 255, 0.16)',
    glassBg: 'rgba(30, 33, 35, 0.72)',
    glassBorder: 'rgba(255, 255, 255, 0.14)',
    glassActive: 'rgba(255, 255, 255, 0.12)',
  },
};

export type ThemeColors = typeof Colors.light;

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

// Max content width for the web layout. On phones the screen is narrower than
// this so it has no effect; on a desktop browser (react-native-web) it keeps
// screens from stretching into an unreadable full-width column. Applied web-only
// via `webContentContainer` below.
export const ContentMaxWidth = 640;

// Spread onto a screen's outer container (a ScrollView contentContainerStyle or
// a centered flex:1 View) to cap and center it on web. `marginHorizontal:'auto'`
// centers a capped block; `alignSelf:'center'` also centers it as a flex item
// (needed for the flex:1 auth/account roots whose parent stretches children).
// Null on native, so native layout is untouched (spreading null is a no-op).
export const webContentContainer =
  Platform.OS === 'web'
    ? ({
        width: '100%',
        maxWidth: ContentMaxWidth,
        alignSelf: 'center',
        marginHorizontal: 'auto',
      } as const)
    : null;

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
