import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { MAX_HOPS } from '../mesh/MeshContext';
import { colors, getNoteTypeColor } from '../theme/colors';
import { fonts } from '../theme/typography';
import type { Note } from '../types/Note';

interface NoteCardProps {
  note: Note;
  isOwn: boolean;
  isGhost: boolean;
}

const AUTO_DISMISS_MS = 6000;

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();

  return `${hours}:${minutes} · ${day} ${month}`;
}

function formatDetailTimestamp(iso: string): string {
  const date = new Date(iso);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const year = date.getFullYear();

  return `${hours}:${minutes} · ${day} ${month} ${year}`;
}

function getHopBadge(note: Note) {
  if (note.hopOrigin >= MAX_HOPS - 1) {
    return {
      label: `HOP ${note.hopOrigin} ⚠`,
      color: colors.error,
    };
  }

  if (note.hopOrigin >= 2) {
    return {
      label: `HOP ${note.hopOrigin}`,
      color: colors.accent,
    };
  }

  if (note.hopOrigin === 1) {
    return {
      label: 'HOP 1',
      color: colors.textSecondary,
    };
  }

  return {
    label: 'ORIGIN',
    color: colors.hopIndicator,
  };
}

function getHopsLabel(hopOrigin: number): string {
  if (hopOrigin === 0) {
    return 'DIRECT - NO RELAY';
  }

  if (hopOrigin === 1) {
    return '1 RELAY';
  }

  return `${hopOrigin} RELAYS`;
}

function getHopsColor(hopOrigin: number): string {
  if (hopOrigin === 0) {
    return colors.hopIndicator;
  }

  if (hopOrigin >= 4) {
    return colors.accent;
  }

  return colors.textSecondary;
}

interface DetailRowProps {
  label: string;
  value: string;
  valueColor?: string;
}

function DetailRow({ label, value, valueColor = colors.textPrimary }: DetailRowProps) {
  return (
    <>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, { color: valueColor }]}>{value}</Text>
      </View>
      <View style={styles.detailDivider} />
    </>
  );
}

