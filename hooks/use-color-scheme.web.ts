// TEMP: dark mode is disabled — force light everywhere. To restore system
// theming, revert this file to its original system-aware implementation
// (the one that returns useRNColorScheme() after hydration).
export function useColorScheme(): 'light' | 'dark' {
  return 'light';
}
