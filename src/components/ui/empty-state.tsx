import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { colors, spacing } from '@/theme/tokens';

export function EmptyState({ title, body, emoji = '🧦' }: { title: string; body: string; emoji?: string }) {
  return (
    <View style={styles.wrap}>
      <AppText style={styles.emoji}>{emoji}</AppText>
      <AppText variant="label">{title}</AppText>
      <AppText variant="caption" color={colors.muted} style={styles.body}>
        {body}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  emoji: { fontSize: 28 },
  body: { maxWidth: 360 },
});
