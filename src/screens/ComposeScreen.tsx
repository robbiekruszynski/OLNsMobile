import * as Crypto from 'expo-crypto';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { getOrCreateUserId } from '../identity/getOrCreateUserId';
import { encryptNoteContent } from '../crypto/noteEncryption';
import { useMesh } from '../mesh/MeshContext';
import type { RootTabParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { useAppFonts, type AppFontSet } from '../theme/typography';
import type { Note, NoteType } from '../types/Note';
import { ENCRYPTED_NOTE_TITLE } from '../types/Note';

const NOTE_TYPE_KEYS: { type: NoteType; labelKey: string; color: string }[] = [
  { type: 'emergency', labelKey: 'noteType.emergency', color: '#E5433D' },
  { type: 'resource', labelKey: 'noteType.resource', color: '#3DAE6E' },
  { type: 'information', labelKey: 'noteType.information', color: '#4FACDE' },
  { type: 'waypoint', labelKey: 'noteType.waypoint', color: '#E5A030' },
];

const DEFAULT_TYPE_INDEX = 2;
const TITLE_MAX = 80;
const BODY_MAX = 1000;
const BODY_ACCESSORY_ID = 'compose-body-accessory';
type BroadcastPhase = 'idle' | 'encrypting' | 'transmitting';

export default function ComposeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { broadcastNote } = useMesh();
  const { t } = useTranslation();
  const fonts = useAppFonts();
  const styles = useMemo(() => createStyles(fonts), [fonts]);

  const [selectedIndex, setSelectedIndex] = useState(DEFAULT_TYPE_INDEX);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [broadcastPhase, setBroadcastPhase] =
    useState<BroadcastPhase>('idle');
  const [encryptEnabled, setEncryptEnabled] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [successVisible, setSuccessVisible] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const [successTypeColor, setSuccessTypeColor] = useState(
    NOTE_TYPE_KEYS[DEFAULT_TYPE_INDEX].color,
  );

  const successOverlayOpacity = useRef(new Animated.Value(0)).current;
  const broadcastPulseOpacity = useRef(new Animated.Value(1)).current;
  const labelOpacity = useRef(new Animated.Value(1)).current;
  const moodTintOpacity = useRef(new Animated.Value(0.04)).current;
  const dotWidths = useRef(
    NOTE_TYPE_KEYS.map((_, index) =>
      new Animated.Value(index === DEFAULT_TYPE_INDEX ? 16 : 5),
    ),
  ).current;
  const selectedIndexRef = useRef(DEFAULT_TYPE_INDEX);
  const scrollRef = useRef<ScrollView>(null);
  const bodyInputRef = useRef<TextInput>(null);

  const selectedType = NOTE_TYPE_KEYS[selectedIndex];
  const currentTypeColor = selectedType.color;

  const passwordsFilled =
    password.length > 0 && confirmPassword.length > 0;
  const passwordsMatch = password === confirmPassword;
  const encryptionReady = !encryptEnabled || (passwordsFilled && passwordsMatch);

  const canBroadcast =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    broadcastPhase === 'idle' &&
    encryptionReady;
  const isBroadcasting = broadcastPhase !== 'idle';

  const broadcastLabel =
    broadcastPhase === 'encrypting'
      ? t('compose.encrypting')
      : broadcastPhase === 'transmitting'
        ? t('compose.transmitting')
        : t('compose.broadcast');

  selectedIndexRef.current = selectedIndex;

  const scrollToFormEnd = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const handleEncryptToggle = useCallback(() => {
    setEncryptEnabled(current => {
      const next = !current;

      if (next) {
        scrollToFormEnd();
      }

      return next;
    });
    setPassword('');
    setConfirmPassword('');
  }, [scrollToFormEnd]);

  const handleBodyDone = useCallback(() => {
    Keyboard.dismiss();
    scrollToFormEnd();
  }, [scrollToFormEnd]);

  const waitForLoadingPaint = useCallback(
    () =>
      new Promise<void>(resolve => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 0);
        });
      }),
    [],
  );

  useEffect(() => {
    if (!isBroadcasting) {
      broadcastPulseOpacity.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(broadcastPulseOpacity, {
          toValue: 0.35,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(broadcastPulseOpacity, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [broadcastPulseOpacity, isBroadcasting]);

  const goToIndex = useCallback(
    (nextIndex: number) => {
      const currentIndex = selectedIndexRef.current;
      if (nextIndex === currentIndex) {
        return;
      }

      Animated.timing(labelOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          return;
        }

        setSelectedIndex(nextIndex);
        selectedIndexRef.current = nextIndex;

        Animated.parallel([
          Animated.timing(dotWidths[currentIndex], {
            toValue: 5,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.timing(dotWidths[nextIndex], {
            toValue: 16,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.sequence([
            Animated.timing(moodTintOpacity, {
              toValue: 0.02,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(moodTintOpacity, {
              toValue: 0.04,
              duration: 100,
              useNativeDriver: true,
            }),
          ]),
        ]).start();

        Animated.timing(labelOpacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }).start();
      });
    },
    [dotWidths, labelOpacity, moodTintOpacity],
  );

  const goToPrevious = useCallback(() => {
    const nextIndex =
      (selectedIndexRef.current - 1 + NOTE_TYPE_KEYS.length) %
      NOTE_TYPE_KEYS.length;
    goToIndex(nextIndex);
  }, [goToIndex]);

  const goToNext = useCallback(() => {
    const nextIndex = (selectedIndexRef.current + 1) % NOTE_TYPE_KEYS.length;
    goToIndex(nextIndex);
  }, [goToIndex]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 10,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx < -30) {
            goToNext();
          } else if (gestureState.dx > 30) {
            goToPrevious();
          }
        },
      }),
    [goToNext, goToPrevious],
  );

  function showSuccessFlash(typeColor: string) {
    setSuccessTypeColor(typeColor);
    setSuccessVisible(true);
    successOverlayOpacity.setValue(0);

    Animated.sequence([
      Animated.timing(successOverlayOpacity, {
        toValue: 0.95,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(successOverlayOpacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) {
        return;
      }

      setSuccessVisible(false);
      setTitle('');
      setBody('');
      setEncryptEnabled(false);
      setPassword('');
      setConfirmPassword('');
      setSelectedIndex(DEFAULT_TYPE_INDEX);
      navigation.navigate('Feed');
    });
  }

  async function handleBroadcast() {
    if (!canBroadcast) {
      return;
    }

    Keyboard.dismiss();
    setBroadcastPhase(encryptEnabled ? 'encrypting' : 'transmitting');
    setErrorVisible(false);
    setSuccessVisible(false);

    try {
      const authorId = await getOrCreateUserId();
      const trimmedTitle = title.trim();
      const trimmedBody = body.trim();
      const typeColor = selectedType.color;
      const noteId = Crypto.randomUUID();
      const timestamp = new Date().toISOString();

      let note: Note;

      if (encryptEnabled) {
        const broadcastPassword = password;
        await waitForLoadingPaint();
        const { cipherText, salt, nonce } = encryptNoteContent(
          { title: trimmedTitle, body: trimmedBody },
          broadcastPassword,
        );
        setBroadcastPhase('transmitting');

        setPassword('');
        setConfirmPassword('');

        note = {
          noteId,
          type: selectedType.type,
          title: ENCRYPTED_NOTE_TITLE,
          body: '',
          preview: '',
          authorId,
          timestamp,
          hopOrigin: 0,
          encrypted: true,
          cipherText,
          salt,
          nonce,
        };

        if (__DEV__) {
          console.log('[OLNs] broadcasting encrypted note', {
            noteId,
            type: note.type,
            title: note.title,
            body: note.body,
            encrypted: note.encrypted,
            hasCipherText: Boolean(note.cipherText),
          });
        }
      } else {
        note = {
          noteId,
          type: selectedType.type,
          title: trimmedTitle,
          body: trimmedBody,
          preview: trimmedBody.slice(0, 100),
          authorId,
          timestamp,
          hopOrigin: 0,
          encrypted: false,
        };
      }

      if (!encryptEnabled) {
        await waitForLoadingPaint();
      }

      await broadcastNote(note);
      showSuccessFlash(typeColor);
    } catch {
      setErrorVisible(true);
    } finally {
      setBroadcastPhase('idle');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? spacing.lg : 0}>
        <View style={styles.flex}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.moodTint,
              {
                backgroundColor: currentTypeColor,
                opacity: moodTintOpacity,
              },
            ]}
          />

          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + spacing.md },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === 'ios' ? 'interactive' : 'on-drag'
            }
            showsVerticalScrollIndicator={false}>
            <Pressable
              onPress={Keyboard.dismiss}
              style={styles.dismissLayer}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('compose.title')}</Text>
              </View>

              <View
                style={styles.typeCarousel}
                {...panResponder.panHandlers}>
                <Pressable
                  onPress={goToPrevious}
                  hitSlop={20}
                  style={styles.arrowButton}>
                  <Text
                    style={[
                      styles.arrow,
                      { color: `${currentTypeColor}B3` },
                    ]}>
                    ‹
                  </Text>
                </Pressable>

                <View style={styles.typeCenter}>
                  <Animated.Text
                    style={[
                      styles.typeName,
                      {
                        color: currentTypeColor,
                        opacity: labelOpacity,
                      },
                    ]}>
                    {t(selectedType.labelKey)}
                  </Animated.Text>

                  <View style={styles.dotsRow}>
                    {NOTE_TYPE_KEYS.map((typeOption, index) => (
                      <Animated.View
                        key={typeOption.type}
                        style={[
                          styles.dot,
                          {
                            width: dotWidths[index],
                            backgroundColor:
                              index === selectedIndex
                                ? currentTypeColor
                                : colors.border,
                            borderRadius: index === selectedIndex ? 3 : 2.5,
                          },
                        ]}
                      />
                    ))}
                  </View>
                </View>

                <Pressable
                  onPress={goToNext}
                  hitSlop={20}
                  style={styles.arrowButton}>
                  <Text
                    style={[
                      styles.arrow,
                      { color: `${currentTypeColor}B3` },
                    ]}>
                    ›
                  </Text>
                </Pressable>
              </View>

              <View style={styles.formSection}>
                <TextInput
                  value={title}
                  onChangeText={value => setTitle(value.slice(0, TITLE_MAX))}
                  placeholder={t('compose.transmissionTitle')}
                  placeholderTextColor={colors.textMeta}
                  style={styles.titleInput}
                  maxLength={TITLE_MAX}
                  returnKeyType="next"
                  onSubmitEditing={() => bodyInputRef.current?.focus()}
                />
                <View
                  style={[
                    styles.titleBorder,
                    { backgroundColor: currentTypeColor },
                  ]}
                />
                <Text style={styles.titleCount}>
                  {title.length}/{TITLE_MAX}
                </Text>

                <View style={styles.sectionDivider} />

                <View style={styles.bodyContainer}>
                  <TextInput
                    ref={bodyInputRef}
                    value={body}
                    onChangeText={value => setBody(value.slice(0, BODY_MAX))}
                    placeholder={t('compose.bodyPlaceholder')}
                    placeholderTextColor={colors.textMeta}
                    style={styles.bodyInput}
                    multiline
                    textAlignVertical="top"
                    maxLength={BODY_MAX}
                    inputAccessoryViewID={
                      Platform.OS === 'ios' ? BODY_ACCESSORY_ID : undefined
                    }
                    onBlur={scrollToFormEnd}
                  />
                  <Text style={styles.bodyCount}>
                    {body.length}/{BODY_MAX}
                  </Text>
                </View>

                <View style={styles.encryptSection}>
                  <Pressable
                    onPress={handleEncryptToggle}
                    hitSlop={20}
                    style={styles.encryptToggleRow}>
                    <View
                      style={[
                        styles.encryptToggle,
                        encryptEnabled && {
                          backgroundColor: `${currentTypeColor}33`,
                          borderColor: currentTypeColor,
                        },
                      ]}>
                      <View
                        style={[
                          styles.encryptToggleKnob,
                          encryptEnabled && {
                            alignSelf: 'flex-end',
                            backgroundColor: currentTypeColor,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.encryptToggleLabel}>
                      {t('compose.encryptToggle')}
                    </Text>
                  </Pressable>

                  {encryptEnabled && (
                    <View style={styles.passwordFields}>
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder={t('compose.password')}
                        placeholderTextColor={colors.textMeta}
                        style={styles.passwordInput}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        onFocus={scrollToFormEnd}
                      />
                      <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder={t('compose.confirmPassword')}
                        placeholderTextColor={colors.textMeta}
                        style={styles.passwordInput}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        onFocus={scrollToFormEnd}
                      />
                      {passwordsFilled && !passwordsMatch && (
                        <Text style={styles.passwordError}>
                          {t('compose.passwordsDoNotMatch')}
                        </Text>
                      )}
                    </View>
                  )}
                </View>

                {errorVisible && (
                  <Text style={styles.errorMessage}>
                    {t('compose.broadcastFailed')}
                  </Text>
                )}

                <View style={styles.broadcastZone}>
                  <Pressable
                    onPress={handleBroadcast}
                    disabled={!canBroadcast}
                    style={[
                      styles.broadcastButton,
                      canBroadcast
                        ? {
                            backgroundColor: `${currentTypeColor}26`,
                            borderColor: currentTypeColor,
                          }
                        : styles.broadcastButtonInactive,
                    ]}>
                    <Animated.Text
                      style={[
                        styles.broadcastLabel,
                        canBroadcast
                          ? { color: currentTypeColor }
                          : styles.broadcastLabelInactive,
                        isBroadcasting && {
                          color: currentTypeColor,
                          opacity: broadcastPulseOpacity,
                        },
                      ]}>
                      {broadcastLabel}
                    </Animated.Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </ScrollView>
        </View>

        {Platform.OS === 'ios' && (
          <InputAccessoryView nativeID={BODY_ACCESSORY_ID}>
            <View style={styles.keyboardToolbar}>
              <Pressable
                onPress={handleBodyDone}
                hitSlop={12}
                style={styles.keyboardDoneButton}>
                <Text
                  style={[
                    styles.keyboardDoneLabel,
                    { color: currentTypeColor },
                  ]}>
                  {t('compose.done')}
                </Text>
              </Pressable>
            </View>
          </InputAccessoryView>
        )}

        {successVisible && (
          <Animated.View
            style={[
              styles.successOverlay,
              {
                backgroundColor: colors.background,
                opacity: successOverlayOpacity,
              },
            ]}
            pointerEvents="none">
            <Text style={[styles.successText, { color: successTypeColor }]}>
              {t('compose.transmitted')}
            </Text>
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(fonts: AppFontSet) {
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  moodTint: {
    ...StyleSheet.absoluteFill,
    zIndex: -1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  dismissLayer: {
    flexGrow: 1,
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
  typeCarousel: {
    height: spacing.xxl * 2 + spacing.sm,
    width: '100%',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: {
    fontSize: 32,
    fontFamily: fonts.regular,
  },
  typeCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeName: {
    fontSize: 26,
    fontFamily: fonts.bold,
    letterSpacing: 3,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dot: {
    height: spacing.xs + 1,
  },
  formSection: {
    paddingHorizontal: spacing.md,
  },
  titleInput: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: spacing.sm + spacing.xs,
    paddingHorizontal: 0,
  },
  titleBorder: {
    height: 1,
    opacity: 0.5,
    marginBottom: spacing.xs,
  },
  titleCount: {
    alignSelf: 'flex-end',
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textMeta,
    marginBottom: spacing.md,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  bodyContainer: {
    minHeight: spacing.xxl * 5,
    marginBottom: spacing.md,
  },
  bodyInput: {
    minHeight: spacing.xxl * 5 - spacing.lg,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textPrimary,
    textAlignVertical: 'top',
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: spacing.lg,
  },
  bodyCount: {
    position: 'absolute',
    end: 0,
    bottom: 0,
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textMeta,
  },
  broadcastZone: {
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  broadcastButton: {
    height: 52,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  broadcastButtonInactive: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  broadcastLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  broadcastLabelInactive: {
    color: colors.textMeta,
  },
  successOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: {
    fontFamily: fonts.bold,
    fontSize: 20,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  errorMessage: {
    fontSize: 11,
    letterSpacing: 3,
    fontFamily: fonts.regular,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  encryptSection: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  encryptToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  encryptToggle: {
    width: 40,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 2,
    justifyContent: 'center',
  },
  encryptToggleKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.textMeta,
  },
  encryptToggleLabel: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  passwordFields: {
    marginTop: spacing.sm + spacing.xs,
    gap: spacing.sm,
  },
  passwordInput: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.xs,
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingVertical: spacing.sm + spacing.xs,
  },
  passwordError: {
    fontFamily: fonts.regular,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.error,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  keyboardToolbar: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    alignItems: 'flex-end',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  keyboardDoneButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  keyboardDoneLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  });
}
