import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/AppThemeContext';
import { tryGetSupabase } from '../src/lib/supabase';
import { font, getColors } from '../src/theme';
import type { SidequestRow } from '../src/types/database';

export default function RateSidequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const { user } = useAuth();
  const { sidequestId } = useLocalSearchParams<{ sidequestId?: string }>();
  const [title, setTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stars, setStars] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const sb = tryGetSupabase();
      if (!sb || !sidequestId) {
        setLoading(false);
        return;
      }
      const { data } = await sb.from('sidequests').select('title').eq('id', sidequestId).maybeSingle();
      const row = data as Pick<SidequestRow, 'title'> | null;
      setTitle(row?.title ?? null);
      setLoading(false);
    };
    void load();
  }, [sidequestId]);

  const finishToFeed = () => {
    router.replace('/(tabs)/feed');
  };

  const submit = async () => {
    if (!user?.id || !sidequestId || stars < 1 || stars > 5) return;
    const sb = tryGetSupabase();
    if (!sb) {
      Alert.alert('Offline', 'Try again when you’re connected.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await sb.from('sidequest_experience_ratings').upsert(
        {
          user_id: user.id,
          sidequest_id: sidequestId,
          stars,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,sidequest_id' },
      );
      if (error) {
        Alert.alert('Could not save rating', error.message);
        return;
      }
      finishToFeed();
    } finally {
      setSubmitting(false);
    }
  };

  if (!sidequestId) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <Text style={{ color: colors.text2, fontFamily: font.dm, padding: 18 }}>Missing sidequest.</Text>
        <Pressable onPress={finishToFeed}>
          <Text style={{ color: colors.accent, fontFamily: font.dmBold, paddingHorizontal: 18 }}>Continue</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.head}>
          <Pressable onPress={finishToFeed} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip">
            <Text style={{ color: colors.text3, fontFamily: font.syne, fontSize: 13 }}>skip</Text>
          </Pressable>
          <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 10, letterSpacing: 1.2 }}>
            ONE TAP
          </Text>
          <View style={{ width: 48 }} />
        </View>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
          ) : (
            <>
              <Text style={[styles.kicker, { color: colors.text3, fontFamily: font.mono }]}>YOU DID IT</Text>
              <Text style={[styles.title, { color: colors.text1, fontFamily: font.syneExtra }]}>
                How was this idea?
              </Text>
              <Text style={[styles.sub, { color: colors.text2, fontFamily: font.dm }]}>
                Rate “{title ?? 'this sidequest'}” — it helps other people spot great prompts.
              </Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setStars(n)}
                    accessibilityRole="button"
                    accessibilityLabel={`${n} stars`}
                    style={styles.starHit}
                  >
                    <Text style={[styles.starChar, { color: n <= stars ? colors.accent : colors.border2 }]}>
                      ★
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.hint, { color: colors.text3, fontFamily: font.dm }]}>
                {stars === 0 ? 'Tap a star to rate' : stars === 5 ? 'Love it' : stars >= 4 ? 'Really good' : 'Thanks for the signal'}
              </Text>
              <Pressable
                disabled={stars < 1 || submitting}
                onPress={() => void submit()}
                style={[
                  styles.cta,
                  {
                    backgroundColor: colors.accent,
                    opacity: stars >= 1 && !submitting ? 1 : 0.45,
                  },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color={resolvedScheme === 'light' ? '#fff' : '#0a0a0a'} />
                ) : (
                  <Text
                    style={{
                      color: resolvedScheme === 'light' ? '#fff' : '#0a0a0a',
                      fontFamily: font.dmBold,
                      fontSize: 16,
                    }}
                  >
                    save rating
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
  },
  scrollContent: { paddingHorizontal: 22, paddingTop: 12, gap: 8 },
  kicker: { fontSize: 11, letterSpacing: 1.4, marginBottom: 6 },
  title: { fontSize: 28, lineHeight: 34, marginBottom: 10 },
  sub: { fontSize: 15, lineHeight: 22, marginBottom: 22 },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 10,
  },
  starHit: { padding: 6 },
  starChar: { fontSize: 44, lineHeight: 48 },
  hint: { textAlign: 'center', fontSize: 13, marginBottom: 22 },
  cta: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
});
