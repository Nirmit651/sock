import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { colors, font, radius, spacing } from '@/theme/tokens';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, style, ...props },
  ref,
) {
  return (
    <View style={styles.wrapper}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.muted}
        selectionColor={colors.orange}
        style={[styles.input, error && styles.inputError, style]}
        accessibilityLabel={label}
        {...props}
      />
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
  inputError: { borderColor: colors.danger },
});
