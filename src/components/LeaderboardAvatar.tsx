import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../context/AppThemeContext';
import { useReadableStorageUrl } from '../hooks/useReadableStorageUrl';
import { getColors } from '../theme';

export function LeaderboardAvatar({
  username,
  avatarPath,
  size = 52,
  radius = 12,
}: {
  username: string;
  avatarPath: string | null | undefined;
  size?: number;
  radius?: number;
}) {
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const { displayUri, onLoadError } = useReadableStorageUrl(avatarPath ?? null);
  const initial = (username?.trim()?.[0] ?? '?').toUpperCase();

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: radius }]}>
      {displayUri ? (
        <Image
          source={{ uri: displayUri }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          cachePolicy="memory-disk"
          onError={onLoadError}
        />
      ) : (
        <View style={[styles.fallback, { backgroundColor: colors.bg3 }]}>
          <Text style={[styles.initial, { color: colors.accent }]}>{initial}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#1a1a1a' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 20, fontWeight: '800' },
});
