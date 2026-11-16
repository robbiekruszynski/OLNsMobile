import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { resolveLanguageTag, type LanguageTag } from '../i18n/languages';

export type AppFontSet = {
  regular: string;
  bold: string;
  display: string;
  displaySemiBold: string;
  displayRegular: string;
};

export const LATIN_FONTS: AppFontSet = {
  regular: 'IBMPlexMono_400Regular',
  bold: 'IBMPlexMono_700Bold',
  display: 'Oxanium_700Bold',
  displaySemiBold: 'Oxanium_700Bold',
  displayRegular: 'Oxanium_400Regular',
};

export const HAN_FONTS: AppFontSet = {
  regular: 'NotoSansSC_400Regular',
  bold: 'NotoSansSC_700Bold',
  display: 'NotoSansSC_700Bold',
  displaySemiBold: 'NotoSansSC_600SemiBold',
  displayRegular: 'NotoSansSC_400Regular',
};

export const DEVANAGARI_FONTS: AppFontSet = {
  regular: 'NotoSansDevanagari_400Regular',
  bold: 'NotoSansDevanagari_700Bold',
  display: 'NotoSansDevanagari_700Bold',
  displaySemiBold: 'NotoSansDevanagari_600SemiBold',
  displayRegular: 'NotoSansDevanagari_400Regular',
};

export const BENGALI_FONTS: AppFontSet = {
  regular: 'NotoSansBengali_400Regular',
  bold: 'NotoSansBengali_700Bold',
  display: 'NotoSansBengali_700Bold',
  displaySemiBold: 'NotoSansBengali_600SemiBold',
  displayRegular: 'NotoSansBengali_400Regular',
};

export const ARABIC_FONTS: AppFontSet = {
  regular: 'NotoSansArabic_400Regular',
  bold: 'NotoSansArabic_700Bold',
  display: 'NotoSansArabic_700Bold',
  displaySemiBold: 'NotoSansArabic_600SemiBold',
  displayRegular: 'NotoSansArabic_400Regular',
};

const SCRIPT_FONT_MAP: Record<LanguageTag, AppFontSet> = {
  en: LATIN_FONTS,
  es: LATIN_FONTS,
  fr: LATIN_FONTS,
  pt: LATIN_FONTS,
  de: LATIN_FONTS,
  id: LATIN_FONTS,
  zh: HAN_FONTS,
  hi: DEVANAGARI_FONTS,
  bn: BENGALI_FONTS,
  ar: ARABIC_FONTS,
  ur: ARABIC_FONTS,
};

export function getFontsForLanguage(language: string): AppFontSet {
  const tag = resolveLanguageTag(language);
  return SCRIPT_FONT_MAP[tag];
}

export function useAppFonts(): AppFontSet {
  const { i18n } = useTranslation();
  return useMemo(() => getFontsForLanguage(i18n.language), [i18n.language]);
}

/** @deprecated Use useAppFonts() so script-specific families apply. */
export const fonts = LATIN_FONTS;

export const typography = {
  xs: { fontFamily: LATIN_FONTS.regular, fontSize: 10 },
  sm: { fontFamily: LATIN_FONTS.regular, fontSize: 12 },
  md: { fontFamily: LATIN_FONTS.regular, fontSize: 13 },
  base: { fontFamily: LATIN_FONTS.regular, fontSize: 14 },
  lg: { fontFamily: LATIN_FONTS.regular, fontSize: 16 },
  xl: { fontFamily: LATIN_FONTS.regular, fontSize: 20 },
  xxl: { fontFamily: LATIN_FONTS.regular, fontSize: 24 },
} as const;
