import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/AppThemeContext';
import { HomeFlow } from '../src/flows/HomeFlow';
import { isSupabaseConfigured } from '../src/lib/supabaseConfig';
import { MissingConfigScreen } from '../src/screens/MissingConfigScreen';
import { getColors } from '../src/theme';

export default function Index() {
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const { session, authLoading } = useAuth();

  if (!isSupabaseConfigured()) {
    return <MissingConfigScreen />;
  }

  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (session) {
    return <Redirect href="/today" />;
  }

  return <HomeFlow />;
}
