import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PostMediaTile } from '../../src/components/PostMediaTile';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/AppThemeContext';
import { useMyPosts } from '../../src/hooks/useMyPosts';
import { localCalendarYmd } from '../../src/lib/calendarDate';
import { font, getColors } from '../../src/theme';

const TABLET_CONTENT_MAX = 640;
const SUBMISSIONS_GRID_GAP = 8;

export default function JournalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: winH, width: winW } = useWindowDimensions();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const { user } = useAuth();
  const { posts, loading, refresh } = useMyPosts(user?.id);

  const [refreshing, setRefreshing] = useState(false);
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [selectedYmd, setSelectedYmd] = useState(() => localCalendarYmd());

  const contentW = Math.min(winW, TABLET_CONTENT_MAX);
  const submissionTileSize =
    posts.length >= 3
      ? Math.max(100, Math.floor((contentW - 36 - SUBMISSIONS_GRID_GAP * 2) / 3))
      : 140;

  const onPull = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const monthMeta = useMemo(() => {
    const d = new Date(calendarCursor);
    d.setDate(1);
    const startDow = d.getDay();
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const ymds: string[] = [];
    for (let i = 0; i < daysInMonth; i++) {
      const cur = new Date(d);
      cur.setDate(d.getDate() + i);
      ymds.push(localCalendarYmd(cur));
    }
    return {
      label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      startDow,
      daysInMonth,
      ymds,
    };
  }, [calendarCursor]);

  const postsByYmd = useMemo(() => {
    const map = new Map<string, typeof posts>();
    posts.forEach((p) => {
      const ymd = localCalendarYmd(new Date(p.created_at));
      const cur = map.get(ymd) ?? [];
      cur.push(p);
      map.set(ymd, cur);
    });
    return map;
  }, [posts]);

  const selectedDayPosts = useMemo(() => postsByYmd.get(selectedYmd) ?? [], [postsByYmd, selectedYmd]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24, alignItems: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onPull()} tintColor={colors.accent} />}
      >
        <View style={{ width: '100%', maxWidth: TABLET_CONTENT_MAX, paddingHorizontal: 18 }}>
          <Text style={[styles.heroTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>journal</Text>
          <Text style={[styles.heroSub, { color: colors.text2, fontFamily: font.dm }]}>
            your calendar and submissions in one place.
          </Text>
        </View>

        <View style={[styles.calendarWrap, { borderColor: colors.border2, backgroundColor: colors.card }]}>
          <View style={styles.calendarHead}>
            <Pressable
              onPress={() => {
                const d = new Date(calendarCursor);
                d.setMonth(d.getMonth() - 1);
                setCalendarCursor(d);
              }}
            >
              <Text style={{ color: colors.text2, fontFamily: font.syne }}>←</Text>
            </Pressable>
            <Text style={{ color: colors.text1, fontFamily: font.syneExtra }}>{monthMeta.label}</Text>
            <Pressable
              onPress={() => {
                const d = new Date(calendarCursor);
                d.setMonth(d.getMonth() + 1);
                setCalendarCursor(d);
              }}
            >
              <Text style={{ color: colors.text2, fontFamily: font.syne }}>→</Text>
            </Pressable>
          </View>
          <View style={styles.calendarGrid}>
            {Array.from({ length: monthMeta.startDow }).map((_, i) => (
              <View key={`blank-${i}`} style={styles.calendarCell} />
            ))}
            {monthMeta.ymds.map((ymd, idx) => {
              const dayPosts = postsByYmd.get(ymd) ?? [];
              const hasPosts = dayPosts.length > 0;
              const previewPost = dayPosts[0] ?? null;
              const isSelected = selectedYmd === ymd;
              return (
                <Pressable
                  key={ymd}
                  onPress={() => setSelectedYmd(ymd)}
                  style={[
                    styles.calendarCellWrap,
                    { borderColor: colors.border2 },
                    isSelected && { borderColor: colors.accent, borderWidth: 1.5 },
                  ]}
                >
                  <View style={[styles.calendarCell, hasPosts ? styles.calendarCellFilled : { backgroundColor: 'transparent' }]}>
                    {previewPost ? (
                      <PostMediaTile post={previewPost} style={StyleSheet.absoluteFillObject} borderRadius={0} />
                    ) : null}
                    <View style={styles.calendarDayWrap}>
                      <Text style={{ color: hasPosts ? '#fff' : colors.text1, fontFamily: font.dmBold, fontSize: 12 }}>{idx + 1}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.calendarSelected, { borderTopColor: colors.border2 }]}>
            <Text
              style={{
                color: colors.text2,
                fontFamily: font.syne,
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 0.7,
              }}
            >
              {selectedYmd}
            </Text>
            <Text style={{ color: colors.text1, fontFamily: font.dm, marginTop: 4 }}>
              {selectedDayPosts.length === 0
                ? 'no sidequests completed'
                : `${selectedDayPosts.length} ${selectedDayPosts.length === 1 ? 'sidequest' : 'sidequests'} completed`}
            </Text>
          </View>
        </View>

        <View style={styles.sh}>
          <Text style={[styles.sectionTitle, { color: colors.text3, fontFamily: font.syne }]}>your submissions</Text>
        </View>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} />
        ) : posts.length === 0 ? (
          <View style={[styles.submissionsEmptyFlex, { minHeight: Math.max(220, winH - insets.top - 420) }]}>
            <View style={styles.submissionsEmptyInner}>
              <Text style={[styles.submissionsEmptyTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>
                nothing here yet
              </Text>
              <Text style={[styles.submissionsEmptySub, { color: colors.text2, fontFamily: font.dm }]}>
                capture your first adventure from the Post tab — or peek at campus on Home.
              </Text>
              <Pressable onPress={() => router.push('/(tabs)/home')}>
                <Text style={[styles.submissionsEmptyCta, { color: colors.accent, fontFamily: font.syne }]}>
                  go to home →
                </Text>
              </Pressable>
            </View>
          </View>
        ) : posts.length < 3 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.submissionsRow}
          >
            {posts.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/submission/${p.id}`)}
                style={[styles.cellLarge, { borderColor: colors.border2 }]}
              >
                <PostMediaTile post={p} style={styles.submissionThumbFill} borderRadius={12} />
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View
            style={[
              styles.grid,
              {
                paddingHorizontal: 18,
                columnGap: SUBMISSIONS_GRID_GAP,
                rowGap: SUBMISSIONS_GRID_GAP,
                justifyContent: 'flex-start',
              },
            ]}
          >
            {posts.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/submission/${p.id}`)}
                style={[
                  styles.submissionCell,
                  {
                    width: submissionTileSize,
                    height: submissionTileSize,
                    borderColor: colors.border2,
                  },
                ]}
              >
                <PostMediaTile post={p} style={styles.submissionThumbFill} borderRadius={6} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  heroTitle: { fontSize: 28, letterSpacing: -0.4 },
  heroSub: { fontSize: 14, marginTop: 10, marginBottom: 22, lineHeight: 21 },
  sh: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8 },
  sectionTitle: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  calendarWrap: {
    marginHorizontal: 18,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  calendarHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCellWrap: { width: '14.2857%', aspectRatio: 1, padding: 2, borderWidth: 1 },
  calendarCell: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  calendarCellFilled: {
    backgroundColor: '#121212',
  },
  calendarDayWrap: { position: 'absolute', top: 2, left: 4, backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 4, paddingVertical: 1 },
  calendarSelected: { marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  submissionsRow: { paddingHorizontal: 18, gap: 10, paddingBottom: 4 },
  cellLarge: { width: 140, height: 140, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  submissionThumbFill: { width: '100%', height: '100%' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  submissionCell: { borderRadius: 6, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  submissionsEmptyFlex: { justifyContent: 'center', paddingHorizontal: 22 },
  submissionsEmptyInner: { alignItems: 'center', paddingVertical: 12, marginTop: -24 },
  submissionsEmptyTitle: { fontSize: 17, marginBottom: 8, letterSpacing: -0.2, textAlign: 'center' },
  submissionsEmptySub: { fontSize: 13, lineHeight: 20, marginBottom: 14, textAlign: 'center' },
  submissionsEmptyCta: { fontSize: 13, letterSpacing: 0.4, fontWeight: '700', textAlign: 'center' },
});
