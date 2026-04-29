import { Image } from 'expo-image';
import { Audio, ResizeMode, Video } from 'expo-av';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../context/AppThemeContext';
import { useReadableStorageUrl } from '../hooks/useReadableStorageUrl';
import type { PostRow } from '../types/database';
import { font, getColors } from '../theme';

export function PostMediaViewerModal({
  post,
  visible,
  onClose,
  canDelete = false,
  onDelete,
}: {
  post: PostRow | null;
  visible: boolean;
  onClose: () => void;
  canDelete?: boolean;
  onDelete?: () => void;
}) {
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const isVideo = Boolean(post?.video_path?.trim());
  const videoMedia = useReadableStorageUrl(post?.video_path ?? null);
  const imageMedia = useReadableStorageUrl(post?.image_path ?? null);
  const [muted, setMuted] = useState(false);
  const videoRef = useRef<InstanceType<typeof Video> | null>(null);

  useEffect(() => {
    setMuted(false);
  }, [post?.id, visible]);

  useEffect(() => {
    if (!visible || !isVideo) return;
    void Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
    }).catch(() => {});
  }, [visible, isVideo]);

  const caption = useMemo(() => (post?.body ?? post?.caption ?? '').trim(), [post?.body, post?.caption]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: resolvedScheme === 'dark' ? '#0a0a0a' : '#101010' }]}>
          <View style={styles.topRow}>
            {isVideo ? (
              <Text style={[styles.hint, { color: '#fff', fontFamily: font.syne }]}>
                tap video to {muted ? 'unmute' : 'mute'}
              </Text>
            ) : (
              <View />
            )}
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Text style={[styles.closeText, { color: '#fff', fontFamily: font.syne }]}>close</Text>
            </Pressable>
          </View>
          {canDelete ? (
            <Pressable onPress={onDelete} style={styles.deleteBtn}>
              <Text style={[styles.deleteText, { fontFamily: font.syne }]}>remove post</Text>
            </Pressable>
          ) : null}
          <View style={styles.mediaWrap}>
            {isVideo ? (
              visible && videoMedia.displayUri ? (
                <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setMuted((m) => !m)}>
                  <Video
                    ref={videoRef}
                    key={`${post?.id ?? 'p'}-${videoMedia.displayUri}`}
                    source={{ uri: videoMedia.displayUri }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={visible}
                    isLooping
                    isMuted={muted}
                    onError={videoMedia.onLoadError}
                    onLoad={() => {
                      if (!visible) return;
                      void videoRef.current?.setPositionAsync(0);
                      void videoRef.current?.playAsync?.();
                    }}
                  />
                </Pressable>
              ) : (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color={colors.accent} />
                </View>
              )
            ) : imageMedia.displayUri ? (
              <Image
                source={{ uri: imageMedia.displayUri }}
                style={StyleSheet.absoluteFillObject}
                contentFit="contain"
                cachePolicy="memory-disk"
                onError={imageMedia.onLoadError}
              />
            ) : (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={colors.accent} />
              </View>
            )}
          </View>
          {caption ? (
            <Text style={[styles.caption, { color: '#fff', fontFamily: font.dm }]} numberOfLines={3}>
              {caption}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    padding: 18,
  },
  sheet: {
    borderRadius: 16,
    padding: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
  },
  hint: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  closeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  closeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  deleteBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,80,80,0.2)',
    marginBottom: 8,
  },
  deleteText: {
    color: '#ff8f8f',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  mediaWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  loadingWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
  },
});
