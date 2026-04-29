import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PostMediaTile } from '../../src/components/PostMediaTile';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/AppThemeContext';
import { useSidequestPosts } from '../../src/hooks/useSidequestPosts';
import { tryGetSupabase } from '../../src/lib/supabase';
import { font, getColors } from '../../src/theme';
import type { SidequestRow } from '../../src/types/database';

export default function SidequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const { user, isAdmin } = useAuth();
  const [sidequest, setSidequest] = useState<SidequestRow | null>(null);
  const { posts, usernames, loading, refresh } = useSidequestPosts(id);
  const completedCount = posts.length;
  const communityRating =
    completedCount === 0 ? 0 : Number(Math.min(5, 3.8 + Math.log10(completedCount + 1)).toFixed(1));

  useEffect(() => {
    const load = async () => {
      const sb = tryGetSupabase();
      if (!sb || !id) return;
      const { data } = await sb.from('sidequests').select('*').eq('id', id).maybeSingle();
      setSidequest((data ?? null) as SidequestRow | null);
    };
    void load();
  }, [id]);

  const removeAdventure = async (postId: string) => {
    const sb = tryGetSupabase();
    if (!sb) return;
    const { error } = await sb.from('sidequest_posts').delete().eq('id', postId);
    if (!error) await refresh();
  };
  const onBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home');
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={{ color: colors.text1, fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text1, fontFamily: font.syneExtra }]}>sidequest</Text>
      </View>
      {sidequest ? (
        <LinearGradient
          colors={resolvedScheme === 'dark' ? ['#1d2a1e', '#0d0d10', '#0f1116'] : ['#f6f1e7', '#ffffff']}
          style={[styles.hero, { borderColor: colors.border2 }]}
        >
          <View style={[styles.heroBadge, { backgroundColor: resolvedScheme === 'dark' ? '#2a1f35' : '#f4e8ff' }]}>
            <Text style={{ color: resolvedScheme === 'dark' ? '#e0bcff' : '#7a4ba8', fontFamily: font.mono, fontSize: 10 }}>
              {(sidequest.categories?.[0] ?? 'sidequest').toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.heroTitle, { color: resolvedScheme === 'dark' ? '#fff' : colors.text1, fontFamily: font.dmBold }]}>{sidequest.title}</Text>
          <Text style={{ color: resolvedScheme === 'dark' ? '#b4b4b9' : colors.text2, fontFamily: font.dm, marginTop: 8 }}>
            Pick a spot, do the quest, post what happened.
          </Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: resolvedScheme === 'dark' ? '#ffd34d' : colors.text1, fontFamily: font.dmBold }]}>
                {completedCount}
              </Text>
              <Text style={[styles.metricLabel, { color: resolvedScheme === 'dark' ? '#a6a6ad' : colors.text3, fontFamily: font.mono }]}>completed</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: resolvedScheme === 'dark' ? '#ffd34d' : colors.text1, fontFamily: font.dmBold }]}>
                {communityRating.toFixed(1)}
              </Text>
              <Text style={[styles.metricLabel, { color: resolvedScheme === 'dark' ? '#a6a6ad' : colors.text3, fontFamily: font.mono }]}>rating</Text>
            </View>
          </View>
          <Pressable onPress={() => router.push('/new-adventure')} style={styles.questBtn}>
            <Text style={{ color: '#111', fontFamily: font.dmBold, fontSize: 16 }}>I did this quest ✓</Text>
          </Pressable>
          <View style={styles.catRow}>
            {(sidequest.categories ?? []).map((c) => (
              <View key={c} style={[styles.cat, { borderColor: colors.border2, backgroundColor: colors.bg3 }]}>
                <Text style={{ color: colors.text2, fontSize: 10, fontFamily: font.mono }}>{c}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      ) : null}
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
          {posts.map((p) => (
            <View key={p.id} style={[styles.card, { borderColor: colors.border2, backgroundColor: colors.card }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 11 }}>
                  {p.is_anonymous ? 'anonymous' : `@${usernames[p.user_id] ?? 'user'}`}
                </Text>
                {(isAdmin || user?.id === p.user_id) ? (
                  <Pressable onPress={() => void removeAdventure(p.id)}>
                    <Text style={{ color: '#f66', fontFamily: font.dmBold, fontSize: 11 }}>remove</Text>
                  </Pressable>
                ) : null}
              </View>
              {p.image_path || p.video_path ? (
                <PostMediaTile
                  post={{
                    ...p,
                    challenge_id: 'sidequest',
                    caption: p.body,
                    text_style: null,
                  }}
                  style={styles.media}
                />
              ) : null}
              {p.body ? <Text style={{ color: colors.text1, fontFamily: font.dm, marginTop: 8 }}>{p.body}</Text> : null}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { paddingHorizontal: 18, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 16 },
  hero: { marginHorizontal: 18, marginTop: 14, borderWidth: 1, borderRadius: 14, padding: 12 },
  heroBadge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8 },
  heroTitle: { fontSize: 40, lineHeight: 46 },
  metricsRow: { marginTop: 10, flexDirection: 'row', gap: 20 },
  metricItem: { alignItems: 'flex-start' },
  metricValue: { fontSize: 26, lineHeight: 28 },
  metricLabel: { fontSize: 10, letterSpacing: 0.9, textTransform: 'uppercase', marginTop: 2 },
  questBtn: { marginTop: 14, backgroundColor: '#ffd84c', borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  catRow: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cat: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  card: { marginHorizontal: 18, marginTop: 12, borderWidth: 1, borderRadius: 12, padding: 10 },
  media: { width: '100%', aspectRatio: 3 / 4, borderRadius: 10, marginTop: 8 },
});
