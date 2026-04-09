import { StyleSheet, Text } from 'react-native';
import type { ThemeColors } from '../theme';
import { font } from '../theme';

type Props = { colors: ThemeColors; size?: number };

export function Wordmark({ colors, size = 15 }: Props) {
  return (
    <Text style={[styles.mark, { fontSize: size, color: colors.text1, fontFamily: font.syneExtra }]}>
      side<Text style={{ color: colors.accent }}>kix</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  mark: { letterSpacing: -0.3 },
});
