import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { colors, spacing } from '@/theme/tokens';

type ErrorStateProps = {
  title?: string;
  body?: string;
  onRetry: () => void;
};

export function ErrorState({
  title = 'Couldn’t load this yet',
  body = 'Check your connection and try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <View accessibilityRole="alert" style={styles.container}>
      <Feather name="wifi-off" size={30} color={colors.orange} />
      <View style={styles.copy}>
        <AppText variant="heading">{title}</AppText>
        <AppText color={colors.muted}>{body}</AppText>
      </View>
      <Button label="Try again" tone="secondary" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg, paddingVertical: spacing.xl },
  copy: { gap: spacing.sm },
});
