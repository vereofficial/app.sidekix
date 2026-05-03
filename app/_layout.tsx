import {
  DMSans_300Light,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
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
import { useEffect, useRef } from 'react';
import {
  InteractionManager,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { AppThemeProvider, useAppTheme } from '../src/context/AppThemeContext';
import { useOtaOnLaunch } from '../src/hooks/useOtaOnLaunch';
import { useStoreRatingPrompt } from '../src/hooks/useStoreRatingPrompt';
import {
  attachFriendRequestRealtime,
  attachSidequestNotificationHandlers,
  consumeInitialSidequestNotificationIfAny,
  initNotificationHandler,
  registerExpoPushTokenForUser,
  scheduleSidequestDropReminder,
} from '../src/lib/notifications';
import { getStoreListingReviewUrl } from '../src/lib/storeListing';
import { WeeklyWinCelebrationHost } from '../src/components/WeeklyWinCelebrationHost';
import { font, getColors } from '../src/theme';

SplashScreen.preventAutoHideAsync();

function NavigationShell() {
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const { session, user } = useAuth();
  const { visible: rateVisible, onRate, onNotNow } = useStoreRatingPrompt(Boolean(session));

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void initNotificationHandler();
    const detach = attachSidequestNotificationHandlers();
    return () => detach();
  }, []);

  const consumedOpenNotifRef = useRef(false);
  useEffect(() => {
    if (Platform.OS === 'web' || consumedOpenNotifRef.current) return;
    const task = InteractionManager.runAfterInteractions(() => {
      if (consumedOpenNotifRef.current) return;
      consumedOpenNotifRef.current = true;
      void consumeInitialSidequestNotificationIfAny();
    });
    return () => task.cancel();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' || !session) return;
    void scheduleSidequestDropReminder();
  }, [session]);

  useEffect(() => {
    if (Platform.OS === 'web' || !user?.id) return;
    void registerExpoPushTokenForUser(user.id);
    const detach = attachFriendRequestRealtime(user.id);
    return detach;
  }, [user?.id]);
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
            ...(Platform.OS === 'ios'
              ? {
                  /** Reduces the light “shadow” strip during edge gestures on some iOS versions. */
                  fullScreenGestureShadowEnabled: false,
                }
              : {}),
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="today" />
          <Stack.Screen name="lead" />
          <Stack.Screen name="upload" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="post-choice" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="new-sidequest" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="new-adventure" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="rate-sidequest" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="onboarding" options={{ presentation: 'card', animation: 'fade' }} />
          <Stack.Screen name="sharecard" />
          <Stack.Screen name="sidequest/[id]" />
          <Stack.Screen name="challenge/[id]" />
          <Stack.Screen name="p/[id]" />
          <Stack.Screen name="saved-quests" />
        </Stack>
      </NavThemeProvider>
      <Modal visible={rateVisible} transparent animationType="fade">
        <Pressable style={rateStyles.backdrop} onPress={onNotNow}>
          <Pressable style={[rateStyles.card, { backgroundColor: colors.card, borderColor: colors.border2 }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[rateStyles.title, { color: colors.text1, fontFamily: font.syneExtra }]}>enjoying sidekix?</Text>
            <Text style={[rateStyles.sub, { color: colors.text2, fontFamily: font.dm }]}>
              Tap a star to rate the app. You can also leave a public review with the link below.
            </Text>
            <View style={rateStyles.stars}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Pressable key={i} onPress={onRate} hitSlop={10}>
                  <Text style={[rateStyles.star, { color: colors.accent }]}>★</Text>
                </Pressable>
              ))}
            </View>
            {Platform.OS !== 'web' ? (
              <Pressable
                onPress={async () => {
                  try {
                    await Linking.openURL(getStoreListingReviewUrl());
                  } catch {
                    /* ignore */
                  }
                  await onNotNow();
                }}
                style={rateStyles.writeReview}
              >
                <Text style={{ color: colors.accent, fontFamily: font.syne, fontSize: 13, textAlign: 'center' }}>
                  write a review in the {Platform.OS === 'ios' ? 'app store' : 'play store'}
                </Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onNotNow} style={rateStyles.later}>
              <Text style={{ color: colors.text3, fontFamily: font.syne, fontSize: 12 }}>not now</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <WeeklyWinCelebrationHost />
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
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 12 },
  writeReview: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 8, marginBottom: 8 },
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
    DMSans_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });

  useEffect(() => {
    if (loaded || err) SplashScreen.hideAsync();
  }, [loaded, err]);

  useOtaOnLaunch(Boolean(loaded || err));

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
