import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useGroupMutations, useGroups } from '@/hooks/use-data';
import { friendlyError } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';
import { colors, radius, spacing } from '@/theme/tokens';

export default function GroupsScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const groups = useGroups(userId);
  const mutations = useGroupMutations(userId);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const create = async () => {
    if (!name.trim()) return;
    try {
      const group = await mutations.create.mutateAsync(name);
      setName('');
      setCreating(false);
      router.push({ pathname: '/group/[id]', params: { id: group.id } });
    } catch (error) {
      Alert.alert('Group not created', friendlyError(error));
    }
  };

  return (
    <Screen refreshing={groups.isRefetching} onRefresh={() => void groups.refetch()}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <AppText variant="title">Groups</AppText>
          <AppText color={colors.muted}>Apartment, floor, or trusted chaos committee.</AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create group"
          onPress={() => setCreating((value) => !value)}
          style={({ pressed }) => [styles.add, pressed && styles.pressed]}
        >
          <Feather name={creating ? 'x' : 'plus'} size={24} color={colors.cream} />
        </Pressable>
      </View>

      {creating ? (
        <View style={styles.creator}>
          <AppText variant="heading">Name the crew</AppText>
          <TextField
            label="Group name"
            value={name}
            onChangeText={setName}
            maxLength={50}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={create}
            placeholder="Apartment 12"
          />
          <Button label="Create group" loading={mutations.create.isPending} disabled={!name.trim()} onPress={create} />
        </View>
      ) : null}

      {groups.isError ? (
        <ErrorState title="Groups unavailable" onRetry={() => void groups.refetch()} />
      ) : groups.data?.length ? (
        <View>
          {groups.data.map((group) => (
            <ListRow
              key={group.id}
              title={group.name}
              subtitle={`${group.activeCount} up now · ${group.memberCount} member${group.memberCount === 1 ? '' : 's'} · ${group.role}`}
              onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
            />
          ))}
        </View>
      ) : groups.isLoading ? null : (
        <EmptyState
          title="No groups yet"
          body="Create one, then invite friends. Only members can see the group or its aggregated Wrapped stats."
          emoji="🏡"
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  headerCopy: { flex: 1, gap: spacing.sm },
  add: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  creator: { gap: spacing.lg, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.paper },
  pressed: { opacity: 0.7 },
});
