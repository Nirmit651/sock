import { Feather } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View, type ColorValue } from 'react-native';

import { ErrorState } from '@/components/ui/error-state';
import { useNotificationRegistration } from '@/hooks/use-notification-registration';
import { useAuth } from '@/providers/auth-provider';
import { colors, font } from '@/theme/tokens';

const icon = (name: React.ComponentProps<typeof Feather>['name']) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Feather name={name} color={color} size={size} />;
  };

export default function TabsLayout() {
  const { session, loading, initializationError, retrySession } = useAuth();
  useNotificationRegistration(session?.user.id);
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.orange} />
      </View>
    );
  }
  if (initializationError) {
    return (
      <View style={styles.error}>
        <ErrorState body={initializationError} onRetry={() => void retrySession()} />
      </View>
    );
  }
  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.bar,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends', tabBarIcon: icon('users') }} />
      <Tabs.Screen name="groups" options={{ title: 'Groups', tabBarIcon: icon('layers') }} />
      <Tabs.Screen name="stats" options={{ title: 'Wrapped', tabBarIcon: icon('bar-chart-2') }} />
      <Tabs.Screen name="profile" options={{ title: 'You', tabBarIcon: icon('user') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  error: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.cream },
  bar: {
    backgroundColor: colors.ink,
    borderTopWidth: 0,
    height: 82,
    paddingTop: 9,
    paddingBottom: 12,
  },
  label: { fontFamily: font.medium, fontSize: 11 },
});
