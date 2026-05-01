import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../theme';
import { font } from '../theme';
import { peopleDidThisLine } from '../lib/peopleDidThis';

type Size = 'sm' | 'md';

export function PeopleParticipationRow({
  names,
  count,
  colors,
  avatarBorderColor,
  size = 'sm',
  copyColor,
}: {
  /** Display names / labels in feed order (dedup before passing). Max 3 avatars rendered. */
  names: string[];
  count: number;
  colors: ThemeColors;
  avatarBorderColor: string;
  size?: Size;
  /** Overrides default tertiary copy color (e.g. blue emphasis on idea cards). */
  copyColor?: string;
}) {
  const line = peopleDidThisLine(count);
  if (!line) return null;

  const slice = names.slice(0, 3);
  const dim = size === 'md' ? 26 : 20;
  const fontSize = size === 'md' ? 11 : 10;

  return (
    <View style={styles.row}>
      <View style={styles.avatarStack}>
        {slice.map((name, idx) => (
          <View
            key={`${name}-${idx}`}
            style={[
              styles.avatar,
              {
                width: dim,
                height: dim,
                borderRadius: dim / 2,
                marginLeft: idx === 0 ? 0 : -(dim * 0.35),
                borderColor: avatarBorderColor,
                backgroundColor: colors.bg3,
              },
            ]}
          >
            <Text style={{ color: colors.text2, fontFamily: font.dmBold, fontSize }}>{(name?.charAt(0) ?? 'U').toUpperCase()}</Text>
          </View>
        ))}
      </View>
      <Text
        style={[styles.copy, { color: copyColor ?? colors.text2, fontFamily: font.dmBold, fontSize: size === 'md' ? 14 : 12 }]}
      >
        {line}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flexShrink: 1 },
});
