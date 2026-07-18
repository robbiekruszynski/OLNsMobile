import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { getStoredLanguage, saveLanguage } from './languageStorage';
import { resolveLanguageTag, type LanguageTag } from './languages';

import ar from './locales/ar.json';
import bn from './locales/bn.json';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import hi from './locales/hi.json';
import id from './locales/id.json';
import pt from './locales/pt.json';
import ur from './locales/ur.json';
import zh from './locales/zh.json';

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  pt: { translation: pt },
  de: { translation: de },
  id: { translation: id },
  zh: { translation: zh },
  hi: { translation: hi },
  ar: { translation: ar },
  bn: { translation: bn },
  ur: { translation: ur },
};

function getDeviceLanguage(): LanguageTag {
  const locale = getLocales()[0]?.languageCode ?? 'en';
  return resolveLanguageTag(locale);
}

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export async function initI18n(): Promise<void> {
  const stored = await getStoredLanguage();
  const language = stored ? resolveLanguageTag(stored) : getDeviceLanguage();
  await i18n.changeLanguage(language);
}

export async function setAppLanguage(language: LanguageTag): Promise<void> {
  await i18n.changeLanguage(language);
  await saveLanguage(language);
}

export default i18n;
