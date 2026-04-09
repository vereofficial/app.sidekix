import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
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
  TextInput,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { challengeTag, splitChallengeTitle } from '../challenge';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/AppThemeContext';
import { ChallengeDropOverlay } from '../components/ChallengeDropOverlay';
import { GradientThumb } from '../components/GradientThumb';
import { PostMediaTile } from '../components/PostMediaTile';
import { Wordmark } from '../components/Wordmark';
import { usePostCount } from '../hooks/usePostCount';
import { usePostsForChallenge } from '../hooks/usePostsForChallenge';
import { useTodayChallenge } from '../hooks/useTodayChallenge';
import { markChallengeDropDismissed } from '../lib/challengeDropStorage';
import { hapticMedium } from '../lib/haptics';
import { font, getColors } from '../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Phase = 'guest' | 'phone' | 'otp' | 'profile' | 'drop';

/** Gradient preset indices for the 4 guest preview tiles when posts are missing. */
const GUEST_PLACEHOLDER_GRADIENTS = [3, 6, 0, 2];

function toE164US(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length !== 10) return '';
  return `+1${d}`;
}

export function HomeFlow() {
  const router = useRouter();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const scheme = resolvedScheme;
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { signInWithPhone, verifyPhoneOtp, saveProfile, signInWithEmailPassword } = useAuth();

  const [phase, setPhase] = useState<Phase>('guest');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [otp, setOtp] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [devEmail, setDevEmail] = useState('');
  const [devPassword, setDevPassword] = useState('');

  const joinScale = useRef(new Animated.Value(1)).current;
  const { challenge, loading: chLoading } = useTodayChallenge();
  const { count: postCount } = usePostCount(challenge?.id ?? null);
  const { posts: recentPosts } = usePostsForChallenge(challenge?.id ?? null, 4, undefined, !chLoading);

  const bannerHeadline =
    postCount < 10
      ? 'Be one of the first to post today'
      : `${postCount} ${postCount === 1 ? 'person has' : 'people have'} posted today`;

  const guestGridGap = 7;
  const guestTileWidth = Math.max(0, (windowWidth - 36 - guestGridGap) / 2);
  const guestTileHeight = (guestTileWidth * 4) / 3;

  const e164 = useMemo(() => toE164US(phoneDigits), [phoneDigits]);

  const goJoin = () => {
    hapticMedium();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.sequence([
      Animated.timing(joinScale, { toValue: 0.94, duration: 90, useNativeDriver: true }),
      Animated.spring(joinScale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start(() => setPhase('phone'));
  };

  const sendCode = async () => {
    setFormError(null);
    if (!e164) {
      setFormError('Enter a valid 10-digit US number.');
      return;
    }
    setBusy(true);
    const { error } = await signInWithPhone(e164);
    setBusy(false);
    if (error) setFormError(error);
    else setPhase('otp');
  };

  const verify = async () => {
    setFormError(null);
    if (otp.trim().length < 6) {
      setFormError('Enter the 6-digit code from SMS.');
      return;
    }
    setBusy(true);
    const { error, profile: row } = await verifyPhoneOtp(e164, otp.trim());
    setBusy(false);
    if (error) {
      setFormError(error);
      return;
    }
    if (!row) setPhase('profile');
    else setPhase('drop');
  };

  const completeProfile = async () => {
    setFormError(null);
    const u = username.trim().replace(/^@/, '');
    if (u.length < 3) {
      setFormError('Pick a username (at least 3 characters).');
      return;
    }
    setBusy(true);
    const { error } = await saveProfile(u);
    setBusy(false);
    if (error) setFormError(error);
    else setPhase('drop');
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
                No sidequest for today yet
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
              experimentalBlurMethod={
                Platform.OS === 'android' ? 'dimezisBlurView' : undefined
              }
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

  if (phase === 'phone' || phase === 'otp') {
    const step = phase === 'phone' ? 1 : 2;
    return (
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: colors.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
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
            <View style={styles.dots}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: colors.border2 },
                  step === 1 && { backgroundColor: colors.accent, width: 18 },
                ]}
              />
              <View
                style={[
                  styles.dot,
                  { backgroundColor: colors.border2 },
                  step === 2 && { backgroundColor: colors.accent, width: 18 },
                ]}
              />
            </View>
            {step === 1 ? (
              <>
                <Text style={styles.obEmoji}>⚡</Text>
                <Text style={[styles.obTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>
                  every day at 10am{'\n'}a <Text style={{ color: colors.accent, fontStyle: 'normal' }}>sidequest</Text> drops.
                </Text>
                <Text style={[styles.obSub, { color: colors.text2, fontFamily: font.dm }]}>
                  post your take. see what campus is doing. win a weekly prize.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.obEmoji}>📲</Text>
                <Text style={[styles.obTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>check your texts</Text>
                <Text style={[styles.obSub, { color: colors.text2, fontFamily: font.dm }]}>
                  enter the 6-digit code we sent to {e164 || 'your number'}
                </Text>
                <TextInput
                  value={otp}
                  onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  style={[styles.otpInput, { color: colors.text1, fontFamily: font.syneExtra, borderColor: colors.accent }]}
                  placeholder="••••••"
                  placeholderTextColor={colors.text3}
                />
              </>
            )}
          </View>
          <View style={styles.obScrollBottom}>
            {formError ? (
              <Text style={{ color: '#f66', fontFamily: font.dm, marginBottom: 12, textAlign: 'center', paddingHorizontal: 12 }}>
                {formError}
              </Text>
            ) : null}
            {step === 1 ? (
              <>
                <View style={[styles.phoneWrap, { backgroundColor: colors.card, borderColor: colors.border2 }]}>
                  <Text style={{ fontSize: 18 }}>🇺🇸</Text>
                  <TextInput
                    value={phoneDigits}
                    onChangeText={(t) => setPhoneDigits(t.replace(/\D/g, '').slice(0, 10))}
                    keyboardType="phone-pad"
                    placeholder="5551234567"
                    placeholderTextColor={colors.text3}
                    style={[styles.phoneInput, { color: colors.text1, fontFamily: font.syne }]}
                  />
                </View>
                <Pressable
                  onPress={sendCode}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { backgroundColor: colors.accent, opacity: pressed || busy ? 0.85 : 1 },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color={scheme === 'light' ? '#fff' : '#0a0a0a'} />
                  ) : (
                    <Text style={[styles.primaryBtnText, { color: scheme === 'light' ? '#fff' : '#0a0a0a', fontFamily: font.syne }]}>
                      send code →
                    </Text>
                  )}
                </Pressable>
                <Pressable onPress={() => setPhase('guest')}>
                  <Text style={[styles.secondaryBtn, { color: colors.text2, fontFamily: font.syne }]}>peek first, sign up later</Text>
                </Pressable>
                {__DEV__ ? (
                  <View
                    style={{
                      marginTop: 22,
                      paddingTop: 18,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border2,
                    }}
                  >
                    <TextInput
                      value={devEmail}
                      onChangeText={setDevEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      placeholder="dev@you.com"
                      placeholderTextColor={colors.text3}
                      style={[
                        styles.usernameField,
                        { marginBottom: 10, backgroundColor: colors.card, borderColor: colors.border2, color: colors.text1 },
                      ]}
                    />
                    <TextInput
                      value={devPassword}
                      onChangeText={setDevPassword}
                      secureTextEntry
                      placeholder="password"
                      placeholderTextColor={colors.text3}
                      style={[
                        styles.usernameField,
                        { marginBottom: 12, backgroundColor: colors.card, borderColor: colors.border2, color: colors.text1 },
                      ]}
                    />
                    <Pressable
                      onPress={async () => {
                        setFormError(null);
                        setBusy(true);
                        const { error } = await signInWithEmailPassword(devEmail, devPassword);
                        setBusy(false);
                        if (error) setFormError(error);
                      }}
                      disabled={busy}
                      style={({ pressed }) => [
                        styles.primaryBtn,
                        {
                          backgroundColor: colors.bg3,
                          borderWidth: 1,
                          borderColor: colors.border2,
                          opacity: pressed || busy ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.primaryBtnText, { color: colors.text1, fontFamily: font.syne }]}>
                        dev: sign in with email →
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </>
            ) : (
              <Pressable
                onPress={verify}
                disabled={busy}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: colors.accent, opacity: pressed || busy ? 0.85 : 1 },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={scheme === 'light' ? '#fff' : '#0a0a0a'} />
                ) : (
                  <Text style={[styles.primaryBtnText, { color: scheme === 'light' ? '#fff' : '#0a0a0a', fontFamily: font.syne }]}>
                    verify →
                  </Text>
                )}
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (phase === 'profile') {
    return (
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: colors.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top,
            paddingBottom: Math.max(insets.bottom, 28),
            paddingHorizontal: 28,
            justifyContent: 'center',
            minHeight: 360,
          }}
        >
          <Text style={[styles.obTitle, { color: colors.text1, fontFamily: font.syneExtra, marginBottom: 8 }]}>
            claim your handle
          </Text>
          <Text style={[styles.obSub, { color: colors.text2, fontFamily: font.dm, marginBottom: 20 }]}>
            we start everyone with a random name — pick something you like, or keep it and change later in the you tab.
          </Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="wandering_cactus42"
            placeholderTextColor={colors.text3}
            style={[
              styles.usernameField,
              { backgroundColor: colors.card, borderColor: colors.border2, color: colors.text1, fontFamily: font.dm },
            ]}
          />
          {formError ? <Text style={{ color: '#f66', fontFamily: font.dm, marginBottom: 12 }}>{formError}</Text> : null}
          <Pressable
            onPress={completeProfile}
            disabled={busy}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: colors.accent, opacity: pressed || busy ? 0.85 : 1 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={scheme === 'light' ? '#fff' : '#0a0a0a'} />
            ) : (
              <Text style={[styles.primaryBtnText, { color: scheme === 'light' ? '#fff' : '#0a0a0a', fontFamily: font.syne }]}>
                continue →
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <ChallengeDropOverlay
      colors={colors}
      scheme={scheme}
      insetsTop={insets.top}
      challenge={challenge}
      onGo={async () => {
        await markChallengeDropDismissed();
        router.replace('/today');
      }}
    />
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
  obScrollBottom: { paddingHorizontal: 24 },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  obEmoji: { fontSize: 42, marginBottom: 16 },
  obTitle: { fontSize: 24, textAlign: 'center', lineHeight: 28, marginBottom: 10 },
  obSub: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  phoneWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    width: '100%',
  },
  phoneInput: { flex: 1, fontSize: 18, letterSpacing: 0.5, padding: 0 },
  otpInput: {
    marginBottom: 16,
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 28,
    letterSpacing: 12,
    textAlign: 'center',
    width: '100%',
    maxWidth: 280,
  },
  primaryBtn: { borderRadius: 50, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { fontSize: 15, fontWeight: '800' },
  secondaryBtn: { textAlign: 'center', paddingVertical: 12, marginTop: 4, fontSize: 13, fontWeight: '600' },
  usernameField: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    width: '100%',
  },
});
