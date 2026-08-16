import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { ComponentProps } from 'react';

import { AppText } from '@/components/ui/app-text';
import { colors, radius, spacing } from '@/theme/tokens';

type ButtonProps = ComponentProps<typeof Pressable> & {
  label: string;
  loading?: boolean;
  tone?: 'primary' | 'secondary' | 'quiet' | 'danger';
  icon?: React.ReactNode;
};

export function Button({
  label,
  loading = false,
  tone = 'primary',
  icon,
  disabled,
  style,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading, disabled: Boolean(disabled || loading) }}
      disabled={disabled || loading}
      style={(state) => [
        styles.base,
        styles[tone],
        (disabled || loading) && styles.disabled,
        state.pressed && styles.pressed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={tone === 'primary' || tone === 'danger' ? colors.cream : colors.ink} />
      ) : (
        <View style={styles.content}>
          {icon}
          <AppText
            variant="label"
            color={tone === 'primary' || tone === 'danger' ? colors.cream : colors.ink}
          >
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  primary: { backgroundColor: colors.orange },
  secondary: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  quiet: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.danger },
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
});
