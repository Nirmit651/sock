import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { SockHero } from '@/components/sock-hero';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FadeIn } from '@/components/ui/fade-in';
import { ListRow } from '@/components/ui/list-row';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { Screen } from '@/components/ui/screen';
import { SectionHeading } from '@/components/ui/section-heading';
import {
  useActiveFriends,
  useActiveSession,
  useGroups,
  useProfile,
  useSockMutation,
} from '@/hooks/use-data';
import { useSockRealtime } from '@/hooks/use-sock-realtime';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { colors, radius, spacing } from '@/theme/tokens';

export default function HomeScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const profile = useProfile(userId);
  const activeSession = useActiveSession(userId);
  const activeFriends = useActiveFriends(userId);
  const groups = useGroups(userId);
  const connected = useSockRealtime(userId);
  const toggle = useSockMutation(userId, activeSession.data?.id);
  const refreshing = [profile, activeSession, activeFriends, groups].some((query) => query.isRefetching);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 18) return 'Hey';
    return 'Evening';
  })();

  const refresh = () => {
    void Promise.all([profile.refetch(), activeSession.refetch(), activeFriends.refetch(), groups.refetch()]);
  };

  const handleToggle = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await toggle.mutateAsync();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert(
        activeSession.data ? 'Sock stayed up' : 'Sock stayed down',
        friendlyError(error, 'The session could not be saved. Nothing changed.'),
      );
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.header}>
        <View>
          <AppText variant="caption" color={colors.muted}>
            {greeting}, {profile.data?.display_name || `@${profile.data?.username ?? 'friend'}`}
          </AppText>
          <AppText variant="title">Sock</AppText>
        </View>
        {profile.data ? (
          <ProfileAvatar
            username={profile.data.username}
            avatarPath={profile.data.avatar_path}
            size={48}
          />
        ) : null}
      </View>

      {!connected ? (
        <View style={styles.offline}>
          <AppText variant="caption" color={colors.danger}>
            Live updates are reconnecting. Pull to refresh if needed.
          </AppText>
        </View>
      ) : null}

      <FadeIn>
        {activeSession.isError ? (
          <ErrorState
            title="Sock status unavailable"
            body="Nothing changed. Reload your status before using the control."
            onRetry={() => void activeSession.refetch()}
          />
        ) : (
          <SockHero
            isActive={Boolean(activeSession.data)}
            busy={toggle.isPending || activeSession.isLoading}
            onToggle={handleToggle}
          />
        )}
      </FadeIn>

      <FadeIn delay={100}>
        <View style={styles.section}>
          <SectionHeading
            title="Socks up now"
            action="Friends"
            onAction={() => router.push('/(tabs)/friends')}
          />
          {activeFriends.isError ? (
            <ErrorState title="Live friends unavailable" onRetry={() => void activeFriends.refetch()} />
          ) : activeFriends.data?.length ? (
            <View style={styles.avatarRail}>
              {activeFriends.data.map((friend) => (
                <View key={friend.id} style={styles.person}>
                  <View style={styles.avatarWrap}>
                    <ProfileAvatar
                      username={friend.username}
                      avatarPath={friend.avatar_path}
                      size={58}
                    />
                    <View style={styles.activeDot} />
                  </View>
                  <AppText variant="caption" numberOfLines={1} style={styles.personName}>
                    {friend.display_name?.split(' ')[0] || friend.username}
                  </AppText>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              title="Hallway’s quiet"
              body="When an allowed friend puts a sock up, they’ll appear here live."
              emoji="🌙"
            />
          )}
        </View>
      </FadeIn>

      <FadeIn delay={180}>
        <View style={styles.section}>
          <SectionHeading
            title="Your groups"
            action="See all"
            onAction={() => router.push('/(tabs)/groups')}
          />
          {groups.isError ? (
            <ErrorState title="Groups unavailable" onRetry={() => void groups.refetch()} />
          ) : groups.data?.length ? (
            <View>
              {groups.data.slice(0, 3).map((group) => (
                <ListRow
                  key={group.id}
                  title={group.name}
                  subtitle={`${group.activeCount} up now · ${group.memberCount} member${group.memberCount === 1 ? '' : 's'} · ${group.role}`}
                  onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              title="No group laundry yet"
              body="Make a group for your apartment, floor, or aggressively close study crew."
              emoji="🏠"
            />
          )}
        </View>
      </FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  offline: { backgroundColor: '#F8DED6', padding: spacing.md, borderRadius: radius.md },
  section: { gap: spacing.lg },
  avatarRail: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  person: { width: 68, alignItems: 'center', gap: spacing.sm },
  avatarWrap: { position: 'relative' },
  activeDot: {
    position: 'absolute',
    right: -1,
    bottom: 1,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.orange,
    borderWidth: 3,
    borderColor: colors.cream,
  },
  personName: { width: 68, textAlign: 'center' },
});
