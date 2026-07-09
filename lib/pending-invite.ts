import AsyncStorage from '@react-native-async-storage/async-storage';

// A 6-digit invite code captured from a deep link. Persisted so it survives the
// sign-up → complete-profile → tabs flow: invite links usually go to people who
// aren't signed in yet, so the code has to outlive several screens before the
// redeem form can consume it. Read is non-destructive (peek); the redeem form
// clears it only after a successful join.
const KEY = 'pending-invite-code';

export async function setPendingInviteCode(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, code);
  } catch {
    // Non-fatal — the user can still type the code by hand.
  }
}

export async function getPendingInviteCode(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function clearPendingInviteCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Non-fatal.
  }
}
