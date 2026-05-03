import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { setHomeFeedMode, type HomeFeedMode } from '../src/lib/homeFeedPreference';
import { hapticLight } from '../src/lib/haptics';
import { markOnboardingCompleted } from '../src/lib/onboardingStorage';
import { tryGetSupabase } from '../src/lib/supabase';
import { font } from '../src/theme';

/** Warm onboarding shell — olive accent CTA (Instrument + DM). */
const O = {
  bg: '#e8e4db',
  s1: '#ffffff',
  s2: '#f5f1ea',
  bd: '#ddd8ce',
  bd2: '#ccc6ba',
  ink: '#1a1a0f',
  ink2: '#5a5642',
  ink3: '#9a9480',
  ink4: '#c8c2b0',
  acc: '#4a6114',
  accPressed: '#3d5210',
  accDim: 'rgba(74,97,20,0.09)',
  accMid: 'rgba(74,97,20,0.2)',
  btnDisabled: '#ddd8ce',
} as const;

const CATEGORIES = ['food/drink', 'outdoor', 'social', 'trend', 'creative', 'chaotic'] as const;

const CONTENT_MAX = 420;

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAdmin } = useAuth();
  const [idea, setIdea] = useState('');
  const [mode, setMode] = useState<HomeFeedMode>('feed');
  const [cats, setCats] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const hasIdea = idea.trim().length > 0;
  const canFinish = useMemo(() => hasIdea && !busy, [hasIdea, busy]);

  const toggleCat = (cat: string) => {
    hapticLight();
    setCats((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  const selectMode = (next: HomeFeedMode) => {
    hapticLight();
    setMode(next);
  };

  const finish = async () => {
    if (!user?.id || !canFinish) return;
    const sb = tryGetSupabase();
    if (!sb) {
      Alert.alert('Offline', 'Connect to finish onboarding.');
      return;
    }
    setBusy(true);
    const { error } = await sb.from('sidequests').insert({
      creator_id: user.id,
      title: idea.trim(),
      categories: cats,
      is_anonymous: false,
      approval_status: isAdmin ? 'approved' : 'pending',
    });
    if (error) {
      setBusy(false);
      Alert.alert('Could not finish onboarding', error.message);
      return;
    }
    await setHomeFeedMode(user.id, mode);
    await markOnboardingCompleted(user.id);
    router.replace('/(tabs)/home');
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: O.bg, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingBottom: Math.max(insets.bottom, 36),
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: '100%', maxWidth: CONTENT_MAX }}>
          <Text style={styles.eyebrow}>one step</Text>
          <Text style={styles.title}>before you start</Text>
          <Text style={styles.sub}>
            drop one sidequest idea to get access. that’s the only requirement.
          </Text>

          {/* Idea + vibe */}
          <View style={styles.card}>
            <View style={styles.cardPad}>
              <Text style={styles.monoLabel}>your idea</Text>
            </View>
            <TextInput
              value={idea}
              onChangeText={setIdea}
              placeholder="dare someone to do something interesting..."
              placeholderTextColor={O.ink4}
              style={[styles.ideaField, hasIdea ? styles.ideaFieldFilled : styles.ideaFieldEmpty]}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.tagsBlock}>
              <Text style={styles.monoLabel}>vibe (optional)</Text>
              <View style={styles.tagsRow}>
                {CATEGORIES.map((c) => {
                  const on = cats.includes(c);
                  return (
                    <Pressable
                      key={c}
                      onPress={() => toggleCat(c)}
                      style={[styles.tag, on && styles.tagOn]}
                    >
                      <Text style={[styles.tagText, on && styles.tagTextOn]}>{c}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Feed preference */}
          <View style={[styles.card, { marginTop: 12 }]}>
            <View style={styles.viewHead}>
              <Text style={styles.monoLabel}>preferred feed view</Text>
            </View>
            <View style={styles.viewToggle}>
              <Pressable
                onPress={() => selectMode('feed')}
                style={[styles.viewOpt, mode === 'feed' && styles.viewOptOn]}
              >
                <Text style={[styles.viewOptText, mode === 'feed' && styles.viewOptTextOn]}>sidequest view</Text>
              </Pressable>
              <Pressable
                onPress={() => selectMode('recent')}
                style={[styles.viewOpt, mode === 'recent' && styles.viewOptOn]}
              >
                <Text style={[styles.viewOptText, mode === 'recent' && styles.viewOptTextOn]}>feed view</Text>
              </Pressable>
            </View>
            <View style={styles.descBlock}>
              <View style={styles.descRow}>
                <View style={[styles.dot, mode === 'feed' && styles.dotOn]} />
                <Text style={[styles.descText, mode === 'feed' && styles.descTextActive]}>
                  <Text style={styles.descStrong}>sidequest view</Text>
                  {' — '}
                  ideas grouped together with adventures nested underneath each one
                </Text>
              </View>
              <View style={styles.descRow}>
                <View style={[styles.dot, mode === 'recent' && styles.dotOn]} />
                <Text style={[styles.descText, mode === 'recent' && styles.descTextActive]}>
                  <Text style={styles.descStrong}>feed view</Text>
                  {' — '}
                  a single stream of ideas and adventures as they’re posted
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            disabled={!canFinish}
            onPress={() => void finish()}
            android_ripple={
              canFinish ? { color: 'rgba(255,255,255,0.22)', foreground: true } : undefined
            }
            style={({ pressed }) => [
              styles.submitBtn,
              !canFinish && styles.submitBtnInactive,
              canFinish && pressed && styles.submitBtnPressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.submitLabel, !canFinish && styles.submitLabelInactive]}>get in →</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  eyebrow: {
    fontFamily: font.monoMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: O.acc,
    marginBottom: 6,
  },
  title: {
    fontFamily: font.serifItalic,
    fontSize: 36,
    lineHeight: 40,
    color: O.ink,
    marginBottom: 8,
  },
  sub: {
    fontFamily: font.dm,
    fontSize: 13.5,
    lineHeight: 20,
    color: O.ink2,
    marginBottom: 24,
  },
  card: {
    backgroundColor: O.s1,
    borderWidth: 1,
    borderColor: O.bd,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1a1a0f',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardPad: { paddingTop: 13, paddingHorizontal: 15, paddingBottom: 0 },
  monoLabel: {
    fontFamily: font.monoMedium,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: O.ink3,
    marginBottom: 8,
  },
  ideaField: {
    minHeight: 80,
    paddingHorizontal: 15,
    paddingBottom: 14,
    fontSize: 16,
    lineHeight: 24,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  ideaFieldEmpty: {
    fontFamily: font.serifItalic,
    color: O.ink4,
  },
  ideaFieldFilled: {
    fontFamily: font.serifItalic,
    color: O.ink,
  },
  tagsBlock: {
    paddingHorizontal: 15,
    paddingTop: 11,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: O.bd,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: O.bd,
    backgroundColor: O.s2,
  },
  tagOn: {
    backgroundColor: O.accDim,
    borderColor: O.accMid,
  },
  tagText: {
    fontFamily: font.dmMedium,
    fontSize: 12,
    color: O.ink2,
  },
  tagTextOn: {
    color: O.acc,
    fontWeight: '600',
  },
  viewHead: {
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: O.bd,
  },
  viewToggle: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  viewOpt: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: O.s2,
    borderWidth: 1.5,
    borderColor: O.bd,
  },
  viewOptOn: {
    backgroundColor: O.acc,
    borderColor: O.acc,
  },
  viewOptText: {
    fontFamily: font.dmBold,
    fontSize: 12.5,
    color: O.ink3,
    textAlign: 'center',
  },
  viewOptTextOn: {
    color: '#fff',
  },
  descBlock: {
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 6,
  },
  descRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: O.bd2,
    marginTop: 5,
  },
  dotOn: { backgroundColor: O.acc },
  descText: {
    flex: 1,
    fontFamily: font.dm,
    fontSize: 12,
    lineHeight: 17,
    color: O.ink3,
  },
  descTextActive: { color: O.ink2 },
  descStrong: { fontWeight: '600', color: O.ink },
  submitBtn: {
    marginTop: 20,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: O.acc,
  },
  submitBtnPressed: { backgroundColor: O.accPressed },
  submitBtnInactive: {
    backgroundColor: O.btnDisabled,
  },
  submitLabel: {
    fontFamily: font.dmBold,
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.2,
  },
  submitLabelInactive: {
    color: O.ink3,
  },
});
