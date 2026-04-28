import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PostMediaTile } from '../../src/components/PostMediaTile';
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
  const [sidequest, setSidequest] = useState<SidequestRow | null>(null);
  const { posts, usernames, loading } = useSidequestPosts(id);

  useEffect(() => {
    const load = async () => {
      const sb = tryGetSupabase();
      if (!sb || !id) return;
      const { data } = await sb.from('sidequests').select('*').eq('id', id).maybeSingle();
      setSidequest((data ?? null) as SidequestRow | null);
    };
    void load();
  }, [id]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: colors.text1, fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text1, fontFamily: font.syneExtra }]}>sidequest</Text>
      </View>
      {sidequest ? (
        <View style={[styles.hero, { borderColor: colors.border2, backgroundColor: colors.card }]}>
          <Text style={[styles.heroTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>{sidequest.title}</Text>
          <View style={styles.catRow}>
            {(sidequest.categories ?? []).map((c) => (
              <View key={c} style={[styles.cat, { borderColor: colors.border2, backgroundColor: colors.bg3 }]}>
                <Text style={{ color: colors.text2, fontSize: 10, fontFamily: font.syne }}>{c}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
          {posts.map((p) => (
            <View key={p.id} style={[styles.card, { borderColor: colors.border2, backgroundColor: colors.card }]}>
              <Text style={{ color: colors.text3, fontFamily: font.syne, fontSize: 11 }}>
                {p.is_anonymous ? 'anonymous' : `@${usernames[p.user_id] ?? 'user'}`}
              </Text>
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
  heroTitle: { fontSize: 20, lineHeight: 26 },
  catRow: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cat: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  card: { marginHorizontal: 18, marginTop: 12, borderWidth: 1, borderRadius: 12, padding: 10 },
  media: { width: '100%', aspectRatio: 3 / 4, borderRadius: 10, marginTop: 8 },
});
