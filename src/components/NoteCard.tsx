import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { decryptNoteContent } from '../crypto/noteEncryption';
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

function getHopBadge(note: Note, t: TFunction) {
  if (note.hopOrigin >= MAX_HOPS - 1) {
    return {
      label: t('noteCard.hopCountWarning', { count: note.hopOrigin }),
      color: colors.error,
    };
  }

  if (note.hopOrigin >= 2) {
    return {
      label: t('noteCard.hopCount', { count: note.hopOrigin }),
      color: colors.accent,
    };
  }

  if (note.hopOrigin === 1) {
    return {
      label: t('noteCard.hopOne'),
      color: colors.textSecondary,
    };
  }

  return {
    label: t('noteCard.origin'),
    color: colors.hopIndicator,
  };
}

function getHopsLabel(hopOrigin: number, t: TFunction): string {
  if (hopOrigin === 0) {
    return t('noteCard.hopsDirect');
  }

  if (hopOrigin === 1) {
    return t('noteCard.hopsOneRelay');
  }

  return t('noteCard.hopsManyRelays', { count: hopOrigin });
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
    <View style={styles.detailRowBlock}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, { color: valueColor }]}>{value}</Text>
      <View style={styles.detailDivider} />
    </View>
  );
}

export default function NoteCard({ note, isOwn, isGhost }: NoteCardProps) {
  const { t } = useTranslation();
  const [showDetail, setShowDetail] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [decryptedContent, setDecryptedContent] = useState<{
    title: string;
    body: string;
  } | null>(null);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const unlockPulseOpacity = useRef(new Animated.Value(1)).current;
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLocked = note.encrypted && !decryptedContent;
  const displayTitle = decryptedContent?.title ?? note.title;
  const displayPreview = decryptedContent
    ? decryptedContent.body.slice(0, 100)
    : note.preview;
  const previewSuffix =
    decryptedContent && decryptedContent.body.length > displayPreview.length
      ? '...'
      : !decryptedContent && note.body.length > note.preview.length
        ? '...'
        : '';
  const hopBadge = getHopBadge(note, t);
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

  const closeUnlockModal = useCallback(() => {
    setShowUnlockModal(false);
    setUnlockPassword('');
    setUnlockError(false);
    setIsUnlocking(false);
  }, []);

  const handleCardPress = useCallback(() => {
    if (isLocked) {
      setUnlockError(false);
      setUnlockPassword('');
      setShowUnlockModal(true);
    }
  }, [isLocked]);

  const handleUnlock = useCallback(() => {
    if (isUnlocking) {
      return;
    }

    if (!note.cipherText || !note.salt || !note.nonce) {
      setUnlockError(true);
      return;
    }

    const { cipherText, salt, nonce } = note;

    setIsUnlocking(true);
    setUnlockError(false);

    unlockTimerRef.current = setTimeout(() => {
      unlockTimerRef.current = null;
      const decrypted = decryptNoteContent(
        {
          cipherText,
          salt,
          nonce,
        },
        unlockPassword,
      );

      if (!decrypted) {
        setUnlockError(true);
        setIsUnlocking(false);
        return;
      }

      setDecryptedContent(decrypted);
      setIsUnlocking(false);
      closeUnlockModal();
    }, 0);
  }, [
    closeUnlockModal,
    isUnlocking,
    note.cipherText,
    note.nonce,
    note.salt,
    unlockPassword,
  ]);

  useEffect(() => {
    if (!isUnlocking) {
      unlockPulseOpacity.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(unlockPulseOpacity, {
          toValue: 0.35,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(unlockPulseOpacity, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [isUnlocking, unlockPulseOpacity]);

  useEffect(() => {
    return () => {
      if (unlockTimerRef.current) {
        clearTimeout(unlockTimerRef.current);
      }
    };
  }, []);

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
        onPress={handleCardPress}
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
                {t(`noteType.${note.type}`)}
              </Text>
              <View style={styles.badgeRow}>
                {note.encrypted && !decryptedContent && (
                  <Text style={styles.lockBadge}>🔒</Text>
                )}
                {isGhost && (
                  <Text style={styles.ghostIndicator}>
                    {t('noteCard.signalLost')}
                  </Text>
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

            {isLocked ? (
              <View style={styles.lockedContent}>
                <Text style={styles.lockedTitle}>
                  {t('noteCard.encryptedMessage')}
                </Text>
                <Text style={styles.unlockHint}>{t('noteCard.tapToUnlock')}</Text>
              </View>
            ) : (
              <>
                <Text
                  style={[
                    styles.title,
                    {
                      color: isGhost ? colors.textSecondary : colors.textPrimary,
                    },
                  ]}>
                  {displayTitle}
                </Text>
                <Text style={styles.preview} numberOfLines={3}>
                  {displayPreview}
                  {previewSuffix}
                </Text>
              </>
            )}

            <View style={styles.bottomRow}>
              <Text style={styles.metaLeft}>
                {t('noteCard.fromAuthor', {
                  id: note.authorId.slice(0, 8).toUpperCase(),
                })}
                {isOwn ? ` ${t('noteCard.you')}` : ''}
              </Text>
              <Text style={styles.metaRight}>
                {formatTimestamp(note.timestamp)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {showDetail && (
        <View style={styles.detailOverlay}>
          <Animated.View
            style={[styles.detailOverlayContent, { opacity: overlayOpacity }]}>
            <View style={styles.detailHeader}>
              <Text
                style={[styles.detailHeaderTitle, { color: typeColor }]}>
                {t('noteCard.transmissionDetail')}
              </Text>
              <Pressable onPress={closeDetail} hitSlop={8} style={styles.detailClose}>
                <Text style={styles.detailCloseLabel}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.detailRows}>
              <DetailRow
                label={t('noteCard.type')}
                value={t(`noteType.${note.type}`)}
                valueColor={typeColor}
              />
              <DetailRow
                label={t('noteCard.origin')}
                value={note.authorId.slice(0, 8).toUpperCase()}
                valueColor={colors.textSecondary}
              />
              <DetailRow
                label={t('noteCard.broadcast')}
                value={formatDetailTimestamp(note.timestamp)}
                valueColor={colors.textSecondary}
              />
              <DetailRow
                label={t('noteCard.hops')}
                value={getHopsLabel(note.hopOrigin, t)}
                valueColor={getHopsColor(note.hopOrigin)}
              />
              <View style={styles.detailRowBlock}>
                <Text style={styles.detailLabel}>{t('noteCard.status')}</Text>
                <Text
                  style={[
                    styles.detailValue,
                    {
                      color: isGhost ? colors.error : colors.hopIndicator,
                    },
                  ]}>
                  {isGhost ? t('noteCard.signalLost') : t('noteCard.signalActive')}
                </Text>
              </View>
            </View>

            <Text style={styles.detailFooter}>{t('noteCard.detailFooter')}</Text>
          </Animated.View>
        </View>
      )}

      <Modal
        visible={showUnlockModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isUnlocking) {
            closeUnlockModal();
          }
        }}>
        <Pressable
          style={styles.unlockOverlay}
          onPress={() => {
            if (!isUnlocking) {
              closeUnlockModal();
            }
          }}>
          <Pressable style={styles.unlockDialog} onPress={() => {}}>
            <Text style={styles.unlockDialogTitle}>
              {t('noteCard.unlockTransmission')}
            </Text>
            <TextInput
              value={unlockPassword}
              onChangeText={value => {
                setUnlockPassword(value);
                setUnlockError(false);
              }}
              placeholder={t('noteCard.enterPassword')}
              placeholderTextColor={colors.textMeta}
              style={styles.unlockInput}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              editable={!isUnlocking}
            />
            {unlockError && (
              <Text style={styles.unlockError}>
                {t('noteCard.incorrectPassword')}
              </Text>
            )}
            <View style={styles.unlockActions}>
              <Pressable
                onPress={closeUnlockModal}
                style={styles.unlockButton}
                disabled={isUnlocking}>
                <Text
                  style={[
                    styles.unlockButtonLabel,
                    isUnlocking && styles.unlockButtonLabelDisabled,
                  ]}>
                  {t('noteCard.cancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleUnlock}
                style={[styles.unlockButton, styles.unlockButtonPrimary]}
                disabled={unlockPassword.length === 0 || isUnlocking}>
                <Animated.Text
                  style={[
                    styles.unlockButtonLabel,
                    styles.unlockButtonLabelPrimary,
                    (unlockPassword.length === 0 || isUnlocking) &&
                      styles.unlockButtonLabelDisabled,
                    isUnlocking && {
                      color: colors.accent,
                      opacity: unlockPulseOpacity,
                    },
                  ]}>
                  {isUnlocking ? t('noteCard.decrypting') : t('noteCard.unlock')}
                </Animated.Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    textTransform: 'uppercase',
  },
  ghostIndicator: {
    color: colors.error,
    fontSize: 9,
    letterSpacing: 2,
    fontFamily: fonts.regular,
    textTransform: 'uppercase',
  },
  hopBadge: {
    fontSize: 9,
    letterSpacing: 2,
    fontFamily: fonts.regular,
    textTransform: 'uppercase',
  },
  lockBadge: {
    fontSize: 11,
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
  lockedContent: {
    marginTop: 10,
    gap: 6,
  },
  lockedTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },
  unlockHint: {
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: fonts.regular,
    color: colors.textMeta,
    textTransform: 'uppercase',
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
    textTransform: 'uppercase',
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
    backgroundColor: colors.surface,
    borderRadius: 6,
    padding: 14,
    zIndex: 10,
    elevation: 20,
  },
  detailOverlayContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailHeaderTitle: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 3,
    textTransform: 'uppercase',
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
    flexGrow: 1,
    gap: 4,
  },
  detailRowBlock: {
    paddingVertical: 8,
  },
  detailLabel: {
    fontFamily: fonts.regular,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.textMeta,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textPrimary,
    textTransform: 'uppercase',
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
    textTransform: 'uppercase',
  },
  unlockOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  unlockDialog: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  unlockDialogTitle: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 3,
    color: colors.accent,
    textAlign: 'center',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  unlockInput: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  unlockError: {
    fontFamily: fonts.regular,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.error,
    textAlign: 'center',
    marginTop: 10,
    textTransform: 'uppercase',
  },
  unlockActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  unlockButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  unlockButtonPrimary: {},
  unlockButtonLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  unlockButtonLabelPrimary: {
    fontFamily: fonts.bold,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  unlockButtonLabelDisabled: {
    color: colors.textMeta,
  },
});
