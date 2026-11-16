import { Share } from 'react-native';

/**
 * Copies text to the clipboard when expo-clipboard is linked in the dev build.
 * Falls back to the system share sheet if the native module is unavailable
 * (e.g. dev client built before expo-clipboard was added — rebuild to fix).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const { setStringAsync } = await import('expo-clipboard');
    await setStringAsync(text);
    return true;
  } catch {
    // Native ExpoClipboard module not present in this build.
  }

  try {
    await Share.share({ message: text });
    return true;
  } catch {
    return false;
  }
}
