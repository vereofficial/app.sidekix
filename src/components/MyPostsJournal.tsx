import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PostMediaTile } from './PostMediaTile';
import { localCalendarYmd } from '../lib/calendarDate';
import { font } from '../theme';
import type { ThemeColors } from '../theme';
import type { JournalPost } from '../hooks/useJournalPosts';

const TABLET_CONTENT_MAX = 640;
const DAY_THUMB = 56;

type Props = {
  entries: JournalPost[];
  colors: ThemeColors;
};

/** Month calendar + selected-day thumbnails (legacy challenges + sidequest adventures). */
export function MyPostsJournal({ entries, colors }: Props) {
  const router = useRouter();
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [selectedYmd, setSelectedYmd] = useState(() => localCalendarYmd());

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
    const map = new Map<string, JournalPost[]>();
    entries.forEach((e) => {
      const ymd = localCalendarYmd(new Date(e.created_at));
      const cur = map.get(ymd) ?? [];
      cur.push(e);
      map.set(ymd, cur);
    });
    return map;
  }, [entries]);

  const selectedDayPosts = useMemo(() => postsByYmd.get(selectedYmd) ?? [], [postsByYmd, selectedYmd]);

  const openEntry = (e: JournalPost) => {
    router.push(`/submission/${e.id}`);
  };

  return (
    <View style={{ width: '100%', maxWidth: TABLET_CONTENT_MAX, alignSelf: 'center', marginBottom: 4 }}>
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
                  isSelected && { borderColor: colors.accent, borderWidth: 2 },
                ]}
              >
                <View style={[styles.calendarCell, hasPosts ? styles.calendarCellFilled : { backgroundColor: 'transparent' }]}>
                  {previewPost ? (
                    <PostMediaTile
                      post={previewPost.tile}
                      style={StyleSheet.absoluteFillObject}
                      borderRadius={0}
                      loadVideo={true}
                      autoPlayVideo={false}
                      compact
                    />
                  ) : null}
                  <View style={styles.calendarDayWrap}>
                    <Text style={{ color: hasPosts ? '#fff' : colors.text1, fontFamily: font.dmBold, fontSize: 12 }}>
                      {idx + 1}
                    </Text>
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
          {selectedDayPosts.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dayThumbRow}
            >
              {selectedDayPosts.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => openEntry(e)}
                  style={[styles.dayThumb, { borderColor: colors.border2, backgroundColor: colors.bg3 }]}
                >
                  <PostMediaTile
                    post={e.tile}
                    style={styles.dayThumbInner}
                    borderRadius={6}
                    loadVideo={true}
                    autoPlayVideo={false}
                    compact
                  />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendarWrap: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
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
  calendarDayWrap: {
    position: 'absolute',
    top: 2,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  calendarSelected: { marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  dayThumbRow: { flexDirection: 'row', gap: 8, paddingTop: 10, alignItems: 'center' },
  dayThumb: {
    width: DAY_THUMB,
    height: DAY_THUMB,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dayThumbInner: { width: '100%', height: '100%' },
});
