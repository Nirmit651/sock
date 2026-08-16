import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Link, router, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { Screen } from '@/components/ui/screen';
import { SectionHeading } from '@/components/ui/section-heading';
import { TextField } from '@/components/ui/text-field';
import {
  useGroups,
  useNotificationPreferences,
  usePrivacyMutations,
  useProfile,
  useProfileMutation,
  useVisibility,
} from '@/hooks/use-data';
import { useNotificationRegistration } from '@/hooks/use-notification-registration';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { uploadAvatar } from '@/services/api';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Database } from '@/types/database';

type VisibilityMode = Database['public']['Enums']['sock_visibility_mode'];

const options: { mode: VisibilityMode; title: string; body: string; icon: 'users' | 'layers' | 'lock' }[] = [
  { mode: 'all_friends', title: 'All friends', body: 'Every accepted friend sees up/down.', icon: 'users' },
  { mode: 'selected_groups', title: 'Selected groups', body: 'Only members of groups you choose.', icon: 'layers' },
  { mode: 'private', title: 'Nobody', body: 'A private log. No social status.', icon: 'lock' },
];

export default function ProfileScreen() {
  const { user, signOut, deleteAccount } = useAuth();
  const userId = user?.id ?? '';
  const profile = useProfile(userId);
  const groups = useGroups(userId);
  const visibility = useVisibility(userId);
  const notifications = useNotificationPreferences(userId);
  const profileMutation = useProfileMutation(userId);
  const privacy = usePrivacyMutations(userId);
  const pushWarning = useNotificationRegistration(userId);

  const [usernameEdit, setUsernameEdit] = useState<string | null>(null);
  const [displayNameEdit, setDisplayNameEdit] = useState<string | null>(null);
  const [modeEdit, setModeEdit] = useState<VisibilityMode | null>(null);
  const [selectedGroupsEdit, setSelectedGroupsEdit] = useState<string[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const username = usernameEdit ?? profile.data?.username ?? '';
  const displayName = displayNameEdit ?? profile.data?.display_name ?? '';
  const mode = modeEdit ?? visibility.data?.mode ?? 'all_friends';
  const selectedGroups = selectedGroupsEdit ?? visibility.data?.groupIds ?? [];

  const saveProfile = async () => {
    if (!/^[a-z0-9_]{3,24}$/.test(username.trim().toLowerCase())) {
      Alert.alert('Check your username', 'Use 3–24 lowercase letters, numbers, or underscores.');
      return;
    }
    try {
      await profileMutation.mutateAsync({
        username: username.trim().toLowerCase(),
        display_name: displayName.trim() || null,
      });
      setUsernameEdit(null);
      setDisplayNameEdit(null);
      Alert.alert('Saved', 'Your profile is fresh out of the dryer.');
    } catch (error) {
      Alert.alert('Profile not saved', friendlyError(error));
    }
  };

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access is off', 'Allow photo access in Settings to choose a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      await uploadAvatar(userId, result.assets[0], profile.data?.avatar_path);
      await profile.refetch();
    } catch (error) {
      Alert.alert('Photo not uploaded', friendlyError(error));
    } finally {
      setUploading(false);
    }
  };

  const savePrivacy = async () => {
    if (mode === 'selected_groups' && !selectedGroups.length) {
      Alert.alert('Pick a group', 'Choose at least one group, or use Nobody for a private status.');
      return;
    }
    try {
      await privacy.visibility.mutateAsync({ mode, groupIds: selectedGroups });
      setModeEdit(null);
      setSelectedGroupsEdit(null);
      Alert.alert('Privacy updated', 'Your next sock session will use this audience.');
    } catch (error) {
      Alert.alert('Privacy not updated', friendlyError(error));
    }
  };

  const toggleGroup = (id: string) => {
    setSelectedGroupsEdit((edit) => {
      const current = edit ?? visibility.data?.groupIds ?? [];
      return current.includes(id)
        ? current.filter((groupId) => groupId !== id)
        : [...current, id];
    });
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your profile, friends, groups, sock history, preferences, device tokens, and avatar. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            void deleteAccount().catch((error) =>
              Alert.alert('Account not deleted', friendlyError(error, 'We could not delete your account. Try again.')),
            );
          },
        },
      ],
    );
  };

  if (profile.isError || visibility.isError) {
    return (
      <Screen>
        <ErrorState
          title="Couldn’t load your settings"
          onRetry={() => void Promise.all([profile.refetch(), visibility.refetch()])}
        />
      </Screen>
    );
  }

  return (
    <Screen
      refreshing={profile.isRefetching || visibility.isRefetching}
      onRefresh={() => void Promise.all([profile.refetch(), visibility.refetch(), notifications.refetch()])}
    >
      <View style={styles.header}>
        <View style={styles.avatarBlock}>
          <ProfileAvatar
            username={profile.data?.username ?? 's'}
            avatarPath={profile.data?.avatar_path}
            size={82}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change profile picture"
            disabled={uploading}
            onPress={pickAvatar}
            style={styles.camera}
          >
            <Feather name="camera" size={16} color={colors.cream} />
          </Pressable>
        </View>
        <View style={styles.headerCopy}>
          <AppText variant="title">You</AppText>
          <AppText color={colors.muted}>{user?.email}</AppText>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading title="Profile" />
        <TextField
          label="Username"
          value={username}
          onChangeText={setUsernameEdit}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={24}
        />
        <TextField
          label="Display name"
          value={displayName}
          onChangeText={setDisplayNameEdit}
          maxLength={60}
          placeholder="Optional"
        />
        <Button label="Save profile" tone="secondary" loading={profileMutation.isPending} onPress={saveProfile} />
      </View>

      <View style={styles.section}>
        <View>
          <SectionHeading title="Who sees your sock" />
          <AppText variant="caption" color={colors.muted} style={styles.sectionNote}>
            Completed sessions and exact history stay private in every mode.
          </AppText>
        </View>
        {options.map((option) => {
          const selected = mode === option.mode;
          return (
            <Pressable
              key={option.mode}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => setModeEdit(option.mode)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                <Feather name={option.icon} size={19} color={selected ? colors.cream : colors.ink} />
              </View>
              <View style={styles.optionCopy}>
                <AppText variant="label">{option.title}</AppText>
                <AppText variant="caption" color={colors.muted}>{option.body}</AppText>
              </View>
              <View style={[styles.radio, selected && styles.radioSelected]} />
            </Pressable>
          );
        })}

        {mode === 'selected_groups' ? (
          <View style={styles.groupPicker}>
            {groups.isError ? (
              <ErrorState
                title="Groups unavailable"
                onRetry={() => void groups.refetch()}
              />
            ) : groups.data?.length ? (
              groups.data.map((group) => {
                const checked = selectedGroups.includes(group.id);
                return (
                  <Pressable
                    key={group.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={`Share sock status with ${group.name}`}
                    onPress={() => toggleGroup(group.id)}
                    style={styles.groupRow}
                  >
                    <AppText variant="label" style={styles.optionCopy}>{group.name}</AppText>
                    <Feather name={checked ? 'check-circle' : 'circle'} size={22} color={checked ? colors.orange : colors.muted} />
                  </Pressable>
                );
              })
            ) : (
              <AppText variant="caption" color={colors.muted}>Create a group first, or choose another mode.</AppText>
            )}
          </View>
        ) : null}
        <Button label="Save privacy" loading={privacy.visibility.isPending} onPress={savePrivacy} />
      </View>

      <View style={styles.section}>
        <SectionHeading title="Notifications & stats" />
        {notifications.isError ? (
          <ErrorState
            title="Notification settings unavailable"
            onRetry={() => void notifications.refetch()}
          />
        ) : (
        <View style={styles.setting}>
          <View style={styles.optionCopy}>
            <AppText variant="label">Sock-up notifications</AppText>
            <AppText variant="caption" color={colors.muted}>Generic lock-screen copy, never historical details.</AppText>
          </View>
          <Switch
            value={notifications.data?.sock_up_enabled ?? true}
            onValueChange={(value) =>
              void privacy.notifications.mutateAsync(value).catch((error) =>
                Alert.alert('Preference not saved', friendlyError(error)),
              )
            }
            trackColor={{ false: colors.line, true: colors.orange }}
            thumbColor={colors.white}
          />
        </View>
        )}
        <View style={styles.setting}>
          <View style={styles.optionCopy}>
            <AppText variant="label">Appear in group Wrapped</AppText>
            <AppText variant="caption" color={colors.muted}>Opt out without changing your personal stats.</AppText>
          </View>
          <Switch
            value={profile.data?.group_stats_opt_in ?? true}
            onValueChange={(value) =>
              void profileMutation
                .mutateAsync({ group_stats_opt_in: value })
                .catch((error) => Alert.alert('Preference not saved', friendlyError(error)))
            }
            trackColor={{ false: colors.line, true: colors.orange }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      {pushWarning ? (
        <AppText variant="caption" color={colors.muted} style={styles.notice}>
          {pushWarning}
        </AppText>
      ) : null}

      <View style={styles.section}>
        <SectionHeading title="Account" />
        <AppText variant="caption" color={colors.muted}>
          Send a 10-minute verification code before changing your password.
        </AppText>
        <Button
          label="Reset password"
          tone="secondary"
          onPress={() =>
            router.push({
              pathname: '/reset-password',
              params: { email: user?.email ?? '', from: 'settings' },
            })
          }
        />
        <Link href={'/terms' as Href} accessibilityRole="link" style={styles.legalLink}>Terms of Service</Link>
        <Link href={'/privacy' as Href} accessibilityRole="link" style={styles.legalLink}>Privacy Policy</Link>
        <Button label="Delete account" tone="danger" onPress={confirmDeleteAccount} />
      </View>

      <Button
        label="Log out"
        tone="danger"
        onPress={() =>
          void signOut().catch((error) => Alert.alert('Couldn’t log out', friendlyError(error)))
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatarBlock: { position: 'relative' },
  camera: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
    borderWidth: 3,
    borderColor: colors.cream,
  },
  headerCopy: { flex: 1, gap: spacing.xs },
  section: { gap: spacing.lg },
  sectionNote: { marginTop: spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  optionSelected: { opacity: 1 },
  optionIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  optionIconSelected: { backgroundColor: colors.ink },
  optionCopy: { flex: 1, gap: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.line },
  radioSelected: { borderWidth: 6, borderColor: colors.orange },
  groupPicker: { backgroundColor: colors.paper, padding: spacing.lg, borderRadius: radius.md, gap: spacing.sm },
  groupRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  setting: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  notice: { textAlign: 'center', paddingHorizontal: spacing.lg },
  legalLink: { color: colors.orangeDark, textDecorationLine: 'underline' },
});
