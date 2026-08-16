import type { ImagePickerAsset } from 'expo-image-picker';

import { relationshipKind } from '@/features/friends/model';
import { externalServicesEnabled } from '@/lib/runtime';
import { supabase } from '@/lib/supabase';
import type {
  ActiveProfile,
  FriendItem,
  GroupMemberWithProfile,
  GroupSummary,
  GroupWrapped,
  Profile,
  SockSession,
  SockWrapped,
} from '@/types/domain';
import type { Database } from '@/types/database';

type VisibilityMode = Database['public']['Enums']['sock_visibility_mode'];
type NotificationEvent = 'sock_up' | 'sock_down';

function assertNoError(error: { message: string } | null) {
  if (error) throw error;
}

function invokePushNotification(sessionId: string, event: NotificationEvent) {
  if (externalServicesEnabled) {
    void supabase.functions
      .invoke('push-sock-notification', { body: { sessionId, event } })
      .catch(() => undefined);
  }
}

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  assertNoError(error);
  return data as Profile;
}

export async function updateProfile(
  userId: string,
  patch: Pick<Partial<Profile>, 'username' | 'display_name' | 'group_stats_opt_in' | 'avatar_path'>,
) {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select()
    .single();
  assertNoError(error);
  if (!data) throw new Error('Profile was not returned.');
  return data;
}

export async function uploadAvatar(userId: string, asset: ImagePickerAsset, previousPath?: string | null) {
  const mimeType = asset.mimeType ?? 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
    throw new Error('Choose an image smaller than 5 MB.');
  }
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const response = await fetch(asset.uri);
  const body = await response.arrayBuffer();
  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, body, {
    contentType: mimeType,
    cacheControl: '3600',
    upsert: false,
  });
  assertNoError(uploadError);
  try {
    await updateProfile(userId, { avatar_path: path });
  } catch (error) {
    await supabase.storage.from('avatars').remove([path]);
    throw error;
  }
  if (previousPath) await supabase.storage.from('avatars').remove([previousPath]);
  return path;
}

export async function fetchActiveSession(userId: string) {
  const { data, error } = await supabase
    .from('sock_sessions')
    .select('*')
    .eq('user_id', userId)
    .is('ended_at', null)
    .maybeSingle();
  assertNoError(error);
  return data as SockSession | null;
}

export async function startSockSession(userId: string) {
  const { data, error } = await supabase
    .from('sock_sessions')
    .insert({ user_id: userId })
    .select()
    .single();
  assertNoError(error);
  if (!data) throw new Error('Sock session was not returned.');
  const session = data as SockSession;
  invokePushNotification(session.id, 'sock_up');
  return session;
}

export async function endSockSession(userId: string, sessionId: string) {
  const { data, error } = await supabase
    .from('sock_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('user_id', userId)
    .is('ended_at', null)
    .select()
    .single();
  assertNoError(error);
  if (!data) throw new Error('Sock session was not ended.');
  invokePushNotification(sessionId, 'sock_down');
  return data as SockSession;
}

export async function fetchActiveFriends() {
  const { data, error } = await supabase.rpc('get_visible_active_profiles');
  assertNoError(error);
  return (data ?? []) as ActiveProfile[];
}

export async function fetchFriendships(userId: string) {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  assertNoError(error);
  const relationships = data ?? [];
  const ids = relationships.map((row) =>
    row.requester_id === userId ? row.addressee_id : row.requester_id,
  );
  if (!ids.length) return [] as FriendItem[];
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', ids);
  assertNoError(profilesError);
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return relationships.flatMap((friendship) => {
    const otherId =
      friendship.requester_id === userId ? friendship.addressee_id : friendship.requester_id;
    const profile = profileMap.get(otherId);
    if (!profile) return [];
    const kind = relationshipKind(friendship, userId);
    return [{ friendship, profile, kind } satisfies FriendItem];
  });
}

export async function searchProfiles(searchTerm: string) {
  const { data, error } = await supabase.rpc('search_profiles', { search_term: searchTerm });
  assertNoError(error);
  return (data ?? []) as Profile[];
}

export async function sendFriendRequest(addresseeId: string) {
  const { error } = await supabase.rpc('send_friend_request', { target_user_id: addresseeId });
  assertNoError(error);
}

export async function acceptFriendRequest(id: string) {
  const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id);
  assertNoError(error);
}

