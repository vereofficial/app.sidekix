import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DailyChallengeDrop } from '../../src/components/DailyChallengeDrop';
import { useAppTheme } from '../../src/context/AppThemeContext';
import { font, getColors } from '../../src/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const bottomPad = Math.max(insets.bottom, 12);

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text3,
        tabBarStyle: {
          backgroundColor: colors.navBg,
          borderTopColor: colors.navBorder,
          paddingTop: 10,
          paddingBottom: bottomPad,
          minHeight: 56 + bottomPad,
          height: 56 + bottomPad,
        },
        tabBarLabelStyle: {
          fontFamily: font.syne,
          fontSize: 9,
          letterSpacing: 0.7,
          textTransform: 'uppercase',
          fontWeight: '700',
          marginTop: 2,
        },
        tabBarIconStyle: { marginBottom: -2 },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => <Ionicons name="flash" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color }) => <Ionicons name="grid" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="lead"
        options={{
          title: 'Ranks',
          tabBarIcon: ({ color }) => <Ionicons name="bar-chart" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} />,
        }}
      />
    </Tabs>
    <DailyChallengeDrop />
    </View>
  );
}
