import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

/** Light zoom — subtle crop at edges under blur (same idea as the old video layer). */
const IMAGE_ZOOM = 1.06;

/** Replace this file with your own frame from `canal.mov` if you prefer (same path / filename). */
const CANAL_BACKDROP = require('../../assets/images/auth-canal-backdrop.jpg');

/**
 * Static backdrop — no video decoder. Isolated from auth UI state (`busy`, etc.).
 * Android: skip expensive full-screen BlurView.
 */
export const AuthOpeningBackdrop = memo(function AuthOpeningBackdrop() {
  return (
    <View style={styles.stack} pointerEvents="none" collapsable={false}>
      <View style={styles.imageStage} collapsable={false}>
        <View style={styles.imageZoom} collapsable={false}>
          <Image
            source={CANAL_BACKDROP}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
            priority="high"
          />
        </View>
      </View>

      {Platform.OS === 'ios' ? (
        <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFillObject} />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.androidFrost]} />
      )}

      <View style={styles.scrim} />
      <LinearGradient
        colors={['rgba(0,0,0,0.12)', 'rgba(8,6,5,0.88)']}
        locations={[0.2, 1]}
        style={styles.bottomFade}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  stack: {
    ...StyleSheet.absoluteFillObject,
  },
  imageStage: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  imageZoom: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: IMAGE_ZOOM }],
  },
  androidFrost: {
    backgroundColor: 'rgba(12, 10, 8, 0.48)',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '52%',
  },
});
