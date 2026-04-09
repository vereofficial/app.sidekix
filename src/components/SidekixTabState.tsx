import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ThemeColors } from '../theme';
import { font } from '../theme';

export type SidekixTabStateReason = 'no-challenge' | 'error';

type Props = {
  variant: 'today' | 'feed';
  reason: SidekixTabStateReason;
  colors: ThemeColors;
  scheme: 'light' | 'dark';
  minHeight: number;
  onRetry?: () => void;
  /** Shadow-feed skeleton (large left + two right). Use for Feed error and Feed no-challenge. */
  showSkeletonBackdrop?: boolean;
  /** Taller skeleton on Campus feed tab; slightly shorter on Friends. */
  feedSkeletonSize?: 'campus' | 'friends';
};

/** Exact copy from marketing / screenshot references. */
function copyFor(variant: 'today' | 'feed'): { title: string; sub: string } {
  if (variant === 'today') {
    return {
      title: "today's sidequest isn't here yet.",
      sub: 'check your connection or try again in a moment.',
    };
  }
  /** Feed tab (Campus + Friends): load/error empty state — not Today copy. */
  return {
    title: "couldn't load the feed.",
    sub: 'check your connection and try again.',
  };
}

function ShadowFeedSkeleton({
  scheme,
  rowHeight,
}: {
  scheme: 'light' | 'dark';
  rowHeight: number;
}) {
  const card =
    scheme === 'light'
      ? { bg: 'rgba(0,0,0,0.06)', border: 'rgba(0,0,0,0.04)' }
      : { bg: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.06)' };

  return (
    <View style={styles.shadowFeedWrap} pointerEvents="none">
      <View style={[styles.shadowFeedRow, { height: rowHeight }]}>
        <View style={[styles.shadowTall, { backgroundColor: card.bg, borderColor: card.border }]} />
        <View style={styles.shadowRight}>
          <View style={[styles.shadowSmall, { backgroundColor: card.bg, borderColor: card.border }]} />
          <View style={[styles.shadowSmall, { backgroundColor: card.bg, borderColor: card.border }]} />
        </View>
      </View>
    </View>
  );
}

const CAMPUS_SKELETON = { upperMinH: 340, rowH: 328 };
/** Slightly smaller than campus so Friends empty state feels lighter. */
const FRIENDS_SKELETON = { upperMinH: 220, rowH: 208 };

export function SidekixTabState({
  variant,
  reason: _reason,
  colors,
  scheme,
  minHeight,
  onRetry,
  showSkeletonBackdrop,
  feedSkeletonSize = 'campus',
}: Props) {
  const { title, sub } = copyFor(variant);
  const isFeed = variant === 'feed';
  const showShadowFeed = Boolean(isFeed && showSkeletonBackdrop);
  const showBolt = !showShadowFeed;
  const sk =
    feedSkeletonSize === 'friends' ? FRIENDS_SKELETON : CAMPUS_SKELETON;

  const ctaLabelColor = '#0a0a0a';

  const iconCardStyle =
    scheme === 'light'
      ? {
          backgroundColor: '#ffffff',
          shadowColor: '#000000',
          shadowOpacity: 0.14,
          shadowOffset: { width: 0, height: 5 },
          shadowRadius: 14,
          elevation: 8,
          borderWidth: 0,
        }
      : {
          backgroundColor: '#242424',
          shadowColor: '#000000',
          shadowOpacity: 0.4,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 10,
          elevation: 6,
          borderWidth: 1,
          borderColor: colors.border2,
        };

  const body = (
    <>
      {showBolt ? (
        <View style={[styles.iconOuter, iconCardStyle]}>
          <LinearGradient
            colors={['#FF8A4A', '#FF3D6E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconGradientInset}
          />
          <Text style={styles.bolt} allowFontScaling>
            ⚡
          </Text>
        </View>
      ) : null}

      <Text
        style={[
          showShadowFeed ? styles.feedHeadline : styles.headline,
          { color: colors.text1, fontFamily: font.syneExtra },
        ]}
        allowFontScaling
      >
        {title}
      </Text>
      <Text
        style={[
          showShadowFeed ? styles.feedSub : styles.sub,
          { color: colors.text2, fontFamily: font.dm },
        ]}
        allowFontScaling
      >
        {sub}
      </Text>

      {onRetry ? (
        showShadowFeed ? (
          <View style={styles.feedCtaOuter}>
            <Pressable
              onPress={onRetry}
              style={({ pressed }) => [
                styles.feedCta,
                { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Text
                style={[styles.feedCtaText, { color: ctaLabelColor, fontFamily: font.syne }]}
                allowFontScaling
              >
                try again
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={onRetry}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={[styles.ctaText, { color: ctaLabelColor, fontFamily: font.syne }]} allowFontScaling>
              try again
            </Text>
          </Pressable>
        )
      ) : null}
    </>
  );

  if (isFeed && showShadowFeed) {
    return (
      <View style={[styles.feedRoot, { minHeight }]}>
        <View style={[styles.feedUpper, { minHeight: sk.upperMinH }]}>
          <ShadowFeedSkeleton scheme={scheme} rowHeight={sk.rowH} />
        </View>
        <View style={styles.feedLower}>{body}</View>
      </View>
    );
  }

  return (
    <View style={[styles.todayRoot, { minHeight }]}>
      <View style={styles.todayInner}>{body}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  feedRoot: {
    width: '100%',
    justifyContent: 'flex-start',
  },
  feedUpper: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 8,
    justifyContent: 'center',
  },
  shadowFeedWrap: {
    width: '100%',
    alignItems: 'center',
  },
  shadowFeedRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    width: '100%',
    maxWidth: 360,
  },
  shadowTall: {
    flex: 1.2,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  shadowRight: {
    flex: 1,
    gap: 12,
  },
  shadowSmall: {
    flex: 1,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  feedLower: {
    width: '100%',
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 36,
    alignItems: 'center',
  },
  todayRoot: {
    width: '100%',
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
  },
  todayInner: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  iconOuter: {
    width: 88,
    height: 88,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  /** Inset gradient tile inside the white / dark card (shadow mock). */
  iconGradientInset: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 10,
    bottom: 10,
    borderRadius: 14,
  },
  bolt: {
    fontSize: 38,
    zIndex: 1,
  },
  headline: {
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 16,
  },
  /** Feed shadow state: compact type in lower panel (mock), not Today hero size. */
  feedHeadline: {
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.35,
    textAlign: 'center',
    marginBottom: 10,
    maxWidth: 300,
    paddingHorizontal: 4,
  },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  feedSub: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
    maxWidth: 300,
  },
  cta: {
    marginTop: 36,
    alignSelf: 'stretch',
    borderRadius: 999,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
  },
  /** Caps width and centers the pill in the feed lower panel. */
  feedCtaOuter: {
    marginTop: 24,
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
  },
  feedCta: {
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  feedCtaText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.25,
  },
});
