import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  acceptFriendRequest,
  addGroupMember,
  createGroup,
  deleteFriendship,
  deleteGroup,
  endSockSession,
  fetchActiveFriends,
  fetchActiveSession,
  fetchFriendships,
  fetchGroup,
  fetchGroups,
  fetchGroupWrapped,
  fetchNotificationPreferences,
  fetchProfile,
  fetchVisibility,
  fetchWrapped,
  removeGroupMember,
  sendFriendRequest,
  startSockSession,
  updateGroupMemberRole,
  updateNotificationPreference,
  updateProfile,
  updateVisibility,
} from '@/services/api';
import type { Profile } from '@/types/domain';
import type { Database } from '@/types/database';

export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  activeSession: (userId: string) => ['active-session', userId] as const,
  activeFriends: (userId: string) => ['active-friends', userId] as const,
  friends: (userId: string) => ['friends', userId] as const,
  groups: (userId: string) => ['groups', userId] as const,
  group: (userId: string, groupId: string) => ['group', userId, groupId] as const,
  visibility: (userId: string) => ['visibility', userId] as const,
  notifications: (userId: string) => ['notifications', userId] as const,
  wrapped: (userId: string) => ['wrapped', userId] as const,
  groupWrapped: (userId: string, groupId: string) =>
    ['group-wrapped', userId, groupId] as const,
};

export const useProfile = (userId?: string) =>
  useQuery({
    queryKey: queryKeys.profile(userId ?? 'none'),
    queryFn: () => fetchProfile(userId!),
    enabled: Boolean(userId),
  });

export const useActiveSession = (userId?: string) =>
  useQuery({
    queryKey: queryKeys.activeSession(userId ?? 'none'),
    queryFn: () => fetchActiveSession(userId!),
    enabled: Boolean(userId),
  });

export const useActiveFriends = (userId?: string) =>
  useQuery({
    queryKey: queryKeys.activeFriends(userId ?? 'none'),
    queryFn: fetchActiveFriends,
    enabled: Boolean(userId),
  });

export const useFriendships = (userId?: string) =>
  useQuery({
    queryKey: queryKeys.friends(userId ?? 'none'),
    queryFn: () => fetchFriendships(userId!),
    enabled: Boolean(userId),
  });

export const useGroups = (userId?: string) =>
  useQuery({
    queryKey: queryKeys.groups(userId ?? 'none'),
    queryFn: fetchGroups,
    enabled: Boolean(userId),
  });

export const useGroup = (userId?: string, groupId?: string) =>
  useQuery({
    queryKey: queryKeys.group(userId ?? 'none', groupId ?? 'none'),
    queryFn: () => fetchGroup(groupId!),
    enabled: Boolean(userId && groupId),
  });

export const useVisibility = (userId?: string) =>
  useQuery({
    queryKey: queryKeys.visibility(userId ?? 'none'),
    queryFn: () => fetchVisibility(userId!),
    enabled: Boolean(userId),
  });

export const useNotificationPreferences = (userId?: string) =>
  useQuery({
    queryKey: queryKeys.notifications(userId ?? 'none'),
    queryFn: () => fetchNotificationPreferences(userId!),
    enabled: Boolean(userId),
  });

export const useWrapped = (userId?: string) =>
  useQuery({
    queryKey: queryKeys.wrapped(userId ?? 'none'),
    queryFn: fetchWrapped,
    enabled: Boolean(userId),
  });

export const useGroupWrapped = (userId?: string, groupId?: string) =>
  useQuery({
    queryKey: queryKeys.groupWrapped(userId ?? 'none', groupId ?? 'none'),
    queryFn: () => fetchGroupWrapped(groupId!),
    enabled: Boolean(userId && groupId),
  });

export function useSockMutation(userId: string, activeSessionId?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      activeSessionId ? endSockSession(userId, activeSessionId) : startSockSession(userId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.activeSession(userId) });
      void client.invalidateQueries({ queryKey: queryKeys.wrapped(userId) });
    },
  });
}

export function useFriendMutations(userId: string) {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: queryKeys.friends(userId) });
  return {
    send: useMutation({ mutationFn: (addresseeId: string) => sendFriendRequest(addresseeId), onSuccess: refresh }),
    accept: useMutation({ mutationFn: acceptFriendRequest, onSuccess: refresh }),
    remove: useMutation({ mutationFn: deleteFriendship, onSuccess: refresh }),
  };
}

export function useGroupMutations(userId: string, groupId?: string) {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: queryKeys.groups(userId) });
    if (groupId) {
      void client.invalidateQueries({ queryKey: queryKeys.group(userId, groupId) });
      void client.invalidateQueries({ queryKey: queryKeys.groupWrapped(userId, groupId) });
    }
  };
  return {
    create: useMutation({ mutationFn: (name: string) => createGroup(userId, name), onSuccess: refresh }),
    add: useMutation({ mutationFn: (memberId: string) => addGroupMember(groupId!, memberId, userId), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (memberId: string) => removeGroupMember(groupId!, memberId), onSuccess: refresh }),
    role: useMutation({
      mutationFn: ({ memberId, role }: { memberId: string; role: 'admin' | 'member' }) =>
        updateGroupMemberRole(groupId!, memberId, role),
      onSuccess: refresh,
    }),
    delete: useMutation({ mutationFn: () => deleteGroup(groupId!), onSuccess: refresh }),
  };
}

export function useProfileMutation(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: Pick<Partial<Profile>, 'username' | 'display_name' | 'group_stats_opt_in' | 'avatar_path'>) =>
      updateProfile(userId, patch),
    onSuccess: (profile) => client.setQueryData(queryKeys.profile(userId), profile),
  });
}

export function usePrivacyMutations(userId: string) {
  const client = useQueryClient();
  return {
    visibility: useMutation({
      mutationFn: ({
        mode,
        groupIds,
      }: {
        mode: Database['public']['Enums']['sock_visibility_mode'];
        groupIds: string[];
      }) => updateVisibility(mode, groupIds),
      onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.visibility(userId) }),
    }),
    notifications: useMutation({
      mutationFn: (enabled: boolean) => updateNotificationPreference(userId, enabled),
      onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.notifications(userId) }),
    }),
  };
}
