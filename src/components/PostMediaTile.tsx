import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useAppTheme } from '../context/AppThemeContext';
import { useReadableStorageUrl } from '../hooks/useReadableStorageUrl';
import type { PostRow } from '../types/database';
import { getTextPostPreset } from '../lib/textPostPresets';
import { textMetricsForLength } from '../lib/textPostTextMetrics';
import { HAS_EXPO_AV_VIDEO } from '../lib/videoSupport';
import { font, getColors } from '../theme';

export type PostLike = PostRow & { vote_count?: number };

export function PostMediaTile({
  post,
  style,
  borderRadius = 12,
  /** Tiny squares (e.g. past sidequest row) — tighter text preview. */
  compact = false,
  loadVideo = true,
  autoPlayVideo = false,
}: {
  post: PostLike;
  style?: ViewStyle;
  borderRadius?: number;
  compact?: boolean;
  loadVideo?: boolean;
  autoPlayVideo?: boolean;
}) {
  const videoRef = useRef<InstanceType<typeof Video> | null>(null);
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const base = [{ borderRadius, overflow: 'hidden' as const }, style];
  const cap = (post.body ?? post.caption ?? '').trim();
  const hasImage = Boolean(post.image_path?.trim());
  const hasVideo = Boolean(post.video_path?.trim());
  const videoMedia = useReadableStorageUrl(hasVideo && loadVideo ? post.video_path : null);
  const imageMedia = useReadableStorageUrl(hasImage ? post.image_path : null);

  if (hasVideo) {
    if (loadVideo === false || !HAS_EXPO_AV_VIDEO) {
      return (
        <View style={base} accessibilityLabel="Video post">
          <LinearGradient
            colors={resolvedScheme === 'dark' ? ['#1a1a1a', '#0a0a0a'] : ['#e8e6e0', '#d5d1c8']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: compact ? 22 : 28, color: colors.accent }}>▶</Text>
          </View>
        </View>
      );
    }
    return (
      <LinearGradient
        colors={resolvedScheme === 'dark' ? ['#1a1a1a', '#0a0a0a'] : ['#e8e6e0', '#d5d1c8']}
        style={base}
      >
        {videoMedia.displayUri ? (
          <Video
            key={videoMedia.displayUri}
            ref={videoRef}
            source={{ uri: videoMedia.displayUri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode={ResizeMode.COVER}
            shouldPlay={autoPlayVideo}
            isLooping={autoPlayVideo}
            isMuted
            onError={videoMedia.onLoadError}
            onLoad={() => {
              if (!autoPlayVideo) void videoRef.current?.setPositionAsync(0);
            }}
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
    const preset = getTextPostPreset(post.text_style);
    const isDark = resolvedScheme === 'dark';
    const stops = isDark ? preset.dark : preset.light;
    const borderC = isDark ? preset.accentBorderDark : preset.accentBorderLight;
    const fg = isDark ? preset.textDark : preset.textLight;
    const glow = isDark ? preset.glowDark : preset.glowLight;
    /** Soft paper / ink wash — keeps gradients from feeling flat */
    const washA = isDark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.35)';
    const washB = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.02)';
    /** Edge vignette for readability */
    const vignette = isDark
      ? ['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.25)'] as const
      : ['rgba(0,0,0,0.06)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.08)'] as const;
    const metrics = textMetricsForLength(cap.length, compact);
    const textFamily = compact ? font.dmMedium : font.serifItalic;
    const textShadowDark = {
      textShadowColor: 'rgba(0,0,0,0.45)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 6,
    } as const;

    return (
      <LinearGradient
        colors={[stops[0], stops[1], stops[2]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          ...base,
          {
            padding: 0,
            borderWidth: 1,
            borderColor: borderC,
          },
        ]}
      >
        {glow ? (
          <LinearGradient
            colors={[glow.colors[0], glow.colors[1]]}
            start={glow.start}
            end={glow.end}
            style={StyleSheet.absoluteFillObject}
          />
        ) : null}
        <View style={StyleSheet.absoluteFillObject}>
          <LinearGradient
            colors={[washA, washB]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={[vignette[0], vignette[1], vignette[2]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFillObject, { opacity: compact ? 0.55 : 0.85 }]}
          />
          {!compact ? (
            <View
              style={[styles.textAccentBar, { backgroundColor: borderC }]}
              pointerEvents="none"
            />
          ) : null}
          <View
            style={[
              styles.textBodyWrap,
              compact ? styles.textBodyWrapCompact : styles.textBodyWrapFull,
            ]}
          >
            <Text
              style={[
                {
                  color: fg,
                  fontFamily: textFamily,
                  textAlign: compact ? 'center' : 'left',
                  width: '100%',
                  fontSize: metrics.fontSize,
                  lineHeight: metrics.lineHeight,
                  letterSpacing: compact ? -0.1 : 0.2,
                  ...(isDark ? textShadowDark : {}),
                },
              ]}
              numberOfLines={metrics.maxLines}
            >
              {cap}
            </Text>
          </View>
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
  textAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.55,
  },
  textBodyWrap: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  textBodyWrapFull: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 9,
    justifyContent: 'flex-start',
  },
  textBodyWrapCompact: {
    paddingHorizontal: 5,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
