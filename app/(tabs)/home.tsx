import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MyPostsJournal } from '../../src/components/MyPostsJournal';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/AppThemeContext';
import { useMyPosts } from '../../src/hooks/useMyPosts';
import { font, getColors } from '../../src/theme';

const TABLET_CONTENT_MAX = 640;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const { user } = useAuth();
  const { posts, refresh } = useMyPosts(user?.id);
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
        contentContainerStyle={{ paddingBottom: 28 + insets.bottom, alignItems: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onPull()} tintColor={colors.accent} />}
      >
        <View style={{ width: '100%', maxWidth: TABLET_CONTENT_MAX, paddingHorizontal: 18, paddingTop: 12 }}>
          <MyPostsJournal posts={posts} colors={colors} />

          <Text style={[styles.sectionLabel, { color: colors.text3, fontFamily: font.syne, marginTop: 6 }]}>
            saved for later
          </Text>
          <Pressable
            onPress={() => router.push('/saved-quests')}
            style={[styles.savedQuestsBtn, { borderColor: colors.border2, backgroundColor: colors.card }]}
          >
            <Text style={{ color: colors.text1, fontFamily: font.syne, fontWeight: '700' }}>saved quests</Text>
            <Text style={{ color: colors.text3, fontFamily: font.dm, fontSize: 12, marginTop: 3 }}>
              ideas you bookmarked from Home
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  sectionLabel: { fontSize: 10, letterSpacing: 1, marginBottom: 8 },
  savedQuestsBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
});
