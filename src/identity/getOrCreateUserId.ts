import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const STORAGE_KEY = 'olns_user_id';

export async function getOrCreateUserId(): Promise<string> {
  const existing = await AsyncStorage.getItem(STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const userId = Crypto.randomUUID();
  await AsyncStorage.setItem(STORAGE_KEY, userId);
  return userId;
}
