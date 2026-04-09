import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { gradientPresets } from '../theme';

type Props = {
  index: number;
  style?: ViewStyle;
  borderRadius?: number;
};

export function GradientThumb({ index, style, borderRadius = 10 }: Props) {
  const pair = gradientPresets[index % gradientPresets.length];
  return (
    <View style={[styles.wrap, { borderRadius }, style]}>
      <LinearGradient colors={pair} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
});
