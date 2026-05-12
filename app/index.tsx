import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/AppThemeContext';
import { hasCompletedOnboarding } from '../src/lib/onboardingStorage';
import { isSupabaseConfigured } from '../src/lib/supabaseConfig';
import { tryGetSupabase } from '../src/lib/supabase';
import { MissingConfigScreen } from '../src/screens/MissingConfigScreen';
import { getColors } from '../src/theme';

export default function Index() {
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const { session, authLoading } = useAuth();
  const [ready, setReady] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!session?.user?.id) {
        if (!cancelled) {
          setOnboardingDone(false);
          setReady(true);
        }
        return;
      }
      const done = await hasCompletedOnboarding(session.user.id, tryGetSupabase());
      if (!cancelled) {
        setOnboardingDone(done);
        setReady(true);
      }
    };
    setReady(false);
    void load();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  if (!isSupabaseConfigured()) {
    return <MissingConfigScreen />;
  }

  if (authLoading || (session && !ready)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (session) {
    if (!onboardingDone) return <Redirect href="/onboarding" />;
    return <Redirect href="/(tabs)/home" />;
  }

  return <Redirect href="/auth" />;
}
