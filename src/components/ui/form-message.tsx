import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { colors, spacing } from '@/theme/tokens';

type FormMessageProps = {
  children: string;
  tone?: 'error' | 'success';
};

export function FormMessage({ children, tone = 'error' }: FormMessageProps) {
  const color = tone === 'success' ? colors.success : colors.danger;
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.message, { borderLeftColor: color }]}
    >
      <AppText variant="caption" color={color}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  message: {
    borderLeftWidth: 3,
    paddingLeft: spacing.md,
    paddingVertical: spacing.xs,
  },
});
