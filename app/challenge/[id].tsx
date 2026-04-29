import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PostMediaTile } from '../../src/components/PostMediaTile';
import { useAppTheme } from '../../src/context/AppThemeContext';
import { useLegacyChallengePosts } from '../../src/hooks/useLegacyChallengePosts';
import { tryGetSupabase } from '../../src/lib/supabase';
import type { ChallengeRow } from '../../src/types/database';
import { font, getColors } from '../../src/theme';

export default function LegacyChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const { posts, usernames, loading, refresh } = useLegacyChallengePosts(id);
  const [challenge, setChallenge] = useState<ChallengeRow | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const sb = tryGetSupabase();
      if (!sb) return;
      const { data } = await sb.from('challenges').select('*').eq('id', id).maybeSingle();
      setChallenge((data as ChallengeRow | null) ?? null);
    };
    void load();
  }, [id]);
  const onBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: Math.max(24, insets.bottom) }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
      >
        <Pressable onPress={onBack} hitSlop={12} style={{ marginBottom: 4 }}>
          <Text style={{ color: colors.text1, fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text1, fontFamily: font.serifItalic }]}>
          {challenge?.title ?? 'legacy sidequest'}
        </Text>
        <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 11 }}>
          {posts.length} {posts.length === 1 ? 'past post' : 'past posts'}
        </Text>
        {loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} /> : null}
        {posts.map((p) => (
          <View key={p.id} style={[styles.card, { borderColor: colors.border2, backgroundColor: colors.card }]}>
            <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 10, marginBottom: 8 }}>
              {p.is_anonymous ? 'anonymous' : `@${usernames[p.user_id] ?? 'user'}`}
            </Text>
            <PostMediaTile post={p} style={styles.media} borderRadius={10} />
            {p.caption ? <Text style={{ color: colors.text2, fontFamily: font.dm, marginTop: 8 }}>{p.caption}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 34, lineHeight: 38 },
  card: { borderWidth: 1, borderRadius: 14, padding: 10 },
  media: { width: '100%', aspectRatio: 4 / 3, borderRadius: 10, overflow: 'hidden' },
});
