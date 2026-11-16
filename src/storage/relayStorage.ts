import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';

const RELAY_KEY = 'olns_allow_relay';

export async function getAllowRelay(): Promise<boolean> {
  const value = await AsyncStorage.getItem(RELAY_KEY);
  if (value === null) {
    return true;
  }

  return value === 'true';
}

export async function saveAllowRelay(allowRelay: boolean): Promise<void> {
  await AsyncStorage.setItem(RELAY_KEY, allowRelay ? 'true' : 'false');
}

export async function applyRelayChange(allowRelay: boolean): Promise<void> {
  await saveAllowRelay(allowRelay);
  await Updates.reloadAsync();
}
