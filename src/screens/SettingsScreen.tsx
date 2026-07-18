import Constants from 'expo-constants';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HowItWorksModal } from '../components/HowItWorksModal';
import { LanguagePickerModal } from '../components/LanguagePickerModal';
import { useMesh } from '../mesh/MeshContext';
import { clearAllNotes } from '../storage/noteStorage';
import {
  applyRelayChange,
  getAllowRelay,
} from '../storage/relayStorage';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { useAppFonts, type AppFontSet } from '../theme/typography';
import { getLanguageCode } from '../i18n/languages';
import { copyToClipboard } from '../utils/copyToClipboard';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const fonts = useAppFonts();
  const styles = useMemo(() => createStyles(fonts), [fonts]);
  const { userId, loadMyNotes } = useMesh();

  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [allowRelay, setAllowRelay] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isRestartingMesh, setIsRestartingMesh] = useState(false);

  const appVersion = Constants.expoConfig?.version ?? '—';
  const languageCode = getLanguageCode(i18n.language);

  useEffect(() => {
    void getAllowRelay().then(setAllowRelay);
  }, []);

  const handleCopyIdentity = useCallback(async () => {
    if (!userId) {
      return;
    }

    const didCopy = await copyToClipboard(userId);
    if (!didCopy) {
      return;
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [userId]);

  const handleRelayToggle = useCallback(
    (nextValue: boolean) => {
      if (nextValue === allowRelay) {
        return;
      }

      Alert.alert(
        t('settings.relay.confirmTitle'),
        t('settings.relay.confirmMessage'),
        [
          {
            text: t('settings.relay.cancel'),
            style: 'cancel',
          },
          {
            text: t('settings.relay.restart'),
            style: 'default',
            onPress: () => {
              setIsRestartingMesh(true);
              void applyRelayChange(nextValue).catch(() => {
                setIsRestartingMesh(false);
                void getAllowRelay().then(setAllowRelay);
              });
            },
          },
        ],
      );
    },
    [allowRelay, t],
  );

  const handleClearNotes = useCallback(() => {
    Alert.alert(
      t('settings.clearNotes.confirmTitle'),
      t('settings.clearNotes.confirmMessage'),
      [
        {
          text: t('settings.clearNotes.cancel'),
          style: 'cancel',
        },
        {
          text: t('settings.clearNotes.confirm'),
          style: 'destructive',
          onPress: () => {
            void clearAllNotes().then(() => loadMyNotes());
          },
        },
      ],
    );
  }, [loadMyNotes, t]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('settings.identity.label')}</Text>
          <Text style={styles.sectionDescription}>
            {t('settings.identity.description')}
          </Text>
          <Pressable
            onPress={() => {
              void handleCopyIdentity();
            }}
            style={styles.identityBlock}
            disabled={!userId}>
            <Text style={styles.identityValue} selectable>
              {userId ?? '—'}
            </Text>
            <Text style={styles.identityAction}>
              {copied ? t('settings.identity.copied') : t('settings.identity.copy')}
            </Text>
          </Pressable>
        </View>

        <View style={styles.sectionDivider} />

        <Pressable
          onPress={() => setShowLanguagePicker(true)}
          style={styles.row}>
          <Text style={styles.rowLabel}>{t('settings.language')}</Text>
          <Text style={styles.rowValue}>{languageCode}</Text>
        </Pressable>

        <View style={styles.sectionDivider} />

        <Pressable
          onPress={() => setShowHowItWorks(true)}
          style={styles.row}>
          <Text style={styles.rowLabel}>{t('settings.howItWorks')}</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>

        <View style={styles.sectionDivider} />

        <View style={styles.row}>
          <View style={styles.rowTextBlock}>
            <Text style={styles.rowLabel}>{t('settings.relay.label')}</Text>
            <Text style={styles.rowDescription}>
              {t('settings.relay.description')}
            </Text>
          </View>
          <Switch
            value={allowRelay}
            onValueChange={handleRelayToggle}
            trackColor={{ false: colors.border, true: `${colors.accent}66` }}
            thumbColor={allowRelay ? colors.accent : colors.textMeta}
            ios_backgroundColor={colors.border}
          />
        </View>

        <View style={styles.sectionDivider} />

        <Pressable onPress={handleClearNotes} style={styles.row}>
          <Text style={styles.destructiveLabel}>
            {t('settings.clearNotes.label')}
          </Text>
        </Pressable>

        <Text style={styles.versionLabel}>
          {t('settings.version', { version: appVersion })}
        </Text>
      </ScrollView>

      <LanguagePickerModal
        visible={showLanguagePicker}
        onClose={() => setShowLanguagePicker(false)}
      />
      <HowItWorksModal
        visible={showHowItWorks}
        onClose={() => setShowHowItWorks(false)}
      />

      {isRestartingMesh && (
        <Modal visible transparent animationType="fade">
          <View style={styles.restartingOverlay}>
            <Text style={styles.restartingText}>
              {t('settings.relay.restarting')}
            </Text>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

function createStyles(fonts: AppFontSet) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      alignItems: 'center',
    },
    headerTitle: {
      fontFamily: fonts.bold,
      fontSize: 18,
      color: colors.accent,
      letterSpacing: 2,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
    },
    section: {
      paddingVertical: spacing.sm,
    },
    sectionLabel: {
      fontFamily: fonts.bold,
      fontSize: 11,
      color: colors.accent,
      letterSpacing: 3,
      textTransform: 'uppercase',
      marginBottom: spacing.xs,
    },
    sectionDescription: {
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    identityBlock: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: spacing.xs,
      padding: spacing.sm + spacing.xs,
      gap: spacing.sm,
    },
    identityValue: {
      fontFamily: fonts.regular,
      fontSize: 12,
      color: colors.textPrimary,
      letterSpacing: 0.5,
    },
    identityAction: {
      fontFamily: fonts.bold,
      fontSize: 10,
      color: colors.accent,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    sectionDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    rowTextBlock: {
      flex: 1,
      paddingRight: spacing.sm,
    },
    rowLabel: {
      fontFamily: fonts.bold,
      fontSize: 12,
      color: colors.textPrimary,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    rowDescription: {
      fontFamily: fonts.regular,
      fontSize: 11,
      lineHeight: 16,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    rowValue: {
      fontFamily: fonts.bold,
      fontSize: 12,
      color: colors.accent,
      letterSpacing: 2,
    },
    rowChevron: {
      fontFamily: fonts.regular,
      fontSize: 22,
      color: colors.textMeta,
    },
    destructiveLabel: {
      fontFamily: fonts.bold,
      fontSize: 12,
      color: colors.error,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    versionLabel: {
      fontFamily: fonts.regular,
      fontSize: 10,
      color: colors.textMeta,
      letterSpacing: 1,
      textAlign: 'center',
      marginTop: spacing.xxl,
      marginBottom: spacing.md,
    },
    restartingOverlay: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
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
