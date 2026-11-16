import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_KEY = 'olns_language';

export async function getStoredLanguage(): Promise<string | null> {
  return AsyncStorage.getItem(LANGUAGE_KEY);
}

export async function saveLanguage(language: string): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, language);
}
