import { LinearGradient } from 'expo-linear-gradient';
import type { ColorSchemeName } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getTextPostPreset } from '../lib/textPostPresets';
import type { ThemeColors } from '../theme';
import { font } from '../theme';
import { formatRelativePostTime } from '../lib/formatRelativePostTime';
import type { SidequestPostRow } from '../types/database';

/** Text-only adventure on sidequest detail — uses same “Moss” gradient preset as feed text posts. */
export function SidequestTextSubmissionCard({
  post,
  displayName,
  colors,
  scheme,
  canRemove,
  onRemove,
}: {
  post: SidequestPostRow;
  displayName: string;
  colors: ThemeColors;
  scheme: ColorSchemeName;
  canRemove: boolean;
  onRemove?: () => void;
}) {
  const body = (post.body ?? '').trim();
  const initial =
    displayName.toLowerCase() === 'anonymous' ? '?' : (displayName.charAt(0).toUpperCase() || '?');
  const when = formatRelativePostTime(post.created_at);
  const isDark = scheme === 'dark';
  const preset = getTextPostPreset(0);
  const grad = (isDark ? preset.dark : preset.light) as unknown as [string, string, string];
  const borderC = isDark ? preset.accentBorderDark : preset.accentBorderLight;
  const fg = isDark ? preset.textDark : preset.textLight;

  return (
    <View style={[styles.card, { borderColor: colors.border2, backgroundColor: colors.card }]}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <View style={[styles.avatar, { borderColor: colors.border2, backgroundColor: colors.bg3 }]}>
            <Text style={{ color: colors.text2, fontFamily: font.dmBold, fontSize: 13 }}>{initial}</Text>
          </View>
          <View style={styles.headText}>
            <Text style={{ color: colors.text1, fontFamily: font.dmBold, fontSize: 14 }} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 10, marginTop: 2 }}>{when}</Text>
          </View>
        </View>
        {canRemove && onRemove ? (
          <Pressable
            onPress={onRemove}
            hitSlop={8}
            style={[styles.removeBtn, { borderColor: colors.border2 }]}
          >
            <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 10 }}>remove ✕</Text>
          </Pressable>
        ) : null}
      </View>

      <LinearGradient
        colors={grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradBox, { borderColor: borderC, borderWidth: 1 }]}
      >
        <Text style={[styles.bodyText, { color: fg }]}>{body}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { flex: 1, minWidth: 0 },
  removeBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  gradBox: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    width: '100%',
  },
  bodyText: {
    fontFamily: font.dm,
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 24,
  },
});
