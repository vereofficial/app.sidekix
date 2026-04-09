import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { ChallengeRow } from '../types/database';
import { hapticChallengeDropBurst, hapticLight } from '../lib/haptics';
import { font, getColors } from '../theme';

type Colors = ReturnType<typeof getColors>;

export function ChallengeDropOverlay({
  colors,
  scheme,
  insetsTop,
  challenge,
  onGo,
}: {
  colors: Colors;
  scheme: 'light' | 'dark';
  insetsTop: number;
  challenge: ChallengeRow | null;
  onGo: () => void | Promise<void>;
}) {
  const overlayOp = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(1)).current;
  const emojiScale = useRef(new Animated.Value(0)).current;
  const emojiOp = useRef(new Animated.Value(0)).current;
  const line1 = useRef(new Animated.Value(0)).current;
  const line2 = useRef(new Animated.Value(0)).current;
  const line3 = useRef(new Animated.Value(0)).current;
  const ctaOp = useRef(new Animated.Value(0)).current;

  const confetti = useRef(
    Array.from({ length: 28 }, (_, i) => ({
      leftPct: 4 + ((i * 17 + Math.floor(Math.random() * 9)) % 88),
      delay: Math.random() * 400,
      duration: 1800 + Math.random() * 1200,
      anim: new Animated.Value(0),
      rot: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ring, { toValue: 1.06, duration: 2000, useNativeDriver: true }),
        Animated.timing(ring, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    hapticChallengeDropBurst();

    Animated.spring(emojiScale, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }).start();
    Animated.timing(emojiOp, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    const stagger = (v: Animated.Value, ms: number) =>
      Animated.timing(v, { toValue: 1, duration: 450, delay: ms, useNativeDriver: true });

    stagger(line1, 200).start();
    stagger(line2, 380).start();
    stagger(line3, 520).start();
    Animated.timing(ctaOp, { toValue: 1, duration: 400, delay: 720, useNativeDriver: true }).start();

    confetti.forEach((c) => {
      Animated.sequence([
        Animated.delay(c.delay),
        Animated.parallel([
          Animated.timing(c.anim, { toValue: 1, duration: c.duration, useNativeDriver: true }),
          Animated.timing(c.rot, { toValue: 1, duration: c.duration, useNativeDriver: true }),
        ]),
      ]).start();
    });

    return () => loop.stop();
  }, [ring, emojiScale, emojiOp, line1, line2, line3, ctaOp, confetti]);

  const dismiss = () => {
    hapticLight();
    Animated.timing(overlayOp, { toValue: 0, duration: 350, useNativeDriver: true }).start(({ finished }) => {
      if (finished) void Promise.resolve(onGo());
    });
  };

  const accentSoft = scheme === 'dark' ? '#D4FF3F10' : '#5a7a0012';

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insetsTop }]}>
      <Animated.View style={[styles.flex, { opacity: overlayOp }]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              {
                transform: [{ scale: ring }],
                opacity: 0.9,
              },
            ]}
          >
            <LinearGradient
              colors={[accentSoft, 'transparent', accentSoft]}
              start={{ x: 0.5, y: 0.5 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
        </View>

        {confetti.map((c, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.confettiPiece,
              {
                left: `${c.leftPct}%`,
                opacity: c.anim.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 0.85, 0.85, 0] }),
                transform: [
                  {
                    translateY: c.anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 720] }),
                  },
                  {
                    rotate: c.rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] }),
                  },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={
                scheme === 'dark'
                  ? ['rgba(212,255,63,0.45)', 'rgba(212,255,63,0.08)']
                  : ['rgba(90,122,0,0.35)', 'rgba(90,122,0,0.06)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
        ))}

        <View style={styles.dropOverlay}>
          <Animated.Text
            style={[
              styles.dropEmoji,
              {
                opacity: emojiOp,
                transform: [{ scale: emojiScale }],
              },
            ]}
          >
            👀
          </Animated.Text>
          <Animated.Text
            style={[
              styles.dropEye,
              {
                color: colors.accent,
                fontFamily: font.syne,
                opacity: line1,
                transform: [
                  {
                    translateY: line1.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
                  },
                ],
              },
            ]}
          >
            {challenge ? `sidequest #${challenge.display_number} · today` : 'sidequest · today'}
          </Animated.Text>
          <Animated.Text
            style={[
              styles.dropTitle,
              {
                color: colors.text1,
                fontFamily: font.syneExtra,
                opacity: line2,
                transform: [
                  {
                    translateY: line2.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
                  },
                ],
              },
            ]}
          >
            {challenge ? (
              <>
                find your favorite <Text style={{ color: colors.accent, fontStyle: 'normal' }}>bathroom</Text> on{' '}
                <Text style={{ color: colors.accent, fontStyle: 'normal' }}>campus</Text>
              </>
            ) : (
              "today's sidequest"
            )}
          </Animated.Text>
          <Animated.Text
            style={[
              styles.dropSub,
              {
                color: colors.text2,
                fontFamily: font.dm,
                opacity: line3,
                transform: [
                  {
                    translateY: line3.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
                  },
                ],
              },
            ]}
          >
            you have until midnight.
          </Animated.Text>
          <Animated.View style={{ opacity: ctaOp }}>
            <Pressable
              onPress={dismiss}
              style={({ pressed }) => [
                styles.dropCta,
                {
                  opacity: pressed ? 0.9 : 1,
                  overflow: 'hidden',
                },
              ]}
            >
              <LinearGradient
                colors={scheme === 'dark' ? ['#D4FF3F', '#9fb82e'] : ['#5a7a00', '#7a9a20']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Text
                style={[
                  styles.dropCtaText,
                  { color: scheme === 'light' ? '#fff' : '#0A0A0A', fontFamily: font.syne },
                ]}
              >
                let&apos;s go →
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dropOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  dropEmoji: { fontSize: 52, marginBottom: 10 },
  dropEye: { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },
  dropTitle: { fontSize: 30, textAlign: 'center', lineHeight: 34, letterSpacing: -0.35 },
  dropSub: { fontSize: 13, marginTop: 8, textAlign: 'center' },
  dropCta: {
    marginTop: 28,
    borderRadius: 50,
    paddingVertical: 14,
    paddingHorizontal: 36,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropCtaText: { fontSize: 14, fontWeight: '800', zIndex: 1 },
  confettiPiece: {
    position: 'absolute',
    top: 0,
    width: 9,
    height: 14,
    borderRadius: 3,
    overflow: 'hidden',
  },
});
