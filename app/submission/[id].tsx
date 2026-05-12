import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { challengeTag, splitChallengeTitle } from '../../src/challenge';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/AppThemeContext';
import { PostMediaTile } from '../../src/components/PostMediaTile';
import { MARKETING_SITE_URL, postShareUrl } from '../../src/constants/shareLinks';
import { isR2ObjectPath } from '../../src/lib/r2MediaConfig';
import { tryGetSupabase } from '../../src/lib/supabase';
import { font, getColors } from '../../src/theme';
import type { ChallengeRow, PostRow, SidequestPostRow } from '../../src/types/database';

type LoadedPost = PostRow & { _source?: 'legacy' | 'sidequest' };

export default function SubmissionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const { user } = useAuth();
  const [post, setPost] = useState<LoadedPost | null>(null);
  const [challenge, setChallenge] = useState<ChallengeRow | null>(null);
  const [sidequestTitle, setSidequestTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id || !user?.id) {
        setLoading(false);
        setErr('Not found');
        return;
      }
      const sb = tryGetSupabase();
      if (!sb) {
        setErr('Offline');
        setLoading(false);
        return;
      }
      const { data: legacy, error: legErr } = await sb.from('posts').select('*').eq('id', id).eq('user_id', user.id).maybeSingle();
      if (!legErr && legacy) {
        const row = legacy as PostRow;
        setPost({ ...row, _source: 'legacy' });
        setSidequestTitle(null);
        setErr(null);
        const { data: ch } = await sb.from('challenges').select('*').eq('id', row.challenge_id).maybeSingle();
        setChallenge((ch ?? null) as ChallengeRow | null);
        setLoading(false);
        return;
      }

      const { data: sq, error: sqErr } = await sb
        .from('sidequest_posts')
        .select('*, sidequests(title)')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!sqErr && sq) {
        const r = sq as SidequestPostRow & { sidequests?: { title: string } | null };
        const title = r.sidequests?.title ?? 'Sidequest';
        setSidequestTitle(title);
        setChallenge(null);
        setPost({
          id: r.id,
          challenge_id: r.sidequest_id,
          user_id: r.user_id,
          image_path: r.image_path,
          video_path: r.video_path,
          body: r.body,
          is_anonymous: r.is_anonymous,
          created_at: r.created_at,
          caption: title,
          _source: 'sidequest',
        });
        setErr(null);
        setLoading(false);
        return;
      }

      setErr('Not found');
      setPost(null);
      setChallenge(null);
      setSidequestTitle(null);
      setLoading(false);
    };
    void load();
  }, [id, user?.id]);

  const deletePost = async () => {
    if (!post?.id || !user?.id) return;
    const sb = tryGetSupabase();
    if (!sb) {
      Alert.alert('Offline', 'Try again when you’re connected.');
      return;
    }
    const isSq = post._source === 'sidequest';
    Alert.alert(
      'Delete this post?',
      isSq
        ? 'This removes your adventure from this sidequest.'
        : 'This removes your take and its reactions. You can post again for this sidequest if the window is still open.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeleting(true);
              try {
                const paths = [post.image_path, post.video_path].filter((p): p is string => Boolean(p?.trim()));
                const supabaseOnly = paths.filter((p) => !isR2ObjectPath(p));
                if (supabaseOnly.length > 0) {
                  const { error: stErr } = await sb.storage.from('post-media').remove(supabaseOnly);
                  if (stErr) throw stErr;
                }
                if (isSq) {
                  const { error: delErr } = await sb.from('sidequest_posts').delete().eq('id', post.id).eq('user_id', user.id);
                  if (delErr) throw delErr;
                } else {
                  const { error: delErr } = await sb.from('posts').delete().eq('id', post.id).eq('user_id', user.id);
                  if (delErr) throw delErr;
                }
                router.back();
              } catch (e) {
                Alert.alert('Could not delete', e instanceof Error ? e.message : 'Something went wrong.');
              } finally {
                setDeleting(false);
              }
            })();
          },
        },
      ],
    );
  };

  const cap = (post?.body ?? post?.caption ?? '').trim();
  const showCaptionBelowCard =
    !!post &&
    cap.length > 0 &&
    (!!post.image_path?.trim() || !!post.video_path?.trim());

  const challengeTitleParts = challenge
    ? splitChallengeTitle(challenge)
    : { before: '', after: '' };

  const destructive = resolvedScheme === 'dark' ? '#FF6B6B' : '#C62828';
  const isSidequestPost = post?._source === 'sidequest';

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontSize: 18, color: colors.text1 }}>←</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text1, fontFamily: font.syneExtra }]}>your take</Text>
        {!loading && post ? (
          <Pressable onPress={deletePost} disabled={deleting} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.headDelete, { color: destructive, fontFamily: font.syne }]}>
              {deleting ? 'deleting…' : 'delete'}
            </Text>
          </Pressable>
        ) : (
          <View style={{ width: 56 }} />
        )}
      </View>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
      ) : err || !post ? (
        <Text style={[styles.err, { color: colors.text3, fontFamily: font.dm }]}>{err ?? 'Not found'}</Text>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.hero, { borderColor: colors.border2 }]}>
            <PostMediaTile post={post} style={styles.heroMedia} borderRadius={16} autoPlayVideo />
          </View>
          {showCaptionBelowCard ? (
            <Text style={[styles.caption, { color: colors.text1, fontFamily: font.dm }]}>{cap}</Text>
          ) : null}
          <View style={styles.shareBlock}>
            {challenge ? (
              <View style={styles.sidequestHeader}>
                <Text style={[styles.challengeTag, { color: colors.text3, fontFamily: font.syne }]}>
                  {challengeTag(challenge)}
                </Text>
                <Text style={[styles.challengeTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>
                  {challengeTitleParts.before}
                  <Text style={{ color: colors.accent }}>{challenge.emphasis}</Text>
                  {challengeTitleParts.after}
                </Text>
              </View>
            ) : isSidequestPost && sidequestTitle ? (
              <View style={styles.sidequestHeader}>
                <Text style={[styles.challengeTag, { color: colors.text3, fontFamily: font.syne }]}>SIDEQUEST</Text>
                <Text style={[styles.challengeTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>
                  {sidequestTitle}
                </Text>
              </View>
            ) : null}
            {isSidequestPost ? (
              <Text selectable style={[styles.shareUrl, { color: colors.text2, fontFamily: font.dm }]}>
                {MARKETING_SITE_URL}
              </Text>
            ) : (
              <Text selectable style={[styles.shareUrl, { color: colors.text2, fontFamily: font.dm }]}>
                {postShareUrl(post.id)}
              </Text>
            )}
            <View style={styles.shareRow}>
              {isSidequestPost ? (
                <Pressable
                  onPress={() => router.push(`/sidequest/${post.challenge_id}`)}
                  style={({ pressed }) => [
                    styles.shareBtn,
                    { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 },
                  ]}
                >
                  <Text
                    style={[
                      styles.shareBtnText,
                      { color: resolvedScheme === 'light' ? '#fff' : '#0a0a0a', fontFamily: font.syne },
                    ]}
                  >
                    open sidequest
                  </Text>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    onPress={() => void sharePostLink(post.id)}
                    style={({ pressed }) => [
                      styles.shareBtn,
                      { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.shareBtnText,
                        { color: resolvedScheme === 'light' ? '#fff' : '#0a0a0a', fontFamily: font.syne },
                      ]}
                    >
                      share…
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void copyPostLink(post.id)}
                    style={({ pressed }) => [
                      styles.shareBtnOutline,
                      {
                        borderColor: colors.border2,
                        backgroundColor: colors.card,
                        opacity: pressed ? 0.88 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.shareBtnText, { color: colors.text1, fontFamily: font.syne }]}>copy</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      )}
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
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontSize: 16, fontWeight: '800', flex: 1, textAlign: 'center' },
  headDelete: { fontSize: 14, fontWeight: '700' },
  err: { paddingHorizontal: 22, marginTop: 24, fontSize: 14 },
  hero: {
    marginHorizontal: 18,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    width: undefined,
  },
  heroMedia: { width: '100%', aspectRatio: 3 / 4 },
  caption: { paddingHorizontal: 22, marginTop: 16, fontSize: 15, lineHeight: 22 },
  shareBlock: { paddingHorizontal: 22, marginTop: 18, gap: 10 },
  sidequestHeader: { marginBottom: 2, gap: 6 },
  challengeTag: { fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' },
  challengeTitle: { fontSize: 18, lineHeight: 24, letterSpacing: -0.35 },
  shareUrl: { fontSize: 13, lineHeight: 18 },
  shareRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  shareBtn: {
    flex: 1,
    borderRadius: 50,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  shareBtnOutline: {
    flex: 1,
    borderRadius: 50,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 48,
  },
  shareBtnText: { fontSize: 14, fontWeight: '800' },
});
