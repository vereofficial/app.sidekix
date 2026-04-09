import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { splitChallengeTitle } from '../src/challenge';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PostMediaTile } from '../src/components/PostMediaTile';
import { useAppTheme } from '../src/context/AppThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { useLeaderboard } from '../src/hooks/useLeaderboard';
import { useTodayChallenge } from '../src/hooks/useTodayChallenge';
import { upvotesLabel } from '../src/lib/formatCount';
import { hapticLight } from '../src/lib/haptics';
import { font, getColors } from '../src/theme';

type CardFormat = 'square' | 'vertical' | 'transparent';

export default function ShareCardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const scheme = resolvedScheme;
  const { user } = useAuth();
  const { challenge } = useTodayChallenge();
  const { rows } = useLeaderboard('week');
  const myIdx = rows.findIndex((r) => r.user_id === user?.id);
  const you = myIdx >= 0 ? rows[myIdx] : null;
  const rank = myIdx >= 0 ? myIdx + 1 : null;
  const inTop10 = myIdx >= 0 && myIdx < 10;

  const [format, setFormat] = useState<CardFormat>('vertical');
  const [sharing, setSharing] = useState(false);
  const shotRef = useRef<View>(null);

  const previewW = Math.min(winW - 36, 340);
  const aspect = format === 'square' ? 1 : 9 / 16;
  const previewH = previewW / aspect;

  const challengeLine = useMemo(() => {
    if (!challenge) return 'This week on sidequest';
    const { before, after } = splitChallengeTitle(challenge);
    const t = `${before}${challenge.emphasis}${after}`.replace(/\s+/g, ' ').trim();
    return t.length > 120 ? `${t.slice(0, 117)}…` : t;
  }, [challenge]);

  const onShare = useCallback(async () => {
    if (!inTop10 || !you || rank == null) {
      Alert.alert('Share card', 'Only the top 10 this week can export a rank card.');
      return;
    }
    const node = shotRef.current;
    if (!node) return;
    setSharing(true);
    try {
      hapticLight();
      const outW = 1080;
      const outH = format === 'square' ? 1080 : Math.round((outW * 16) / 9);
      const uri = await captureRef(node, {
        format: 'png',
        quality: 1,
        width: outW,
        height: outH,
      });
      const can = await Sharing.isAvailableAsync();
      if (!can) {
        Alert.alert('Sharing', 'Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share your rank',
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not create image';
      Alert.alert('Share', msg);
    } finally {
      setSharing(false);
    }
  }, [format, inTop10, rank, you]);

  const cardBg =
    format === 'transparent' ? 'transparent' : scheme === 'dark' ? '#0a0a0a' : '#0f0f0f';
  /** Clear BG still uses a light bottom fade so type stays readable when layered in Stories. */
  const fadeColors: [string, string] =
    format === 'transparent'
      ? ['transparent', 'rgba(0,0,0,0.72)']
      : ['transparent', 'rgba(0,0,0,0.82)'];

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ fontSize: 18, color: colors.text1 }}>←</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text1, fontFamily: font.syneExtra }]}>share card</Text>
        </View>

        <Text style={[styles.note, { color: colors.text2, fontFamily: font.dm }]}>
          Top 10 can share their rank card. Only #1 wins the prize.
        </Text>
        <Text style={[styles.hint, { color: colors.text3, fontFamily: font.dm }]}>
          Pick a format, then share — Instagram, Messages, TikTok, anywhere. Rich link previews for texts need a web
          page (add later).
        </Text>

        <View style={[styles.tabs, { backgroundColor: colors.pillBg }]}>
          {(['square', 'vertical', 'transparent'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFormat(f)}
              style={[styles.tab, format === f && { backgroundColor: colors.card }]}
            >
              <Text
                style={[
                  styles.tabText,
                  { fontFamily: font.syne },
                  { color: format === f ? colors.text1 : colors.text3 },
                ]}
              >
                {f === 'square' ? 'SQUARE' : f === 'vertical' ? 'STORY' : 'CLEAR BG'}
              </Text>
            </Pressable>
          ))}
        </View>

        {you && rank ? (
          <Text style={[styles.meta, { color: colors.text2, fontFamily: font.dm }]}>
            @{you.username} · #{rank} · ▲ {upvotesLabel(you.vote_total)}
          </Text>
        ) : (
          <Text style={[styles.meta, { color: colors.text3, fontFamily: font.dm }]}>
            Post this week and climb the board to unlock sharing.
          </Text>
        )}

        <View style={styles.previewShell} collapsable={false}>
          <View
            ref={shotRef}
            collapsable={false}
            style={[
              styles.cardOuter,
              {
                width: previewW,
                height: previewH,
                backgroundColor: cardBg,
                borderRadius: format === 'square' ? 12 : 16,
              },
            ]}
          >
            {you?.top_post ? (
              <PostMediaTile
                post={you.top_post}
                style={StyleSheet.absoluteFillObject}
                borderRadius={format === 'square' ? 12 : 16}
              />
            ) : (
              <View style={[styles.ph, { backgroundColor: colors.bg3 }]} />
            )}
            <LinearGradient colors={fadeColors} style={styles.cardFade} pointerEvents="none" />
            <View style={styles.cardCopy} pointerEvents="none">
              <Text style={[styles.cardRank, { fontFamily: font.syneExtra, color: format === 'transparent' ? '#fff' : '#fff' }]}>
                {rank ? `#${rank} this week` : 'sidequest'}
              </Text>
              <Text style={[styles.cardVotes, { fontFamily: font.dm, color: '#D4FF3F' }]}>
                {you ? `▲ ${upvotesLabel(you.vote_total)}` : '—'}
              </Text>
              <Text style={[styles.cardChallenge, { fontFamily: font.dm }]}>
                {challengeLine}
              </Text>
              <Text style={[styles.cardBrand, { fontFamily: font.syne }]}>sidequest.app</Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => void onShare()}
          disabled={sharing || !inTop10}
          style={({ pressed }) => [
            styles.shareBtn,
            {
              backgroundColor: inTop10 ? colors.accent : colors.bg3,
              opacity: pressed || sharing ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.shareBtnText,
              { fontFamily: font.syne, color: inTop10 ? (scheme === 'light' ? '#fff' : '#0a0a0a') : colors.text3 },
            ]}
          >
            {inTop10 ? 'share image…' : 'top 10 only'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 16 },
  title: { fontSize: 16, fontWeight: '800' },
  note: { paddingHorizontal: 18, marginTop: 10, fontSize: 13, lineHeight: 19 },
  hint: { paddingHorizontal: 18, marginTop: 8, fontSize: 11, lineHeight: 16 },
  tabs: {
    marginHorizontal: 18,
    marginTop: 14,
    flexDirection: 'row',
    borderRadius: 14,
    padding: 3,
    gap: 4,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 11, alignItems: 'center' },
  tabText: { fontSize: 9, letterSpacing: 0.5, fontWeight: '700' },
  meta: { paddingHorizontal: 18, marginTop: 12, fontSize: 13 },
  previewShell: { alignItems: 'center', marginTop: 16, paddingHorizontal: 18 },
  cardOuter: { overflow: 'hidden', position: 'relative' },
  ph: { flex: 1 },
  cardFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '52%' },
  cardCopy: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 28 },
  cardRank: { fontSize: 22, fontWeight: '800', color: '#fff' },
  cardVotes: { fontSize: 13, marginTop: 4, fontWeight: '700' },
  cardChallenge: { fontSize: 11, lineHeight: 15, color: 'rgba(255,255,255,0.88)', marginTop: 10 },
  cardBrand: { fontSize: 9, marginTop: 10, letterSpacing: 0.8, color: 'rgba(255,255,255,0.45)', fontWeight: '700' },
  shareBtn: { marginHorizontal: 18, marginTop: 20, borderRadius: 50, paddingVertical: 15, alignItems: 'center' },
  shareBtnText: { fontSize: 15, fontWeight: '800' },
});
