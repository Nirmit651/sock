import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { colors, spacing } from '@/theme/tokens';

type SectionHeadingProps = {
  title: string;
  action?: string;
  onAction?: () => void;
};

export function SectionHeading({ title, action, onAction }: SectionHeadingProps) {
  return (
    <View style={styles.row}>
      <AppText variant="heading">{title}</AppText>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={12}>
          <AppText variant="label" color={colors.orangeDark}>
            {action}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
});
