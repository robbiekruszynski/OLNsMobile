import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  PanResponder,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import NoteCard from '../components/NoteCard';
import { useMesh } from '../mesh/MeshContext';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { spacing } from '../theme/spacing';
import type { Note, NoteType } from '../types/Note';

const FILTER_OPTIONS: {
  label: string;
  type: NoteType | null;
  color: string;
}[] = [
  { label: 'ALL', type: null, color: colors.accent },
  { type: 'emergency', label: 'EMERGENCY', color: '#E5433D' },
  { type: 'resource', label: 'RESOURCE', color: '#3DAE6E' },
  { type: 'information', label: 'INFORMATION', color: '#4FACDE' },
  { type: 'waypoint', label: 'WAYPOINT', color: '#E5A030' },
];

const DEFAULT_FILTER_INDEX = 0;

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const {
    status,
    peerCount,
    errorMessage,
    userId,
    activePeerIds,
    allNotes,
    isDiscovering,
    startDiscovery,
  } = useMesh();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(DEFAULT_FILTER_INDEX);
  const meshPulseAnim = useRef(new Animated.Value(1)).current;
  const discoveryPulseAnim = useRef(new Animated.Value(1)).current;
  const labelOpacity = useRef(new Animated.Value(1)).current;
  const dotWidths = useRef(
    FILTER_OPTIONS.map((_, index) =>
      new Animated.Value(index === DEFAULT_FILTER_INDEX ? 16 : 5),
    ),
  ).current;
  const selectedIndexRef = useRef(DEFAULT_FILTER_INDEX);

  selectedIndexRef.current = selectedIndex;

  const selectedFilter = FILTER_OPTIONS[selectedIndex];
  const activeFilter = selectedFilter.type;
  const activeFilterColor = selectedFilter.color;

  const filteredNotes = useMemo(
    () =>
      activeFilter
        ? allNotes.filter(note => note.type === activeFilter)
        : allNotes,
    [activeFilter, allNotes],
  );

  const noteCountLabel =
    filteredNotes.length === 1 ? '1 NOTE' : `${filteredNotes.length} NOTES`;

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
        ]).start();

        Animated.timing(labelOpacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }).start();
      });
    },
    [dotWidths, labelOpacity],
  );

  const goToPrevious = useCallback(() => {
    const nextIndex =
      (selectedIndexRef.current - 1 + FILTER_OPTIONS.length) %
      FILTER_OPTIONS.length;
    goToIndex(nextIndex);
  }, [goToIndex]);

  const goToNext = useCallback(() => {
    const nextIndex = (selectedIndexRef.current + 1) % FILTER_OPTIONS.length;
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

  const shouldPulseMesh =
    status === 'starting' || (status === 'running' && peerCount > 0);

  useEffect(() => {
    if (!shouldPulseMesh) {
      meshPulseAnim.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(meshPulseAnim, {
          toValue: 0.35,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(meshPulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [meshPulseAnim, shouldPulseMesh]);

  useEffect(() => {
    if (!isDiscovering) {
      discoveryPulseAnim.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(discoveryPulseAnim, {
          toValue: 0.35,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(discoveryPulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [discoveryPulseAnim, isDiscovering]);

  const statusColor =
    status === 'starting'
      ? colors.accent
      : status === 'running'
        ? colors.hopIndicator
        : status === 'error'
          ? colors.error
          : colors.textMeta;

  const statusLabel =
    status === 'idle'
      ? 'MESH OFFLINE'
      : status === 'starting'
        ? 'INITIALIZING...'
        : status === 'running'
          ? 'MESH ACTIVE'
          : 'MESH ERROR';

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await startDiscovery();
    } finally {
      setRefreshing(false);
    }
  }

  function renderNote({ item }: { item: Note }) {
    const isOwn = item.authorId === userId;
    const isGhost =
      !isOwn && !activePeerIds.includes(item.authorId);

    return (
      <NoteCard note={item} isOwn={isOwn} isGhost={isGhost} />
    );
  }

  function renderEmptyState() {
    if (activeFilter && filteredNotes.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text
            style={[
              styles.filteredEmptyText,
              { color: `${activeFilterColor}99` },
            ]}>
            NO {selectedFilter.label} TRANSMISSIONS
          </Text>
          <Text style={styles.filteredEmptySubtext}>MESH IS LISTENING</Text>
        </View>
      );
    }

    if (allNotes.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>NO TRANSMISSIONS</Text>
          <Text style={styles.emptySubtext}>MESH IS LISTENING</Text>
        </View>
      );
    }

    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Image
          source={require('../../assets/OLNsLogo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.statusSection}>
          <Animated.Text
            style={[
              styles.statusText,
              {
                color: statusColor,
                opacity: status === 'starting' ? meshPulseAnim : 1,
              },
            ]}>
            {statusLabel}
          </Animated.Text>

          {status === 'running' && (
            <Animated.Text
              style={[
                styles.peerCount,
                { opacity: peerCount > 0 ? meshPulseAnim : 1 },
              ]}>
              {String(peerCount).padStart(2, '0')} PEERS
            </Animated.Text>
          )}

          {status === 'error' && errorMessage && (
            <Text style={styles.errorDetail}>{errorMessage}</Text>
          )}
        </View>

        {isDiscovering ? (
          <Animated.Text
            style={[styles.discoveryText, { opacity: discoveryPulseAnim }]}>
            SCANNING...
          </Animated.Text>
        ) : (
          <Text style={styles.discoveryTextMuted}>LISTENING</Text>
        )}
      </View>

      <View style={styles.filterBar}>
        <View style={styles.filterCarousel} {...panResponder.panHandlers}>
          <Pressable
            onPress={goToPrevious}
            hitSlop={20}
            style={styles.arrowButton}>
            <Text
              style={[
                styles.arrow,
                { color: `${activeFilterColor}B3` },
              ]}>
              ‹
            </Text>
          </Pressable>

          <View style={styles.filterCenter}>
            <Animated.Text
              style={[
                styles.filterName,
                {
                  color: activeFilterColor,
                  opacity: labelOpacity,
                },
              ]}>
              {selectedFilter.label}
            </Animated.Text>

            <View style={styles.dotsRow}>
              {FILTER_OPTIONS.map((option, index) => (
                <Pressable
                  key={option.label}
                  onPress={() => goToIndex(index)}
                  hitSlop={8}>
                  <Animated.View
                    style={[
                      styles.dot,
                      {
                        width: dotWidths[index],
                        backgroundColor:
                          index === selectedIndex
                            ? activeFilterColor
                            : colors.border,
                        borderRadius: index === selectedIndex ? 3 : 2.5,
                      },
                    ]}
                  />
                </Pressable>
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
                { color: `${activeFilterColor}B3` },
              ]}>
              ›
            </Text>
          </Pressable>
        </View>

        <Text
          style={[
            styles.noteCount,
            activeFilter &&
              filteredNotes.length > 0 && {
                color: `${activeFilterColor}CC`,
              },
          ]}>
          {noteCountLabel}
        </Text>
      </View>

      <FlatList
        data={filteredNotes}
        keyExtractor={item => item.noteId}
        renderItem={renderNote}
        contentContainerStyle={[
          styles.listContent,
          filteredNotes.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListEmptyComponent={renderEmptyState()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 80,
    resizeMode: 'contain',
  },
  statusSection: {
    marginTop: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    letterSpacing: 3,
  },
  peerCount: {
    color: colors.hopIndicator,
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 2,
  },
  errorDetail: {
    color: colors.textMeta,
    fontSize: 11,
    fontFamily: fonts.regular,
    letterSpacing: 3,
    textAlign: 'center',
  },
  discoveryText: {
    marginTop: spacing.sm,
    color: colors.accent,
    fontSize: 10,
    letterSpacing: 3,
    fontFamily: fonts.regular,
  },
  discoveryTextMuted: {
    marginTop: spacing.sm,
    color: colors.textMeta,
    fontSize: 10,
    letterSpacing: 3,
    fontFamily: fonts.regular,
  },
  filterBar: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
  },
  filterCarousel: {
    height: 100,
    width: '100%',
    paddingHorizontal: 16,
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
  filterCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterName: {
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
  noteCount: {
    fontFamily: fonts.regular,
    fontSize: 9,
    color: colors.textMeta,
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textMeta,
    fontSize: 11,
    letterSpacing: 4,
    fontFamily: fonts.regular,
  },
  emptySubtext: {
    color: colors.textMeta,
    fontSize: 9,
    letterSpacing: 3,
    fontFamily: fonts.regular,
    opacity: 0.5,
    marginTop: 8,
  },
  filteredEmptyText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 3,
    textAlign: 'center',
  },
  filteredEmptySubtext: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textMeta,
    letterSpacing: 3,
    textAlign: 'center',
    marginTop: 8,
  },
});
