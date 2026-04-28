import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { challengeTag, splitChallengeTitle } from '../challenge';
import { GradientThumb } from '../components/GradientThumb';
import { PostMediaTile } from '../components/PostMediaTile';
import { Wordmark } from '../components/Wordmark';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/AppThemeContext';
import { usePostCount } from '../hooks/usePostCount';
import { usePostsForChallenge } from '../hooks/usePostsForChallenge';
import { useTodayChallenge } from '../hooks/useTodayChallenge';
import { hapticMedium } from '../lib/haptics';
import { font, getColors } from '../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Phase = 'guest' | 'oauth';

const GUEST_PLACEHOLDER_GRADIENTS = [3, 6, 0, 2];

export function HomeFlow() {
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const scheme = resolvedScheme;
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { signInWithGoogle, signInWithApple } = useAuth();
  const { challenge, loading: chLoading } = useTodayChallenge();
  const { count: postCount } = usePostCount(challenge?.id ?? null);
  const { posts: recentPosts } = usePostsForChallenge(challenge?.id ?? null, 4, undefined, Boolean(challenge?.id));

  const [phase, setPhase] = useState<Phase>('guest');
  const [busyProvider, setBusyProvider] = useState<'google' | 'apple' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const joinScale = useRef(new Animated.Value(1)).current;

  const bannerHeadline =
    postCount < 10
      ? 'Be one of the first to post this sidequest'
      : `${postCount} ${postCount === 1 ? 'person has' : 'people have'} posted this sidequest`;

  const guestGridGap = 7;
  const guestTileWidth = Math.max(0, (windowWidth - 36 - guestGridGap) / 2);
  const guestTileHeight = (guestTileWidth * 4) / 3;

  const goJoin = () => {
    hapticMedium();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.sequence([
      Animated.timing(joinScale, { toValue: 0.94, duration: 90, useNativeDriver: true }),
      Animated.spring(joinScale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start(() => setPhase('oauth'));
  };

  const startGoogle = async () => {
    setFormError(null);
    setBusyProvider('google');
    const { error } = await signInWithGoogle();
    setBusyProvider(null);
    if (error) setFormError(error);
  };

  const startApple = async () => {
    setFormError(null);
    setBusyProvider('apple');
    const { error } = await signInWithApple();
    setBusyProvider(null);
    if (error) setFormError(error);
  };

  if (phase === 'guest') {
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <Wordmark colors={colors} />
            <Text style={[styles.guestPill, { color: colors.text3, fontFamily: font.syne }]}>GUEST</Text>
          </View>
          <View style={styles.hero}>
            {chLoading ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
            ) : challenge ? (
              <>
                <Text style={[styles.challengeTag, { color: colors.text3, fontFamily: font.syne }]}>
                  {challengeTag(challenge)}
                </Text>
                <Text style={[styles.challengeTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>
                  {(() => {
                    const { before, after } = splitChallengeTitle(challenge);
                    return (
                      <>
                        {before}
                        <Text style={{ color: colors.accent, fontStyle: 'normal' }}>{challenge.emphasis}</Text>
                        {after}
                      </>
                    );
                  })()}
                </Text>
              </>
            ) : (
              <Text style={[styles.challengeTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>
                No sidequest loaded yet
              </Text>
            )}
          </View>
          <LinearGradient
            colors={
              scheme === 'dark'
                ? ['rgba(212,255,63,0.14)', 'rgba(212,255,63,0.03)', 'transparent']
                : ['rgba(90,122,0,0.12)', 'rgba(90,122,0,0.04)', 'transparent']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.banner, { borderColor: colors.lightAccentBorder }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerStrong, { color: colors.text1, fontFamily: font.syne }]}>{bannerHeadline}</Text>
              <Text style={[styles.bannerSub, { color: colors.text2, fontFamily: font.dm }]}>
                Sign up to see posts and join the leaderboard.
              </Text>
            </View>
            <Animated.View style={{ transform: [{ scale: joinScale }] }}>
              <Pressable onPress={goJoin} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, borderRadius: 20, overflow: 'hidden' }]}>
                <LinearGradient
                  colors={scheme === 'dark' ? ['#D4FF3F', '#a6c42a'] : ['#5a7a00', '#6d8a18']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.joinBtn}
                >
                  <Text style={[styles.joinBtnText, { color: scheme === 'light' ? '#fff' : '#0a0a0a', fontFamily: font.syne }]}>
                    join →
                  </Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </LinearGradient>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.text3, fontFamily: font.syne }]}>Recent submissions</Text>
          </View>
          <View
            style={[
              styles.guestBlurWrap,
              {
                backgroundColor: colors.bg3,
                minHeight: guestTileHeight * 2 + guestGridGap,
              },
            ]}
          >
            <View style={[styles.guestGrid, { gap: guestGridGap }]}>
              {[0, 1, 2, 3].map((i) => {
                const p = recentPosts[i];
                return (
                  <View
                    key={p?.id ?? `slot-${i}`}
                    style={[
                      styles.guestCard,
                      { width: guestTileWidth, height: guestTileHeight },
                    ]}
                  >
                    {p ? (
                      <PostMediaTile post={p} style={StyleSheet.absoluteFillObject} borderRadius={10} />
                    ) : (
                      <GradientThumb
                        index={GUEST_PLACEHOLDER_GRADIENTS[i]}
                        style={StyleSheet.absoluteFillObject}
                        borderRadius={10}
                      />
                    )}
                  </View>
                );
              })}
            </View>
            <BlurView
              pointerEvents="none"
              intensity={Platform.OS === 'android' ? 100 : 72}
              tint={scheme === 'dark' ? 'dark' : 'light'}
              experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
              style={StyleSheet.absoluteFill}
            />
            {Platform.OS === 'ios' ? (
              <BlurView
                pointerEvents="none"
                intensity={38}
                tint={scheme === 'dark' ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <View
              style={[
                styles.lockOverlay,
                {
                  backgroundColor:
                    scheme === 'dark' ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.42)',
                },
              ]}
              pointerEvents="none"
            >
              <Text style={{ fontSize: 28 }}>🔒</Text>
            </View>
          </View>
        </ScrollView>
        <View style={[styles.footer, { backgroundColor: colors.navBg, borderTopColor: colors.navBorder }]}>
          <Animated.View style={{ transform: [{ scale: joinScale }] }}>
            <Pressable
              onPress={goJoin}
              style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1, borderRadius: 50, overflow: 'hidden' }]}
            >
              <LinearGradient
                colors={scheme === 'dark' ? ['#D4FF3F', '#9fb82e'] : ['#5a7a00', '#7a9a20']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.fullSubmit}
              >
                <Text style={[styles.fullSubmitText, { color: scheme === 'light' ? '#fff' : '#0a0a0a', fontFamily: font.syne }]}>
                  join to participate
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, 28),
        }}
      >
        <View style={styles.obScrollTop}>
          <Text style={styles.obEmoji}>⚡</Text>
          <Text style={[styles.obTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>
            every <Text style={{ color: colors.accent, fontStyle: 'normal' }}>mon & fri</Text> at{' '}
            <Text style={{ color: colors.accent, fontStyle: 'normal' }}>10am</Text> a new{' '}
            <Text style={{ color: colors.accent, fontStyle: 'normal' }}>sidequest</Text> drops.
          </Text>
          <Text style={[styles.obSub, { color: colors.text2, fontFamily: font.dm }]}>
            post your take. see what campus is doing.
            {'\n'}
            win a weekly prize.
          </Text>
        </View>
        <View style={styles.obScrollBottom}>
          {formError ? (
            <Text style={{ color: '#f66', fontFamily: font.dm, marginBottom: 12, textAlign: 'center', paddingHorizontal: 12 }}>
              {formError}
            </Text>
          ) : null}
          <Pressable
            onPress={startGoogle}
            disabled={Boolean(busyProvider)}
            style={({ pressed }) => [
              styles.oauthBtn,
              {
                borderColor: colors.border2,
                backgroundColor: colors.card,
                opacity: pressed || busyProvider ? 0.85 : 1,
              },
            ]}
          >
            {busyProvider === 'google' ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={[styles.oauthBtnText, { color: colors.text1, fontFamily: font.syne }]}>continue with google</Text>
            )}
          </Pressable>
          {Platform.OS === 'ios' ? (
            <Pressable
              onPress={startApple}
              disabled={Boolean(busyProvider)}
              style={({ pressed }) => [
                styles.oauthBtn,
                {
                  borderColor: colors.border2,
                  backgroundColor: scheme === 'dark' ? '#fff' : '#111',
                  opacity: pressed || busyProvider ? 0.85 : 1,
                },
              ]}
            >
              {busyProvider === 'apple' ? (
                <ActivityIndicator color={scheme === 'dark' ? '#0A0A0A' : '#fff'} />
              ) : (
                <Text
                  style={[
                    styles.oauthBtnText,
                    { color: scheme === 'dark' ? '#0A0A0A' : '#fff', fontFamily: font.syne },
                  ]}
                >
                  continue with apple
                </Text>
              )}
            </Pressable>
          ) : null}
          <Pressable onPress={() => setPhase('guest')}>
            <Text style={[styles.secondaryBtn, { color: colors.text2, fontFamily: font.syne }]}>peek first, sign up later</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginTop: 4,
  },
  guestPill: { fontSize: 10, letterSpacing: 0.6 },
  hero: { paddingHorizontal: 18, paddingTop: 18, minHeight: 80 },
  challengeTag: { fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 7 },
  challengeTitle: { fontSize: 26, lineHeight: 30, letterSpacing: -0.3 },
  banner: {
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerStrong: { fontSize: 12, marginBottom: 2 },
  bannerSub: { fontSize: 12, lineHeight: 17 },
  joinBtn: { borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14 },
  joinBtnText: { fontSize: 11, fontWeight: '800' },
  sectionRow: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 },
  sectionTitle: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  guestBlurWrap: { marginHorizontal: 18, borderRadius: 14, overflow: 'hidden', position: 'relative' },
  guestGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 0 },
  guestCard: { borderRadius: 10, overflow: 'hidden' },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
    borderTopWidth: 1,
  },
  fullSubmit: { borderRadius: 50, paddingVertical: 15, alignItems: 'center' },
  fullSubmitText: { fontSize: 15, fontWeight: '800' },
  obScrollTop: {
    flexGrow: 1,
    minHeight: 220,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  obScrollBottom: { paddingHorizontal: 24, gap: 12 },
  obEmoji: { fontSize: 42, marginBottom: 16 },
  obTitle: { fontSize: 24, textAlign: 'center', lineHeight: 28, marginBottom: 10 },
  obSub: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  oauthBtn: {
    borderRadius: 50,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  oauthBtnText: { fontSize: 15, fontWeight: '800' },
  secondaryBtn: { textAlign: 'center', paddingVertical: 12, marginTop: 4, fontSize: 13, fontWeight: '600' },
});
