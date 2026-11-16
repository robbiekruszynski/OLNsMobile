import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { applyLanguageChange } from '../i18n';
import { getLanguageCode, LANGUAGES } from '../i18n/languages';
import { colors } from '../theme/colors';
import { useAppFonts, type AppFontSet } from '../theme/typography';

interface LanguagePickerModalProps {
  visible: boolean;
  onClose: () => void;
}

export function LanguagePickerModal({
  visible,
  onClose,
}: LanguagePickerModalProps) {
  const { t, i18n } = useTranslation();
  const fonts = useAppFonts();
  const styles = useMemo(() => createStyles(fonts), [fonts]);
  const [isRestarting, setIsRestarting] = useState(false);

  const selectedLanguageCode = getLanguageCode(i18n.language);

  function handleSelectLanguage(tag: (typeof LANGUAGES)[number]['tag']) {
    if (tag === i18n.language) {
      onClose();
      return;
    }

    setIsRestarting(true);
    void applyLanguageChange(tag)
      .then(result => {
        if (result === 'applied') {
          setIsRestarting(false);
          onClose();
        }
      })
      .catch(() => {
        setIsRestarting(false);
      });
  }

  return (
    <>
      <Modal
        visible={visible && !isRestarting}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('home.language')}</Text>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton}>
              <Text style={styles.closeLabel}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {LANGUAGES.map(language => {
              const selected = selectedLanguageCode === language.code;

              return (
                <Pressable
                  key={language.code}
                  onPress={() => handleSelectLanguage(language.tag)}
                  style={styles.languageRow}>
                  <Text style={styles.languageCode}>{language.code}</Text>
                  <Text style={styles.languageName}>{language.label}</Text>
                  {selected && <Text style={styles.languageCheck}>✓</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {isRestarting && (
        <Modal visible transparent animationType="fade">
          <View style={styles.restartingOverlay}>
            <Text style={styles.restartingText}>
              {t('home.restartingLanguage')}
            </Text>
          </View>
        </Modal>
      )}
    </>
  );
}

function createStyles(fonts: AppFontSet) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
    },
    headerTitle: {
      fontFamily: fonts.bold,
      fontSize: 14,
      color: colors.accent,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    closeButton: {
      padding: 8,
    },
    closeLabel: {
      fontFamily: fonts.regular,
      fontSize: 16,
      color: colors.textSecondary,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 32,
    },
    languageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    languageCode: {
      width: 40,
      fontFamily: fonts.bold,
      fontSize: 12,
      color: colors.accent,
      letterSpacing: 1,
    },
    languageName: {
      flex: 1,
      fontFamily: fonts.regular,
      fontSize: 14,
      color: colors.textPrimary,
    },
    languageCheck: {
      fontFamily: fonts.bold,
      fontSize: 14,
      color: colors.hopIndicator,
    },
    restartingOverlay: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      paddingHorizontal: 32,
    },
    restartingText: {
      fontFamily: fonts.regular,
      fontSize: 13,
      color: colors.textSecondary,
      letterSpacing: 2,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
  });
}
