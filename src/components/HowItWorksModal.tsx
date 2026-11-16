import { useMemo } from 'react';
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

import { HOW_IT_WORKS_STEPS } from '../constants/howItWorksSteps';
import { colors } from '../theme/colors';
import { useAppFonts, type AppFontSet } from '../theme/typography';

interface HowItWorksModalProps {
  visible: boolean;
  onClose: () => void;
}

export function HowItWorksModal({ visible, onClose }: HowItWorksModalProps) {
  const { t } = useTranslation();
  const fonts = useAppFonts();
  const styles = useMemo(() => createStyles(fonts), [fonts]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('home.howItWorks')}</Text>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton}>
            <Text style={styles.closeLabel}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <View key={step.number}>
              {index > 0 && <View style={styles.stepDivider} />}
              <View style={styles.stepRow}>
                <View
                  style={[styles.stepAccentBar, { backgroundColor: step.color }]}
                />
                <View style={styles.stepContent}>
                  <Text style={[styles.stepNumber, { color: step.color }]}>
                    {step.number}
                  </Text>
                  <Text style={styles.stepTitle}>{t(step.titleKey)}</Text>
                  <Text style={styles.stepDescription}>
                    {t(step.descriptionKey)}
                  </Text>
                </View>
              </View>
            </View>
          ))}

          <Text style={styles.footer}>{t('home.howItWorksFooter')}</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
      paddingHorizontal: 24,
      paddingTop: 32,
      paddingBottom: 0,
      marginBottom: 28,
      backgroundColor: colors.surface,
    },
    headerTitle: {
      flex: 1,
      fontFamily: fonts.display,
      fontSize: 16,
      color: colors.accent,
      letterSpacing: 3,
      textTransform: 'uppercase',
    },
    closeButton: {
      padding: 12,
    },
    closeLabel: {
      fontFamily: fonts.regular,
      fontSize: 20,
      color: colors.textSecondary,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 32,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    stepAccentBar: {
      width: 3,
      borderRadius: 2,
      marginEnd: 16,
    },
    stepContent: {
      flex: 1,
    },
    stepDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 28,
    },
    stepNumber: {
      fontFamily: fonts.bold,
      fontSize: 11,
      letterSpacing: 3,
      marginBottom: 6,
    },
    stepTitle: {
      fontFamily: fonts.bold,
      fontSize: 20,
      color: colors.textPrimary,
      letterSpacing: 1,
      marginBottom: 10,
      textTransform: 'uppercase',
    },
    stepDescription: {
      fontFamily: fonts.regular,
      fontSize: 15,
      lineHeight: 24,
      letterSpacing: 0.3,
      color: colors.textSecondary,
    },
    footer: {
      fontFamily: fonts.regular,
      fontSize: 13,
      color: colors.textMeta,
      textAlign: 'center',
      lineHeight: 20,
      letterSpacing: 0.5,
      paddingHorizontal: 24,
      marginTop: 32,
    },
  });
}
