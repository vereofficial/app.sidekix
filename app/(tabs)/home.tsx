import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Wordmark } from '../../src/components/Wordmark';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/AppThemeContext';
import { usePersonalScratchpad } from '../../src/hooks/usePersonalScratchpad';
import type { ScratchLine } from '../../src/hooks/usePersonalScratchpad';
import { useSavedSidequests } from '../../src/hooks/useSavedSidequests';
import { tryGetSupabase } from '../../src/lib/supabase';
import { font, getColors } from '../../src/theme';

const TABLET_CONTENT_MAX = 640;

type MergedSaved = {
  key: string;
  kind: 'sidequest' | 'challenge';
  sourceId: string;
  creatorId: string | null;
  title: string;
  path: string;
  saved_at: string;
};

type OnDeck =
  | { kind: 'saved'; row: MergedSaved }
  | { kind: 'scratch'; line: ScratchLine }
  | { kind: 'empty' };

type RowMeta = { authorLabel: string; done: number };

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ section?: string }>();
  const { resolvedScheme } = useAppTheme();
  const scheme = resolvedScheme;
  const colors = getColors(resolvedScheme);
  const { user } = useAuth();
  const {
    saved,
    savedChallenges,
    loading: savedLoading,
    refresh: refreshSaved,
    toggleSaved,
    toggleSavedChallenge,
  } = useSavedSidequests(user?.id);
  const {
    hydrated: scratchHydrated,
    wantToTry,
    rememberDone,
    addWantToTry,
    removeWantToTry,
    addRememberDone,
    removeRememberDone,
  } = usePersonalScratchpad();

  const [refreshing, setRefreshing] = useState(false);
  const [wishDraft, setWishDraft] = useState('');
  const [memDraft, setMemDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const savedSectionY = useRef(0);
  const [rowMeta, setRowMeta] = useState<Record<string, RowMeta>>({});

  const savedList = useMemo((): MergedSaved[] => {
    const sq: MergedSaved[] = saved.map((s) => ({
      kind: 'sidequest',
      key: `sq-${s.sidequest.id}`,
      sourceId: s.sidequest.id,
      creatorId: s.sidequest.creator_id,
      title: s.sidequest.title,
      path: `/sidequest/${s.sidequest.id}`,
      saved_at: s.saved_at,
    }));
    const ch: MergedSaved[] = savedChallenges.map((s) => ({
      kind: 'challenge',
      key: `ch-${s.challenge.id}`,
      sourceId: s.challenge.id,
      creatorId: null,
      title: s.challenge.title,
      path: `/challenge/${s.challenge.id}`,
      saved_at: s.saved_at,
    }));
    return [...sq, ...ch].sort((a, b) => b.saved_at.localeCompare(a.saved_at));
  }, [saved, savedChallenges]);

  useEffect(() => {
    if (!user?.id || savedList.length === 0) {
      setRowMeta({});
      return;
    }
      const sb = tryGetSupabase();
    if (!sb) {
      setRowMeta({});
        return;
      }

    const load = async () => {
      const creatorIds = [
        ...new Set(savedList.map((r) => r.creatorId).filter((id): id is string => Boolean(id))),
      ];
      const sqIds = savedList.filter((r) => r.kind === 'sidequest').map((r) => r.sourceId);
      const chIds = savedList.filter((r) => r.kind === 'challenge').map((r) => r.sourceId);

      const [profilesRes, sqPostsRes, chPostsRes] = await Promise.all([
        creatorIds.length
          ? sb.from('profiles').select('id, username').in('id', creatorIds)
          : Promise.resolve({ data: [] as { id: string; username: string }[], error: null }),
        sqIds.length
          ? sb.from('sidequest_posts').select('sidequest_id').in('sidequest_id', sqIds)
          : Promise.resolve({ data: [] as { sidequest_id: string }[], error: null }),
        chIds.length ? sb.from('posts').select('challenge_id').in('challenge_id', chIds) : Promise.resolve({ data: [] as { challenge_id: string }[], error: null }),
      ]);

      const userById = new Map((profilesRes.data ?? []).map((p: { id: string; username: string }) => [p.id, p.username]));
      const sqCount = new Map<string, number>();
      (sqPostsRes.data ?? []).forEach((r: { sidequest_id: string }) => {
        sqCount.set(r.sidequest_id, (sqCount.get(r.sidequest_id) ?? 0) + 1);
      });
      const chCount = new Map<string, number>();
      (chPostsRes.data ?? []).forEach((r: { challenge_id: string }) => {
        chCount.set(r.challenge_id, (chCount.get(r.challenge_id) ?? 0) + 1);
      });

      const next: Record<string, RowMeta> = {};
      for (const row of savedList) {
        let authorLabel = 'sidekix';
        if (row.kind === 'sidequest' && row.creatorId) {
          const u = userById.get(row.creatorId);
          authorLabel = u ? `@${u}` : '@…';
        }
        const done =
          row.kind === 'sidequest' ? (sqCount.get(row.sourceId) ?? 0) : (chCount.get(row.sourceId) ?? 0);
        next[row.key] = { authorLabel, done };
      }
      setRowMeta(next);
    };

    void load();
  }, [savedList, user?.id]);

  const onDeck = useMemo((): OnDeck => {
    if (savedList.length > 0) return { kind: 'saved', row: savedList[0] };
    if (!savedLoading && wantToTry.length > 0) return { kind: 'scratch', line: wantToTry[0] };
    return { kind: 'empty' };
  }, [savedList, wantToTry, savedLoading]);

  const alsoSaved = savedList.length > 1 ? savedList.slice(1, 24) : [];

  const onPull = async () => {
    setRefreshing(true);
    await refreshSaved();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      void refreshSaved();
    }, [refreshSaved]),
  );

  useEffect(() => {
    if (params.section !== 'saved') return;
    const t = setTimeout(() => {
      const y = savedSectionY.current;
      if (y > 0) scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
    }, 450);
    return () => clearTimeout(t);
  }, [params.section, savedList.length]);

  const goAdventure = useCallback(
    (row: MergedSaved) => {
      router.push({
        pathname: '/new-adventure',
        params: row.kind === 'sidequest' ? { sidequestId: row.sourceId } : { challengeId: row.sourceId },
      });
    },
    [router],
  );

  const unsaveAlsoRow = useCallback(
    (row: MergedSaved) => {
      if (row.kind === 'sidequest') void toggleSaved(row.sourceId);
      else void toggleSavedChallenge(row.sourceId);
    },
    [toggleSaved, toggleSavedChallenge],
  );

  const deck = useMemo(() => {
    if (scheme === 'dark') {
      return {
        bg: '#1a2518',
        eyebrow: '#c8e8b0',
        title: '#f4faf0',
        muted: '#9ebe8c',
        btnBg: '#0f170d',
        btnText: '#f4faf0',
        border: 'rgba(212,255,63,0.2)',
      };
    }
    return {
      bg: '#355a33',
      eyebrow: '#cfe9c4',
      title: '#f7fcf4',
      muted: '#b8d9ae',
      btnBg: '#1e331c',
      btnText: '#ffffff',
      border: 'rgba(255,255,255,0.12)',
    };
  }, [scheme]);

  const scratchBorder = scheme === 'dark' ? 'rgba(212,255,63,0.14)' : 'rgba(90,122,0,0.16)';

  const renderOnDeck = () => {
    if (!user?.id) {
      return (
        <View style={[styles.deckCard, { backgroundColor: deck.bg, borderColor: deck.border }]}>
          <Text style={[styles.deckEyebrow, { color: deck.eyebrow, fontFamily: font.mono }]}>HOME</Text>
          <Text style={[styles.deckTitle, { color: deck.title, fontFamily: font.serifItalic }]}>
            save ideas & run them solo — sign in to sync.
        </Text>
          <Pressable onPress={() => router.push('/auth')} style={[styles.deckCta, { backgroundColor: deck.btnBg }]}>
            <Text style={{ color: deck.btnText, fontFamily: font.dmBold, fontSize: 14 }}>sign in →</Text>
        </Pressable>
      </View>
      );
    }

    if (savedLoading) {
      return (
        <View style={[styles.deckCard, styles.deckLoading, { borderColor: deck.border, backgroundColor: deck.bg }]}>
          <ActivityIndicator color={scheme === 'dark' ? '#D4FF3F' : '#e8f5e0'} />
      </View>
      );
    }

    if (onDeck.kind === 'saved') {
      const { row } = onDeck;
      const meta = rowMeta[row.key];
      const openAdventure = () => goAdventure(row);
      const doneSuffix =
        meta != null && meta.done > 1 ? ` · ${meta.done.toLocaleString()} done` : '';
  return (
        <View style={[styles.deckCard, { backgroundColor: deck.bg, borderColor: deck.border }]}>
          <Text style={[styles.deckEyebrow, { color: deck.eyebrow, fontFamily: font.mono }]}>ON DECK</Text>
          <Text style={[styles.deckTitle, { color: deck.title, fontFamily: font.serifItalic }]} numberOfLines={5}>
            {row.title.toLowerCase()}
          </Text>
          <View style={styles.deckFooter}>
            <Text style={[styles.deckMeta, { color: deck.muted, fontFamily: font.dm }]} numberOfLines={2}>
              idea by {meta?.authorLabel ?? '@…'}
              {doneSuffix}
                </Text>
            <Pressable onPress={openAdventure} style={[styles.deckCtaSmall, { backgroundColor: deck.btnBg }]}>
              <Text style={{ color: deck.btnText, fontFamily: font.dmBold, fontSize: 13 }}>do this →</Text>
              </Pressable>
            </View>
          </View>
      );
    }

    if (onDeck.kind === 'scratch') {
                    return (
        <View style={[styles.deckCard, { backgroundColor: deck.bg, borderColor: deck.border }]}>
          <Text style={[styles.deckEyebrow, { color: deck.eyebrow, fontFamily: font.mono }]}>ON DECK</Text>
          <Text style={[styles.deckTitle, { color: deck.title, fontFamily: font.serifItalic }]} numberOfLines={5}>
            “{onDeck.line.text.toLowerCase()}”
                      </Text>
          <Pressable onPress={() => router.push('/(tabs)/feed')} style={[styles.deckCta, { backgroundColor: deck.btnBg }]}>
            <Text style={{ color: deck.btnText, fontFamily: font.dmBold, fontSize: 14 }}>find an idea on the feed →</Text>
                        </Pressable>
                      </View>
      );
    }

    return (
      <View style={[styles.deckCard, { backgroundColor: deck.bg, borderColor: deck.border }]}>
        <Text style={[styles.deckEyebrow, { color: deck.eyebrow, fontFamily: font.mono }]}>ON DECK</Text>
        <Text style={[styles.deckTitle, { color: deck.title, fontFamily: font.serifItalic }]}>
          nothing saved yet — browse the feed and tap + save on any idea to put it here
                      </Text>
        <Pressable onPress={() => router.push('/(tabs)/feed')} style={[styles.deckCta, { backgroundColor: deck.btnBg }]}>
          <Text style={{ color: deck.btnText, fontFamily: font.dmBold, fontSize: 14 }}>browse feed →</Text>
                  </Pressable>
              </View>
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={{
            paddingBottom: Math.max(48, insets.bottom) + 120,
            alignItems: 'center',
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onPull()} tintColor={colors.accent} />}
        >
          <View style={{ width: '100%', maxWidth: TABLET_CONTENT_MAX, paddingHorizontal: 18, paddingTop: 10 }}>
            <View style={styles.headerRow}>
              <Wordmark colors={colors} size={21} />
            </View>

            <View
              onLayout={(e) => {
                if (user?.id && savedList.length > 0) {
                  savedSectionY.current = e.nativeEvent.layout.y;
                }
              }}
            >
              {renderOnDeck()}
            </View>

            {user?.id && !savedLoading ? (
              <View
                onLayout={(e) => {
                  if (savedList.length > 1) savedSectionY.current = e.nativeEvent.layout.y;
                }}
              >
                <Text style={[styles.alsoHeader, { color: colors.text3, fontFamily: font.dmBold }]}>ALSO SAVED</Text>
                {alsoSaved.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.alsoStrip}
                  >
                    {alsoSaved.map((row) => (
                      <View
                        key={row.key}
                        style={[styles.alsoTile, { borderColor: colors.border2, backgroundColor: colors.card }]}
                      >
                        <Pressable onPress={() => goAdventure(row)} style={styles.alsoTileMain}>
                          <Text
                            numberOfLines={3}
                            style={{ color: colors.text2, fontFamily: font.dmBold, fontSize: 14, lineHeight: 20 }}
                          >
                            {row.title}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Remove from saved"
                          onPress={() => void unsaveAlsoRow(row)}
                          hitSlop={12}
                          style={styles.alsoUnsave}
                        >
                          <Ionicons name="close" size={22} color={colors.text3} />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={[styles.alsoEmpty, { borderColor: colors.border2, backgroundColor: colors.card }]}>
                    <Text style={{ color: colors.text2, fontFamily: font.dm, fontSize: 14, lineHeight: 20 }}>
                      On the Feed, tap + save on any idea card and it'll show up here.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {!scratchHydrated ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
            ) : (
              <View style={[styles.scratchShell, { borderColor: scratchBorder, backgroundColor: colors.card }]}>
                <Text style={[styles.scratchHeadGreen, { color: colors.accent, fontFamily: font.dmBold }]}>
                  ● WANT TO TRY
                </Text>
                {wantToTry.length > 0 ? (
                  <View style={{ marginBottom: 8 }}>
                    {wantToTry.map((line) => (
                      <View key={line.id} style={styles.scratchRow}>
                        <Text style={{ color: colors.text1, fontFamily: font.dm, flex: 1, lineHeight: 22, fontSize: 15 }}>
                          {line.text}
                        </Text>
                        <Pressable onPress={() => void removeWantToTry(line.id)} hitSlop={8} style={styles.scratchDel}>
                          <Text style={{ color: colors.text3, fontSize: 14 }}>✕</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={[styles.scratchAdd, { borderTopColor: colors.border2 }]}>
                  <TextInput
                    value={wishDraft}
                    onChangeText={setWishDraft}
                    placeholder="jot down a sidequest idea…"
                    placeholderTextColor={colors.text3}
                    onSubmitEditing={() => {
                      void addWantToTry(wishDraft);
                      setWishDraft('');
                    }}
                    style={[styles.scratchInput, { color: colors.text1, fontFamily: font.dm }]}
                  />
                  <Pressable
                    onPress={() => {
                      void addWantToTry(wishDraft);
                      setWishDraft('');
                    }}
                    style={[styles.scratchPlus, { backgroundColor: colors.bg3, borderColor: colors.border2 }]}
                  >
                    <Ionicons name="add" size={22} color={colors.text2} />
                  </Pressable>
                </View>

                <View style={[styles.scratchDivider, { backgroundColor: colors.border2 }]} />

                <Text style={[styles.scratchHeadBlue, { color: colors.lightAccent, fontFamily: font.dmBold }]}>
                  ● DONE & REMEMBERED
                </Text>
                {rememberDone.length > 0 ? (
                  <View style={{ marginBottom: 8 }}>
                    {rememberDone.map((line) => (
                      <View key={line.id} style={styles.scratchRow}>
                        <Text style={{ color: colors.text1, fontFamily: font.dm, flex: 1, lineHeight: 22, fontSize: 15 }}>
                          {line.text}
                        </Text>
                        <Pressable onPress={() => void removeRememberDone(line.id)} hitSlop={8} style={styles.scratchDel}>
                          <Text style={{ color: colors.text3, fontSize: 14 }}>✕</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={[styles.scratchAdd, { borderTopWidth: 0 }]}>
                  <TextInput
                    value={memDraft}
                    onChangeText={setMemDraft}
                    placeholder="something you just did…"
                    placeholderTextColor={colors.text3}
                    onSubmitEditing={() => {
                      void addRememberDone(memDraft);
                      setMemDraft('');
                    }}
                    style={[styles.scratchInput, { color: colors.text1, fontFamily: font.dm }]}
                  />
                  <Pressable
                    onPress={() => {
                      void addRememberDone(memDraft);
                      setMemDraft('');
                    }}
                    style={[styles.scratchPlus, { backgroundColor: colors.bg3, borderColor: colors.border2 }]}
                  >
                    <Ionicons name="add" size={22} color={colors.text2} />
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 18,
  },
  deckCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    minHeight: 168,
  },
  deckLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  deckEyebrow: {
    fontSize: 10,
    letterSpacing: 2.2,
    fontWeight: '700',
    marginBottom: 10,
  },
  deckTitle: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
    marginBottom: 14,
  },
  deckFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
  },
  deckMeta: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  deckCta: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 4,
  },
  deckCtaSmall: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexShrink: 0,
  },
  alsoHeader: {
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 4,
  },
  alsoStrip: {
    gap: 10,
    paddingVertical: 4,
    paddingRight: 8,
    marginBottom: 16,
  },
  alsoTile: {
    width: 158,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  alsoTileMain: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    justifyContent: 'flex-start',
  },
  alsoUnsave: {
    padding: 2,
    marginTop: -4,
    marginRight: -4,
  },
  alsoEmpty: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  scratchShell: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    marginTop: 4,
  },
  scratchHeadGreen: {
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  scratchHeadBlue: {
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 12,
    marginTop: 4,
  },
  scratchDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
  },
  scratchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
  },
  scratchDel: {
    width: 28,
    alignItems: 'center',
    paddingTop: 2,
  },
  scratchAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    gap: 10,
  },
  scratchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
    minHeight: 44,
  },
  scratchPlus: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