export default function NoteCard({ note, isOwn, isGhost }: NoteCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const previewSuffix = note.body.length > note.preview.length ? '...' : '';
  const hopBadge = getHopBadge(note);
  const typeColor = getNoteTypeColor(note.type);
  const accentColor = isGhost ? colors.textMeta : typeColor;
  const borderColor = isGhost
    ? colors.border
    : isOwn
      ? `${typeColor}99`
      : typeColor;

  const clearAutoDismiss = useCallback(() => {
    if (autoDismissRef.current) {
      clearTimeout(autoDismissRef.current);
      autoDismissRef.current = null;
    }
  }, []);

  const closeDetail = useCallback(() => {
    clearAutoDismiss();
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setShowDetail(false);
      }
    });
  }, [clearAutoDismiss, overlayOpacity]);

  const openDetail = useCallback(() => {
    clearAutoDismiss();
    setShowDetail(true);
    overlayOpacity.setValue(0);
    Animated.timing(overlayOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();

    autoDismissRef.current = setTimeout(() => {
      closeDetail();
    }, AUTO_DISMISS_MS);
  }, [clearAutoDismiss, closeDetail, overlayOpacity]);

  useEffect(() => {
    return () => {
      clearAutoDismiss();
    };
  }, [clearAutoDismiss]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isGhost ? colors.ghostNote : colors.surface,
          borderColor,
        },
      ]}>
      <TouchableOpacity
        activeOpacity={1}
        delayLongPress={400}
        onLongPress={openDetail}>
        <View style={styles.cardInner}>
          <View
            style={[
              styles.accentBar,
              {
                backgroundColor: accentColor,
              },
            ]}
          />
          <View style={styles.cardContent}>
            <View style={styles.topRow}>
              <Text style={[styles.typeLabel, { color: accentColor }]}>
                {note.type.toUpperCase()}
              </Text>
              <View style={styles.badgeRow}>
                {isGhost && (
                  <Text style={styles.ghostIndicator}>SIGNAL LOST</Text>
                )}
                <Text style={[styles.hopBadge, { color: hopBadge.color }]}>
                  {hopBadge.label}
                </Text>
              </View>
            </View>

            {!isGhost && (
              <View
                style={[
                  styles.typeStrip,
                  { backgroundColor: `${typeColor}4D` },
                ]}
              />
            )}

            <Text
              style={[
                styles.title,
                { color: isGhost ? colors.textSecondary : colors.textPrimary },
              ]}>
              {note.title}
            </Text>
            <Text style={styles.preview} numberOfLines={3}>
              {note.preview}
              {previewSuffix}
            </Text>

            <View style={styles.bottomRow}>
              <Text style={styles.metaLeft}>
                FROM {note.authorId.slice(0, 8).toUpperCase()}
                {isOwn ? ' (YOU)' : ''}
              </Text>
              <Text style={styles.metaRight}>
                {formatTimestamp(note.timestamp)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {showDetail && (
        <Animated.View
          style={[styles.detailOverlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity
            style={styles.detailOverlayTouchable}
            activeOpacity={1}
            onPress={closeDetail}>
            <View style={styles.detailHeader}>
              <Text
                style={[styles.detailHeaderTitle, { color: typeColor }]}>
                TRANSMISSION DETAIL
              </Text>
              <Pressable onPress={closeDetail} hitSlop={8} style={styles.detailClose}>
                <Text style={styles.detailCloseLabel}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.detailRows}>
              <DetailRow
                label="TYPE"
                value={note.type.toUpperCase()}
                valueColor={typeColor}
              />
              <DetailRow
                label="ORIGIN"
                value={note.authorId.slice(0, 8).toUpperCase()}
                valueColor={colors.textSecondary}
              />
              <DetailRow
                label="BROADCAST"
                value={formatDetailTimestamp(note.timestamp)}
                valueColor={colors.textSecondary}
              />
              <DetailRow
                label="HOPS"
                value={getHopsLabel(note.hopOrigin)}
                valueColor={getHopsColor(note.hopOrigin)}
              />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>STATUS</Text>
                <Text
                  style={[
                    styles.detailValue,
                    {
                      color: isGhost ? colors.error : colors.hopIndicator,
                    },
                  ]}>
                  {isGhost ? 'SIGNAL LOST' : 'SIGNAL ACTIVE'}
                </Text>
              </View>
            </View>

            <Text style={styles.detailFooter}>
              ANONYMOUS · MESH RELAY · NO INFRASTRUCTURE
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 6,
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  cardInner: {
    flexDirection: 'row',
  },
  accentBar: {
    width: 3,
  },
  cardContent: {
    flex: 1,
    padding: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeLabel: {
    fontSize: 10,
    letterSpacing: 3,
    fontFamily: fonts.bold,
  },
  ghostIndicator: {
    color: colors.error,
    fontSize: 9,
    letterSpacing: 2,
    fontFamily: fonts.regular,
  },
  hopBadge: {
    fontSize: 9,
    letterSpacing: 2,
    fontFamily: fonts.regular,
  },
  typeStrip: {
    height: 1,
    marginTop: 6,
  },
  title: {
    fontSize: 15,
    fontFamily: fonts.bold,
    marginTop: 6,
  },
  preview: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fonts.regular,
    marginTop: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  metaLeft: {
    color: colors.textMeta,
    fontSize: 9,
    letterSpacing: 1,
    fontFamily: fonts.regular,
    flexShrink: 1,
    marginRight: 8,
  },
  metaRight: {
    color: colors.textMeta,
    fontSize: 9,
    fontFamily: fonts.regular,
  },
  detailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(14, 17, 23, 0.96)',
    borderRadius: 6,
    padding: 14,
    zIndex: 10,
  },
  detailOverlayTouchable: {
    flex: 1,
    justifyContent: 'space-between',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailHeaderTitle: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 3,
  },
  detailClose: {
    padding: 4,
  },
  detailCloseLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailRows: {
    flex: 1,
    justifyContent: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: {
    fontFamily: fonts.regular,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.textMeta,
  },
  detailValue: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textPrimary,
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  detailFooter: {
    fontFamily: fonts.regular,
    fontSize: 8,
    letterSpacing: 2,
    color: colors.textMeta,
    textAlign: 'center',
    marginTop: 8,
  },
});
