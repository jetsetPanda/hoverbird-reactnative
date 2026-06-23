// TEMP: dark mode is disabled — force light everywhere. To restore system
// theming, revert this file to: export { useColorScheme } from 'react-native';
export function useColorScheme(): 'light' | 'dark' {
  return 'light';
}
