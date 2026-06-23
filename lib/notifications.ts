import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const projectId = Constants.expoConfig?.extra?.eas?.projectId;

// Registers the current device for push notifications and upserts its Expo
// push token into push_tokens for the signed-in profile. No-ops on web and on
// simulators/emulators (no APNs/FCM credentials), and if the EAS project
// isn't linked yet (no extra.eas.projectId — run `eas init`).
export async function registerForPushNotifications(profileId: string): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  if (!projectId) {
    console.warn('Skipping push registration: no extra.eas.projectId in app config (run `eas init`).');
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let status = existingStatus;
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      { profile_id: profileId, token, platform: Platform.OS },
      { onConflict: 'token' }
    );
  if (error) {
    console.warn('Failed to save push token:', error.message);
  }
}
