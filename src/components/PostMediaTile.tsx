import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useAppTheme } from '../context/AppThemeContext';
import { useReadableStorageUrl } from '../hooks/useReadableStorageUrl';
import type { PostRow } from '../types/database';
import { font, getColors } from '../theme';

export type PostLike = PostRow & { vote_count?: number };

export function PostMediaTile({
  post,
  style,
  borderRadius = 12,
}: {
  post: PostLike;
  style?: ViewStyle;
  borderRadius?: number;
}) {
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const base = [{ borderRadius, overflow: 'hidden' as const }, style];
  const cap = (post.body ?? post.caption ?? '').trim();
  const hasImage = Boolean(post.image_path?.trim());
  const hasVideo = Boolean(post.video_path?.trim());
  const videoMedia = useReadableStorageUrl(hasVideo ? post.video_path : null);
  const imageMedia = useReadableStorageUrl(hasImage ? post.image_path : null);

  if (hasVideo) {
    return (
      <LinearGradient
        colors={resolvedScheme === 'dark' ? ['#1a1a1a', '#0a0a0a'] : ['#e8e6e0', '#d5d1c8']}
        style={base}
      >
        {videoMedia.displayUri ? (
          <Video
            source={{ uri: videoMedia.displayUri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping
            isMuted
            onError={videoMedia.onLoadError}
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}>
            <ActivityIndicator color={resolvedScheme === 'dark' ? '#D4FF3F' : '#5a7a00'} />
          </View>
        )}
      </LinearGradient>
    );
  }

  if (hasImage) {
    return (
      <View style={base}>
        {imageMedia.displayUri ? (
          <Image
            source={{ uri: imageMedia.displayUri }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            cachePolicy="memory-disk"
            onError={imageMedia.onLoadError}
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}>
            <ActivityIndicator color={resolvedScheme === 'dark' ? '#D4FF3F' : '#5a7a00'} />
          </View>
        )}
      </View>
    );
  }

  if (cap) {
    const accentA = resolvedScheme === 'dark' ? 'rgba(212,255,63,0.14)' : 'rgba(90,122,0,0.12)';
    const accentB = resolvedScheme === 'dark' ? 'rgba(212,255,63,0.04)' : 'rgba(90,122,0,0.05)';
    const borderC = resolvedScheme === 'dark' ? 'rgba(212,255,63,0.45)' : 'rgba(90,122,0,0.35)';
    return (
      <LinearGradient
        colors={resolvedScheme === 'dark' ? ['#0a0a0a', '#141808', '#0d0d0d'] : ['#f8f8f4', '#eef2e4', '#f5f5f0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          ...base,
          {
            padding: 0,
            borderWidth: 1.5,
            borderColor: borderC,
          },
        ]}
      >
        <View style={styles.textInner}>
          <LinearGradient
            colors={[accentA, accentB]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={[styles.textQuote, { color: colors.accent, fontFamily: font.syne }]}>sidekix</Text>
          <Text
            style={[styles.textBody, { color: colors.text1, fontFamily: font.dm }]}
            numberOfLines={10}
          >
            {cap}
          </Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={resolvedScheme === 'dark' ? ['#252525', '#151515'] : ['#eceae6', '#dedad2']}
      style={[...base, { alignItems: 'center', justifyContent: 'center' }]}
    >
      <Text style={{ color: colors.text3, fontFamily: font.syne }}>—</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  textInner: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 72,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  textQuote: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
    opacity: 0.95,
  },
  textBody: {
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: -0.1,
  },
});
