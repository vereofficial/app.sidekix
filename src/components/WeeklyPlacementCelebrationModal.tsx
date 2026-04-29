import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/AppThemeContext';
import { hapticSuccess } from '../lib/haptics';
import {
  countRankedBelowYou,
  type WeeklyPlacementCelebrationPayload,
} from '../lib/weeklyWinCelebration';
import { ordinalPlace } from '../lib/ordinalRank';
import { font, getColors } from '../theme';

type Props = {
  visible: boolean;
  payload: WeeklyPlacementCelebrationPayload | null;
  onClose: () => void;
};

export function WeeklyPlacementCelebrationModal({ visible, payload, onClose }: Props) {
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const scheme = resolvedScheme;
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(0.88)).current;
  const fade = useRef(new Animated.Value(0)).current;

  const gradientColors = useMemo((): [string, string, string] => {
    if (scheme === 'dark') {
      return [colors.bg2, colors.bg, '#050505'];
    }
    return ['#faf9f5', colors.bg, colors.bg3];
  }, [scheme, colors.bg, colors.bg2, colors.bg3]);

  const primaryBtnLabel = scheme === 'light' ? '#ffffff' : '#0a0a0a';

  useEffect(() => {
    if (!visible || !payload) return;
    void hapticSuccess();
    scale.setValue(0.88);
    fade.setValue(0);
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 88,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, payload, fade, scale]);

  if (!payload) return null;

  const { recap, rank } = payload;
  const edgedOutCount = countRankedBelowYou(recap.competitorCount, rank);

  const recapCardStyle = [
    styles.recapCard,
    {
      backgroundColor: colors.card,
      borderColor: colors.border2,
    },
    scheme === 'light'
      ? Platform.select({
          ios: {
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
          },
          android: { elevation: 4 },
          default: {},
        })
      : {},
  ];

  const goRanks = () => {
    onClose();
    try {
      router.replace('/lead');
    } catch {
      /* router may not be ready */
    }
  };

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              flexGrow: 1,
              justifyContent: 'center',
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Animated.View style={{ opacity: fade, transform: [{ scale }] }}>
            <Text style={styles.emojiRain}>✨ 📊 ✨</Text>
            <Text style={[styles.title, { color: colors.text1, fontFamily: font.syneExtra }]}>You made the board</Text>
            <Text style={[styles.subtitle, { color: colors.text2, fontFamily: font.dm }]}>
              {`You finished ${ordinalPlace(rank)} last week — that’s the visible leaderboard. A real run.`}
            </Text>

            <View style={recapCardStyle}>
              <Text style={[styles.recapLabel, { color: colors.accent, fontFamily: font.syne }]}>Your week in numbers</Text>
              <Text style={[styles.recapLine, { color: colors.text1, fontFamily: font.dm }]}>
                {recap.reactionsReceived} reactions on your posts
              </Text>
              <Text style={[styles.recapLine, { color: colors.text1, fontFamily: font.dm }]}>
                Posted on {recap.daysPosted} challenge day{recap.daysPosted === 1 ? '' : 's'}
              </Text>
              <Text style={[styles.recapLine, { color: colors.text1, fontFamily: font.dm }]}>
                {recap.competitorCount} people on the leaderboard
                {edgedOutCount > 0 ? ` — you edged out ${edgedOutCount}` : ''}
              </Text>
              <Text style={[styles.recapLine, { color: colors.text2, fontFamily: font.dm }]}>
                You gave {recap.reactionsGiven} reactions to others' posts
              </Text>
            </View>

            <Pressable
              onPress={goRanks}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: colors.accent,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <Text style={[styles.primaryBtnText, { color: primaryBtnLabel, fontFamily: font.syne }]}>View ranks</Text>
            </Pressable>

            <Pressable onPress={onClose} style={styles.later}>
              <Text style={[styles.laterText, { color: colors.text3, fontFamily: font.syne }]}>maybe later</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    ...Platform.select({ web: { minHeight: '100vh' as unknown as number }, default: {} }),
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  emojiRain: {
    fontSize: 40,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 4,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  recapCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 20,
    gap: 8,
  },
  recapLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  recapLine: {
    fontSize: 14,
    lineHeight: 21,
  },
  primaryBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
  },
  later: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  laterText: {
    fontSize: 13,
    letterSpacing: 0.4,
  },
});
