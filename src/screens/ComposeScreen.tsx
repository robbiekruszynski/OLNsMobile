import * as Crypto from 'expo-crypto';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { getOrCreateUserId } from '../identity/getOrCreateUserId';
import { useMesh } from '../mesh/MeshContext';
import type { RootTabParamList } from '../navigation/AppNavigator';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import type { Note, NoteType } from '../types/Note';

const NOTE_TYPES = [
  { type: 'emergency' as NoteType, label: 'EMERGENCY', color: '#E5433D' },
  { type: 'resource' as NoteType, label: 'RESOURCE', color: '#3DAE6E' },
  { type: 'information' as NoteType, label: 'INFORMATION', color: '#4FACDE' },
  { type: 'waypoint' as NoteType, label: 'WAYPOINT', color: '#E5A030' },
];

const DEFAULT_TYPE_INDEX = 2;
const TITLE_MAX = 80;
const BODY_MAX = 1000;

export default function ComposeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { broadcastNote } = useMesh();

  const [selectedIndex, setSelectedIndex] = useState(DEFAULT_TYPE_INDEX);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const [successTypeColor, setSuccessTypeColor] = useState(
    NOTE_TYPES[DEFAULT_TYPE_INDEX].color,
  );

  const successOverlayOpacity = useRef(new Animated.Value(0)).current;
  const labelOpacity = useRef(new Animated.Value(1)).current;
  const moodTintOpacity = useRef(new Animated.Value(0.04)).current;
  const dotWidths = useRef(
    NOTE_TYPES.map((_, index) =>
      new Animated.Value(index === DEFAULT_TYPE_INDEX ? 16 : 5),
    ),
  ).current;
  const selectedIndexRef = useRef(DEFAULT_TYPE_INDEX);

  const selectedType = NOTE_TYPES[selectedIndex];
  const currentTypeColor = selectedType.color;

  const canBroadcast =
    title.trim().length > 0 && body.trim().length > 0 && !isBroadcasting;

  selectedIndexRef.current = selectedIndex;

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
      (selectedIndexRef.current - 1 + NOTE_TYPES.length) % NOTE_TYPES.length;
    goToIndex(nextIndex);
  }, [goToIndex]);

  const goToNext = useCallback(() => {
    const nextIndex = (selectedIndexRef.current + 1) % NOTE_TYPES.length;
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
      setSelectedIndex(DEFAULT_TYPE_INDEX);
      navigation.navigate('Feed');
    });
  }

  async function handleBroadcast() {
    if (!canBroadcast) {
      return;
    }

    Keyboard.dismiss();
    setIsBroadcasting(true);
    setErrorVisible(false);
    setSuccessVisible(false);

    try {
      const authorId = await getOrCreateUserId();
      const trimmedBody = body.trim();
      const typeColor = selectedType.color;

      const note: Note = {
        noteId: Crypto.randomUUID(),
        type: selectedType.type,
        title: title.trim(),
        body: trimmedBody,
        preview: trimmedBody.slice(0, 100),
        authorId,
        timestamp: new Date().toISOString(),
        hopOrigin: 0,
      };

      await broadcastNote(note);
      showSuccessFlash(typeColor);
    } catch {
      setErrorVisible(true);
    } finally {
      setIsBroadcasting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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

          <View style={styles.header}>
            <Text style={styles.headerTitle}>COMPOSE</Text>
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
                {selectedType.label}
              </Animated.Text>

              <View style={styles.dotsRow}>
                {NOTE_TYPES.map((typeOption, index) => (
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

          <View style={styles.inputArea}>
            <TextInput
              value={title}
              onChangeText={value => setTitle(value.slice(0, TITLE_MAX))}
              placeholder="TRANSMISSION TITLE"
              placeholderTextColor={colors.textMeta}
              style={styles.titleInput}
              maxLength={TITLE_MAX}
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
                value={body}
                onChangeText={value => setBody(value.slice(0, BODY_MAX))}
                placeholder="COMPOSE YOUR TRANSMISSION..."
                placeholderTextColor={colors.textMeta}
                style={styles.bodyInput}
                multiline
                textAlignVertical="top"
                maxLength={BODY_MAX}
              />
              <Text style={styles.bodyCount}>
                {body.length}/{BODY_MAX}
              </Text>
            </View>

            {errorVisible && (
              <Text style={styles.errorMessage}>BROADCAST FAILED</Text>
            )}
          </View>

          <View
            style={[
              styles.broadcastZone,
              { paddingBottom: insets.bottom + 16 },
            ]}>
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
              <Text
                style={[
                  styles.broadcastLabel,
                  canBroadcast
                    ? { color: currentTypeColor }
                    : styles.broadcastLabelInactive,
                ]}>
                BROADCAST
              </Text>
            </Pressable>
          </View>
        </View>

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
              TRANSMITTED
            </Text>
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.accent,
    letterSpacing: 2,
    textAlign: 'center',
  },
  typeCarousel: {
    height: 100,
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 16,
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
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  dot: {
    height: 5,
  },
  inputArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  titleInput: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: 14,
    paddingHorizontal: 0,
  },
  titleBorder: {
    height: 1,
    opacity: 0.5,
    marginBottom: 4,
  },
  titleCount: {
    alignSelf: 'flex-end',
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textMeta,
    marginBottom: 16,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  bodyContainer: {
    flex: 1,
  },
  bodyInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textPrimary,
    textAlignVertical: 'top',
    paddingTop: 0,
    paddingHorizontal: 0,
  },
  bodyCount: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textMeta,
  },
  broadcastZone: {
    paddingHorizontal: 16,
    paddingTop: 12,
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
  },
  errorMessage: {
    fontSize: 11,
    letterSpacing: 3,
    fontFamily: fonts.regular,
    color: colors.error,
    textAlign: 'center',
    marginTop: 16,
  },
});
