import {
  DMSans_300Light,
  DMSans_400Regular,
  DMSans_500Medium,
} from '@expo-google-fonts/dm-sans';
import {
  Syne_400Regular,
  Syne_600SemiBold,
  Syne_700Bold,
  Syne_800ExtraBold,
} from '@expo-google-fonts/syne';
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { AppThemeProvider, useAppTheme } from '../src/context/AppThemeContext';
import { useStoreRatingPrompt } from '../src/hooks/useStoreRatingPrompt';
import { initNotificationHandler, scheduleSidequestDropReminder } from '../src/lib/notifications';
import { font, getColors } from '../src/theme';

SplashScreen.preventAutoHideAsync();

function NavigationShell() {
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const { session } = useAuth();
  const { visible: rateVisible, onRate, onNotNow } = useStoreRatingPrompt(Boolean(session));

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void initNotificationHandler();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' || !session) return;
    void scheduleSidequestDropReminder();
  }, [session]);
  const nav = resolvedScheme === 'dark' ? DarkTheme : DefaultTheme;
  const merged = {
    ...nav,
    colors: {
      ...nav.colors,
      background: colors.bg,
      card: colors.bg,
      border: colors.navBorder,
    },
  };

  return (
    <>
      <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />
      <NavThemeProvider value={merged}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="upload" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="sharecard" />
          <Stack.Screen name="p/[id]" />
        </Stack>
      </NavThemeProvider>
      <Modal visible={rateVisible} transparent animationType="fade">
        <Pressable style={rateStyles.backdrop} onPress={onNotNow}>
          <Pressable style={[rateStyles.card, { backgroundColor: colors.card, borderColor: colors.border2 }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[rateStyles.title, { color: colors.text1, fontFamily: font.syneExtra }]}>enjoying sidekix?</Text>
            <Text style={[rateStyles.sub, { color: colors.text2, fontFamily: font.dm }]}>
              tap a star to rate on the app store
            </Text>
            <View style={rateStyles.stars}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Pressable key={i} onPress={onRate} hitSlop={10}>
                  <Text style={[rateStyles.star, { color: colors.accent }]}>★</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={onNotNow} style={rateStyles.later}>
              <Text style={{ color: colors.text3, fontFamily: font.syne, fontSize: 12 }}>not now</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const rateStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 18 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 16 },
  star: { fontSize: 32, lineHeight: 36 },
  later: { alignSelf: 'center', paddingVertical: 8 },
});

export default function RootLayout() {
  const [loaded, err] = useFonts({
    Syne_400Regular,
    Syne_600SemiBold,
    Syne_700Bold,
    Syne_800ExtraBold,
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
  });

  useEffect(() => {
    if (loaded || err) SplashScreen.hideAsync();
  }, [loaded, err]);

  if (!loaded && !err) return null;

  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <AuthProvider>
          <NavigationShell />
        </AuthProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
