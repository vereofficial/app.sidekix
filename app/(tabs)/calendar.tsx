import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/AppThemeContext';
import { useSavedSidequests } from '../../src/hooks/useSavedSidequests';
import { font, getColors } from '../../src/theme';

const TABLET_CONTENT_MAX = 560;

export default function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const { user } = useAuth();
  const { saved, loading, refresh } = useSavedSidequests(user?.id);
  const [refreshing, setRefreshing] = useState(false);

  const onPull = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 28, alignItems: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPull} tintColor={colors.accent} />}
      >
        <View style={{ width: '100%', maxWidth: TABLET_CONTENT_MAX }}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: colors.text1, fontFamily: font.syneExtra }]}>my quests</Text>
            <Text style={[styles.sub, { color: colors.text2, fontFamily: font.dm }]}>
              sidequests you saved to do later.
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 18 }} />
          ) : (
            <View style={styles.savedList}>
              {saved.length === 0 ? (
                <View style={[styles.emptyTip, { borderColor: colors.border2, backgroundColor: colors.card }]}>
                  <Text style={{ color: colors.text2, fontFamily: font.dm, lineHeight: 18, textAlign: 'center' }}>
                    tap + save on a sidequest in home feed and it will show up here.
                  </Text>
                  <Pressable onPress={() => router.push('/(tabs)/feed')} style={{ marginTop: 10 }}>
                    <Text style={{ color: colors.accent, fontFamily: font.syne, fontWeight: '800', textAlign: 'center' }}>
                      go to home →
                    </Text>
                  </Pressable>
                </View>
              ) : (
                saved.map((s) => (
                  <Pressable
                    key={s.save_id}
                    onPress={() => router.push(`/sidequest/${s.sidequest.id}`)}
                    style={({ pressed }) => [
                      styles.savedCard,
                      { borderColor: colors.border2, backgroundColor: colors.card, opacity: pressed ? 0.93 : 1 },
                    ]}
                  >
                    <Text style={{ color: colors.text3, fontFamily: font.syne, fontSize: 10 }}>saved for later</Text>
                    <Text style={[styles.savedTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>
                      {s.sidequest.title}
                    </Text>
                    <View style={styles.savedCats}>
                      {(s.sidequest.categories ?? []).slice(0, 3).map((c) => (
                        <View key={c} style={[styles.savedCat, { borderColor: colors.border2, backgroundColor: colors.bg3 }]}>
                          <Text style={{ color: colors.text2, fontFamily: font.syne, fontSize: 10 }}>{c}</Text>
                        </View>
                      ))}
                    </View>
                  </Pressable>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  head: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10 },
  title: { fontSize: 22, letterSpacing: -0.3 },
  sub: { fontSize: 12, lineHeight: 18, marginTop: 6, maxWidth: 320 },
  savedList: { paddingHorizontal: 18, gap: 10, paddingBottom: 8 },
  savedCard: { borderWidth: 1, borderRadius: 14, padding: 12 },
  savedTitle: { fontSize: 16, lineHeight: 22, marginTop: 4 },
  savedCats: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  savedCat: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  emptyTip: { marginHorizontal: 18, borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 4 },
});

