import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { colors, spacing } from '@/theme/tokens';

type ListRowProps = {
  title: string;
  subtitle?: string;
  username?: string;
  avatarPath?: string | null;
  onPress?: () => void;
  accessory?: React.ReactNode;
};

export function ListRow({
  title,
  subtitle,
  username,
  avatarPath,
  onPress,
  accessory,
}: ListRowProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {username ? <ProfileAvatar username={username} avatarPath={avatarPath} /> : null}
      <View style={styles.copy}>
        <AppText variant="label">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color={colors.muted} numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {accessory ?? (onPress ? <Feather name="chevron-right" size={20} color={colors.muted} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  copy: { flex: 1, gap: 2 },
  pressed: { opacity: 0.65 },
});