export async function deleteFriendship(id: string) {
  const { error } = await supabase.from('friendships').delete().eq('id', id);
  assertNoError(error);
}

export async function fetchGroups() {
  const { data: groups, error } = await supabase.rpc('get_my_group_summaries');
  assertNoError(error);
  return (groups ?? []).map(
    ({ member_count, active_count, ...group }) =>
      ({
        ...group,
        memberCount: Number(member_count),
        activeCount: Number(active_count),
      }) satisfies GroupSummary,
  );
}

export async function createGroup(userId: string, name: string) {
  const { data, error } = await supabase
    .from('groups')
    .insert({ owner_id: userId, name: name.trim() })
    .select()
    .single();
  assertNoError(error);
  if (!data) throw new Error('Group was not returned.');
  return data;
}

export async function fetchGroup(groupId: string) {
  const [{ data: group, error }, { data: members, error: membersError }] = await Promise.all([
    supabase.from('groups').select('*').eq('id', groupId).single(),
    supabase.from('group_members').select('*').eq('group_id', groupId).order('joined_at'),
  ]);
  assertNoError(error);
  assertNoError(membersError);
  if (!group) throw new Error('Group was not found.');
  const ids = (members ?? []).map((member) => member.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', ids);
  assertNoError(profilesError);
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const hydrated = (members ?? []).flatMap((member) => {
    const profile = profileMap.get(member.user_id);
    return profile ? [{ ...member, profile } satisfies GroupMemberWithProfile] : [];
  });
  return { group, members: hydrated };
}

export async function addGroupMember(groupId: string, userId: string, addedBy: string) {
  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: userId, added_by: addedBy, role: 'member' });
  assertNoError(error);
}

export async function removeGroupMember(groupId: string, userId: string) {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  assertNoError(error);
}

export async function updateGroupMemberRole(
  groupId: string,
  userId: string,
  role: 'admin' | 'member',
) {
  const { error } = await supabase
    .from('group_members')
    .update({ role })
    .eq('group_id', groupId)
    .eq('user_id', userId);
  assertNoError(error);
}

export async function deleteGroup(groupId: string) {
  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  assertNoError(error);
}

export async function fetchVisibility(userId: string) {
  const [{ data: setting, error }, { data: selected, error: selectedError }] = await Promise.all([
    supabase.from('sock_visibility_settings').select('*').eq('user_id', userId).single(),
    supabase.from('sock_visibility_groups').select('group_id').eq('user_id', userId),
  ]);
  assertNoError(error);
  assertNoError(selectedError);
  if (!setting) throw new Error('Visibility settings were not found.');
  return { mode: setting.mode, groupIds: (selected ?? []).map((row) => row.group_id) };
}

export async function updateVisibility(mode: VisibilityMode, groupIds: string[]) {
  const { error } = await supabase.rpc('set_sock_visibility', {
    visibility_mode: mode,
    group_ids: groupIds,
  });
  assertNoError(error);
}

export async function fetchNotificationPreferences(userId: string) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();
  assertNoError(error);
  if (!data) throw new Error('Notification preferences were not returned.');
  return data;
}

export async function updateNotificationPreference(userId: string, enabled: boolean) {
  const { error } = await supabase
    .from('notification_preferences')
    .update({ sock_up_enabled: enabled })
    .eq('user_id', userId);
  assertNoError(error);
}

export async function fetchWrapped() {
  const { data, error } = await supabase.rpc('get_my_sock_wrapped');
  assertNoError(error);
  return data as unknown as SockWrapped;
}

export async function fetchGroupWrapped(groupId: string) {
  const { data, error } = await supabase.rpc('get_group_sock_wrapped', { group_id: groupId });
  assertNoError(error);
  return data as unknown as GroupWrapped;
}
