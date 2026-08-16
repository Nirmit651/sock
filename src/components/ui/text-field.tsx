import { forwardRef, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { colors, font, radius, spacing } from '@/theme/tokens';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  accessoryRight?: ReactNode;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, accessoryRight, style, ...props },
  ref,
) {
  return (
    <View style={styles.wrapper}>
      <AppText variant="label">{label}</AppText>
      <View style={styles.inputWrap}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.muted}
          selectionColor={colors.orange}
          style={[styles.input, error && styles.inputError, style, accessoryRight ? styles.inputWithAccessory : undefined]}
          accessibilityLabel={label}
          {...props}
        />
        {accessoryRight ? <View style={styles.accessoryRight}>{accessoryRight}</View> : null}
      </View>
      {error ? (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  inputWrap: { position: 'relative', justifyContent: 'center' },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    color: colors.ink,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontFamily: font.regular,
    fontSize: 16,
  },
  inputWithAccessory: { paddingRight: 68 },
  accessoryRight: {
    position: 'absolute',
    top: 0,
    right: spacing.xs,
    bottom: 0,
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputError: { borderColor: colors.danger },
});
