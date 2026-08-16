import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { SectionHeading } from '@/components/ui/section-heading';
import { TextField } from '@/components/ui/text-field';
import { useFriendMutations, useFriendships } from '@/hooks/use-data';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { searchProfiles } from '@/services/api';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Profile } from '@/types/domain';

function Action({ label, tone = 'ink', onPress }: { label: string; tone?: 'ink' | 'orange'; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.action, tone === 'orange' && styles.actionOrange, pressed && styles.pressed]}
    >
      <AppText variant="caption" color={tone === 'orange' ? colors.cream : colors.ink}>
        {label}
      </AppText>
    </Pressable>
  );
}

export default function FriendsScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const friendships = useFriendships(userId);
  const mutations = useFriendMutations(userId);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRequest = useRef(0);

  const incoming = friendships.data?.filter((item) => item.kind === 'incoming') ?? [];
  const outgoing = friendships.data?.filter((item) => item.kind === 'outgoing') ?? [];
  const friends = friendships.data?.filter((item) => item.kind === 'friend') ?? [];
  const relationshipIds = new Set(friendships.data?.map((item) => item.profile.id));
  const visibleResults = term.trim().length >= 3 ? results : [];

  const search = useCallback(async (value: string, showValidation = false) => {
    const normalized = value.trim().toLowerCase();
    if (normalized.length < 3) {
      setResults([]);
      if (showValidation) Alert.alert('A little more, please', 'Type at least 3 characters.');
      return;
    }
    const requestId = ++searchRequest.current;
    setSearching(true);
    try {
      const nextResults = await searchProfiles(normalized);
      if (requestId === searchRequest.current) setResults(nextResults);
    } catch (error) {
      if (requestId === searchRequest.current) Alert.alert('Search failed', friendlyError(error));
    } finally {
      if (requestId === searchRequest.current) setSearching(false);
    }
  }, []);

  useEffect(() => {
    const normalized = term.trim();
    if (normalized.length < 3) {
      return;
    }
    const timer = setTimeout(() => void search(normalized), 350);
    return () => clearTimeout(timer);
  }, [search, term]);

  const handle = async (work: () => Promise<unknown>, title: string) => {
    try {
      await work();
    } catch (error) {
      Alert.alert(title, friendlyError(error));
    }
  };

  if (friendships.isError) {
    return (
      <Screen>
        <View style={styles.header}>
          <AppText variant="title">Friends</AppText>
          <AppText color={colors.muted}>The people who get the signal.</AppText>
        </View>
        <ErrorState title="Friends unavailable" onRetry={() => void friendships.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={friendships.isRefetching} onRefresh={() => void friendships.refetch()}>
      <View style={styles.header}>
        <AppText variant="title">Friends</AppText>
        <AppText color={colors.muted}>The people who get the signal.</AppText>
      </View>

      <View style={styles.search}>
        <TextField
          label="Find by username"
          value={term}
          onChangeText={setTerm}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => void search(term, true)}
          placeholder="start typing a username"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search usernames"
          onPress={() => void search(term, true)}
          disabled={searching}
          style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}
        >
          <Feather name="search" size={20} color={colors.cream} />
          <AppText variant="label" color={colors.cream}>
            {searching ? 'Looking…' : 'Search'}
          </AppText>
        </Pressable>
      </View>
      <AppText color={colors.muted}>Results prioritize exact matches, then usernames and names.</AppText>

      {visibleResults.length ? (
        <View style={styles.section}>
          <SectionHeading title="Search results" />
          {visibleResults.map((profile) => (
            <ListRow
              key={profile.id}
              title={profile.display_name || `@${profile.username}`}
              subtitle={`@${profile.username}`}
              username={profile.username}
              avatarPath={profile.avatar_path}
              accessory={
                relationshipIds.has(profile.id) ? (
                  <AppText variant="caption" color={colors.muted}>Already connected</AppText>
                ) : (
                  <Action
                    label="Add"
                    tone="orange"
                    onPress={() =>
                      void handle(() => mutations.send.mutateAsync(profile.id), 'Request not sent')
                    }
                  />
                )
              }
            />
          ))}
        </View>
      ) : null}

      {incoming.length ? (
        <View style={styles.section}>
          <SectionHeading title={`Requests · ${incoming.length}`} />
          {incoming.map((item) => (
            <ListRow
              key={item.friendship.id}
              title={item.profile.display_name || `@${item.profile.username}`}
              subtitle={`@${item.profile.username} wants in`}
              username={item.profile.username}
              avatarPath={item.profile.avatar_path}
              accessory={
                <View style={styles.actions}>
                  <Action
                    label="Decline"
                    onPress={() =>
                      void handle(() => mutations.remove.mutateAsync(item.friendship.id), 'Couldn’t decline')
                    }
                  />
                  <Action
                    label="Accept"
                    tone="orange"
                    onPress={() =>
                      void handle(() => mutations.accept.mutateAsync(item.friendship.id), 'Couldn’t accept')
                    }
                  />
                </View>
              }
            />
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeading title={`Your people · ${friends.length}`} />
        {friends.length ? (
          friends.map((item) => (
            <ListRow
              key={item.friendship.id}
              title={item.profile.display_name || `@${item.profile.username}`}
              subtitle={`@${item.profile.username}`}
              username={item.profile.username}
              avatarPath={item.profile.avatar_path}
              accessory={
                <Action
                  label="Remove"
                  onPress={() =>
                    Alert.alert('Remove friend?', `Remove @${item.profile.username} from your friends?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () =>
                          void handle(() => mutations.remove.mutateAsync(item.friendship.id), 'Couldn’t remove'),
                      },
                    ])
                  }
                />
              }
            />
          ))
        ) : (
          <EmptyState title="Fresh laundry" body="Search for a username and send your first friend request." />
        )}
      </View>

      {outgoing.length ? (
        <View style={styles.section}>
          <SectionHeading title="Pending" />
          {outgoing.map((item) => (
            <ListRow
              key={item.friendship.id}
              title={item.profile.display_name || `@${item.profile.username}`}
              subtitle="Waiting on them"
              username={item.profile.username}
              avatarPath={item.profile.avatar_path}
              accessory={
                <Action
                  label="Cancel"
                  onPress={() =>
                    void handle(() => mutations.remove.mutateAsync(item.friendship.id), 'Couldn’t cancel')
                  }
                />
              }
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  search: { gap: spacing.md },
  searchButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
  },
  section: { gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: radius.pill, backgroundColor: colors.paper },
  actionOrange: { backgroundColor: colors.orange },
  pressed: { opacity: 0.65 },
});
