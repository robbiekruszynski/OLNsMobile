import { I18nManager } from 'react-native';
import * as Updates from 'expo-updates';
import i18n from 'i18next';

import { saveLanguage } from './languageStorage';
import { type LanguageTag } from './languages';

const RTL_LANGUAGES = new Set<LanguageTag>(['ar', 'ur']);

export function isRtlLanguage(language: LanguageTag): boolean {
  return RTL_LANGUAGES.has(language);
}

export function syncLayoutDirection(language: LanguageTag): boolean {
  const shouldRtl = isRtlLanguage(language);

  if (I18nManager.isRTL === shouldRtl) {
    return false;
  }

  I18nManager.allowRTL(true);
  I18nManager.forceRTL(shouldRtl);
  return true;
}

export type ApplyLanguageResult = 'applied' | 'reloading';

export async function applyLanguageChange(
  language: LanguageTag,
): Promise<ApplyLanguageResult> {
  await saveLanguage(language);

  const needsReload = syncLayoutDirection(language);
  await i18n.changeLanguage(language);

  if (needsReload) {
    await Updates.reloadAsync();
    return 'reloading';
  }

  return 'applied';
}

export function syncLayoutDirectionOnStartup(language: LanguageTag): void {
  syncLayoutDirection(language);
}
