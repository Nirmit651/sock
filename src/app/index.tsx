import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/ui/error-state';
import { useAuth } from '@/providers/auth-provider';
import { colors } from '@/theme/tokens';

export default function Index() {
  const { session, loading, initializationError, retrySession } = useAuth();
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
        <ErrorState
          title="Couldn’t open Sock"
          body={initializationError}
          onRetry={() => void retrySession()}
        />
      </View>
    );
  }
  return <Redirect href={session ? '/(tabs)' : '/(auth)/login'} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  error: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.cream },
});
