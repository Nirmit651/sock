import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { SectionHeading } from '@/components/ui/section-heading';
import {
  useFriendships,
  useGroup,
  useGroupMutations,
  useGroupWrapped,
} from '@/hooks/use-data';
import { friendlyError } from '@/lib/errors';
import { formatDuration } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';
import { colors, radius, spacing } from '@/theme/tokens';

export default function GroupDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user, loading } = useAuth();
  const userId = user?.id ?? '';
  const authorizedGroupId = user ? groupId : undefined;
  const detail = useGroup(userId, authorizedGroupId);
  const friends = useFriendships(userId);
  const wrapped = useGroupWrapped(userId, authorizedGroupId);
  const mutations = useGroupMutations(userId, authorizedGroupId);

  const myMembership = detail.data?.members.find((member) => member.user_id === userId);
  const canManage = myMembership?.role === 'owner' || myMembership?.role === 'admin';
  const memberIds = useMemo(
    () => new Set(detail.data?.members.map((member) => member.user_id) ?? []),
    [detail.data?.members],
  );
  const addable =
    friends.data?.filter((item) => item.kind === 'friend' && !memberIds.has(item.profile.id)) ?? [];

  const run = async (work: () => Promise<unknown>, title: string) => {
    try {
      await work();
    } catch (error) {
      Alert.alert(title, friendlyError(error));
    }
  };

  const leaveOrDelete = () => {
    const isOwner = myMembership?.role === 'owner';
    Alert.alert(
      isOwner ? 'Delete this group?' : 'Leave this group?',
      isOwner
        ? 'Owners can’t leave without an ownership transfer, so this removes the group for everyone.'
        : 'You’ll stop seeing this group and its activity.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isOwner ? 'Delete group' : 'Leave',
          style: 'destructive',
          onPress: () =>
            void run(
              async () => {
                if (isOwner) await mutations.delete.mutateAsync();
                else await mutations.remove.mutateAsync(userId);
                router.back();
              },
              isOwner ? 'Group not deleted' : 'Couldn’t leave',
            ),
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.orange} />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;

  if (detail.isError) {
    return (
      <Screen>
        <ErrorState title="Group unavailable" onRetry={() => void detail.refetch()} />
      </Screen>
    );
  }

  if (!detail.data && !detail.isLoading) {
    return (
      <Screen>
        <EmptyState title="Group unavailable" body="It may have been removed, or you’re no longer a member." />
      </Screen>
    );
  }

  return (
    <Screen
      refreshing={detail.isRefetching || wrapped.isRefetching}
      onRefresh={() => void Promise.all([detail.refetch(), wrapped.refetch()])}
    >
      <View style={styles.hero}>
        <AppText variant="caption" color={colors.orange}>YOUR GROUP</AppText>
        <AppText variant="display">{detail.data?.group.name ?? 'Group'}</AppText>
        <AppText color={colors.muted}>{detail.data?.members.length ?? 0} people have a key.</AppText>
      </View>

      {wrapped.isError ? (
        <ErrorState title="Group Wrapped unavailable" onRetry={() => void wrapped.refetch()} />
      ) : (
      <View style={styles.statStrip}>
        <View style={styles.stat}>
          <AppText variant="title">{wrapped.data?.group_total_sessions ?? 0}</AppText>
          <AppText variant="caption" color={colors.muted}>GROUP SESSIONS</AppText>
        </View>
        <View style={styles.stat}>
          <AppText variant="title">{formatDuration(wrapped.data?.group_total_seconds ?? 0)}</AppText>
          <AppText variant="caption" color={colors.muted}>TOTAL TIME</AppText>
        </View>
      </View>
      )}

      <View style={styles.section}>
        <SectionHeading title="Members" />
        {detail.data?.members.map((member) => (
          <ListRow
            key={member.user_id}
            title={member.profile.display_name || `@${member.profile.username}`}
            subtitle={`@${member.profile.username} · ${member.role}`}
            username={member.profile.username}
            avatarPath={member.profile.avatar_path}
            accessory={
              canManage && member.role !== 'owner' && member.user_id !== userId ? (
                <View style={styles.rowActions}>
                  {myMembership?.role === 'owner' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={member.role === 'admin' ? `Demote ${member.profile.username}` : `Make ${member.profile.username} an admin`}
                      onPress={() =>
                        void run(
                          () =>
                            mutations.role.mutateAsync({
                              memberId: member.user_id,
                              role: member.role === 'admin' ? 'member' : 'admin',
                            }),
                          'Role not changed',
                        )
                      }
                    >
                      <AppText variant="caption" color={colors.orangeDark}>
                        {member.role === 'admin' ? 'Demote' : 'Make admin'}
                      </AppText>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${member.profile.username} from group`}
                    onPress={() =>
                      void run(() => mutations.remove.mutateAsync(member.user_id), 'Member not removed')
                    }
                  >
                    <AppText variant="caption" color={colors.danger}>Remove</AppText>
                  </Pressable>
                </View>
              ) : undefined
            }
          />
        ))}
      </View>

      {canManage && friends.isError ? (
        <ErrorState title="Friends unavailable" onRetry={() => void friends.refetch()} />
      ) : canManage && addable.length ? (
        <View style={styles.section}>
          <SectionHeading title="Add friends" />
          {addable.map((item) => (
            <ListRow
              key={item.profile.id}
              title={item.profile.display_name || `@${item.profile.username}`}
              subtitle={`@${item.profile.username}`}
              username={item.profile.username}
              avatarPath={item.profile.avatar_path}
              accessory={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${item.profile.username} to group`}
                  style={styles.addPill}
                  onPress={() =>
                    void run(() => mutations.add.mutateAsync(item.profile.id), 'Friend not added')
                  }
                >
                  <AppText variant="caption" color={colors.cream}>Add</AppText>
                </Pressable>
              }
            />
          ))}
        </View>
      ) : null}

      {wrapped.data?.member_rankings.length ? (
        <View style={styles.section}>
          <SectionHeading title="Wrapped leaderboard" />
          {wrapped.data.member_rankings.map((ranking, index) => (
            <View key={ranking.user_id} style={styles.ranking}>
              <AppText variant="heading" color={index === 0 ? colors.orange : colors.ink}>
                {String(index + 1).padStart(2, '0')}
              </AppText>
              <View style={styles.rankCopy}>
                <AppText variant="label">{ranking.display_name || `@${ranking.username}`}</AppText>
                <AppText variant="caption" color={colors.muted}>
                  {ranking.session_count} sessions · {formatDuration(ranking.total_seconds)}
                </AppText>
              </View>
            </View>
          ))}
          <AppText variant="caption" color={colors.muted}>
            Only opted-in members appear. Raw session history never leaves its owner.
          </AppText>
        </View>
      ) : null}

      <Button
        label={myMembership?.role === 'owner' ? 'Delete group' : 'Leave group'}
        tone="danger"
        onPress={leaveOrDelete}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  hero: { gap: spacing.sm, paddingTop: spacing.lg },
  statStrip: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, gap: spacing.xs, paddingVertical: spacing.lg, borderTopWidth: 2, borderTopColor: colors.ink },
  section: { gap: spacing.md },
  rowActions: { alignItems: 'flex-end', gap: spacing.sm },
  addPill: { backgroundColor: colors.orange, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14 },
  ranking: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rankCopy: { flex: 1, gap: spacing.xs },
});
