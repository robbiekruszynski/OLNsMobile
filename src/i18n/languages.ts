export const LANGUAGES = [
  { code: 'EN', label: 'English', tag: 'en' },
  { code: 'ES', label: 'Español', tag: 'es' },
  { code: 'FR', label: 'Français', tag: 'fr' },
  { code: 'PT', label: 'Português', tag: 'pt' },
  { code: 'DE', label: 'Deutsch', tag: 'de' },
  { code: 'ID', label: 'Bahasa Indonesia', tag: 'id' },
  { code: 'ZH', label: '中文', tag: 'zh' },
  { code: 'HI', label: 'हिन्दी', tag: 'hi' },
  { code: 'AR', label: 'العربية', tag: 'ar' },
  { code: 'BN', label: 'বাংলা', tag: 'bn' },
  { code: 'UR', label: 'اردو', tag: 'ur' },
] as const;

export type LanguageTag = (typeof LANGUAGES)[number]['tag'];

export const SUPPORTED_LANGUAGE_TAGS: LanguageTag[] = LANGUAGES.map(
  language => language.tag,
);

export function resolveLanguageTag(tag: string): LanguageTag {
  const base = tag.split('-')[0]?.toLowerCase() ?? 'en';
  const match = SUPPORTED_LANGUAGE_TAGS.find(language => language === base);
  return match ?? 'en';
}

export function getLanguageCode(tag: string): string {
  return LANGUAGES.find(language => language.tag === tag)?.code ?? 'EN';
}
