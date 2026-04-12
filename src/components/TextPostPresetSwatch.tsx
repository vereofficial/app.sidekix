import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../context/AppThemeContext';
import { getTextPostPreset } from '../lib/textPostPresets';
import { font, getColors } from '../theme';

type Props = {
  presetId: number;
  selected: boolean;
  onPress: () => void;
  /** Rounded square size (matches reference chips). */
  size?: number;
};

/**
 * Background picker tile: gradient fill + label (VOID / ACID / …) like the in-app reference.
 */
export function TextPostPresetSwatch({ presetId, selected, onPress, size = 62 }: Props) {
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const scheme = resolvedScheme;
  const preset = getTextPostPreset(presetId);
  const isDark = scheme === 'dark';
  const stops = isDark ? preset.dark : preset.light;
  const glow = isDark ? preset.glowDark : preset.glowLight;
  const borderOff = scheme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Background ${preset.label}`}>
      <View
        style={[
          styles.tile,
          {
            width: size,
            height: size,
            borderColor: selected ? colors.accent : borderOff,
            borderWidth: selected ? 2 : 1,
          },
        ]}
      >
        <LinearGradient
          colors={[stops[0], stops[1], stops[2]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {glow ? (
          <LinearGradient
            colors={[glow.colors[0], glow.colors[1]]}
            start={glow.start}
            end={glow.end}
            style={StyleSheet.absoluteFillObject}
          />
        ) : null}
        <View style={styles.labelWrap} pointerEvents="none">
          <Text
            style={[
              styles.label,
              {
                color: scheme === 'dark' ? 'rgba(235,238,228,0.88)' : 'rgba(30,32,28,0.85)',
                fontFamily: font.syne,
              },
            ]}
            numberOfLines={1}
          >
            {preset.label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  labelWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 7,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
