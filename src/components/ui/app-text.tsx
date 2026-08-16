import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, font } from '@/theme/tokens';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';

type AppTextProps = PropsWithChildren<
  TextProps & {
    variant?: Variant;
    color?: string;
  }
>;

export function AppText({ variant = 'body', color = colors.ink, style, ...props }: AppTextProps) {
  return <Text {...props} style={[styles.base, styles[variant], { color }, style]} />;
}

const styles = StyleSheet.create({
  base: { fontFamily: font.regular },
  display: { fontFamily: font.bold, fontSize: 42, lineHeight: 44, letterSpacing: -1.6 },
  title: { fontFamily: font.bold, fontSize: 30, lineHeight: 34, letterSpacing: -0.9 },
  heading: { fontFamily: font.semibold, fontSize: 20, lineHeight: 24, letterSpacing: -0.35 },
  body: { fontSize: 16, lineHeight: 23 },
  label: { fontFamily: font.semibold, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: font.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
});
