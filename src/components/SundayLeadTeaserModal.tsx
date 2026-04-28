import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/AppThemeContext';
import { hapticMedium } from '../lib/haptics';
import { openSidekixInstagramDm } from '../lib/openSidekixInstagramDm';
import { font, getColors } from '../theme';

type Props = {
  visible: boolean;
  prizeEligible: boolean;
  onClose: () => void;
};

/** Sunday evening: user is #1 going into the final hours of the week. */
export function SundayLeadTeaserModal({ visible, prizeEligible, onClose }: Props) {
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const scheme = resolvedScheme;
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(0.9)).current;
  const fade = useRef(new Animated.Value(0)).current;

  const gradientColors = useMemo((): [string, string, string] => {
    if (scheme === 'dark') {
      return [colors.bg2, colors.bg, '#050505'];
    }
    return ['#fff9f0', colors.bg, colors.bg3];
  }, [scheme, colors.bg, colors.bg2, colors.bg3]);

  const primaryLabel = scheme === 'light' ? '#ffffff' : '#0a0a0a';

  useEffect(() => {
    if (!visible) return;
    void hapticMedium();
    scale.setValue(0.9);
    fade.setValue(0);
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, { toValue: 1, friction: 8, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [visible, fade, scale]);

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent onRequestClose={onClose}>
      <View
        style={[
          styles.root,
          {
            backgroundColor: colors.bg,
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
      >
        <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.inner, { opacity: fade, transform: [{ scale }] }]}>
          <Text style={styles.emoji}>🌙 ✨</Text>
          <Text style={[styles.title, { color: colors.text1, fontFamily: font.syneExtra }]}>Final stretch</Text>
          <Text style={[styles.sub, { color: colors.text2, fontFamily: font.dm }]}>
            {prizeEligible
              ? "You're #1 going into Sunday night. Hold the lead until midnight to lock in the prize."
              : "You're #1 tonight — keep it through midnight. Check the prize rules: you may still need a few qualifying reactions on others' posts."}
          </Text>
          <Pressable
            onPress={() => void openSidekixInstagramDm()}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={[styles.primaryText, { color: primaryLabel, fontFamily: font.syne }]}>Questions? DM @sidekix.app</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.later}>
            <Text style={[styles.laterText, { color: colors.text3, fontFamily: font.syne }]}>got it</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 26,
    ...Platform.select({ web: { minHeight: '100vh' as unknown as number }, default: {} }),
  },
  inner: { alignItems: 'center' },
  emoji: { fontSize: 44, marginBottom: 14 },
  title: { fontSize: 26, textAlign: 'center', marginBottom: 12 },
  sub: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  primary: { borderRadius: 999, paddingVertical: 14, paddingHorizontal: 22, alignSelf: 'stretch', alignItems: 'center' },
  primaryText: { fontSize: 14, fontWeight: '800' },
  later: { marginTop: 18, paddingVertical: 10 },
  laterText: { fontSize: 13, letterSpacing: 0.4 },
});
