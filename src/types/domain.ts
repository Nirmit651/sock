import type { Tables } from '@/types/database';

export type Profile = Tables<'profiles'>;
export type Friendship = Tables<'friendships'>;
export type Group = Tables<'groups'>;
export type GroupMember = Tables<'group_members'>;
export type SockSession = Tables<'sock_sessions'>;
export type ActiveProfile = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_path'>;

export type FriendItem = {
  friendship: Friendship;
  profile: Profile;
  kind: 'friend' | 'incoming' | 'outgoing';
};

export type GroupSummary = Group & {
  activeCount: number;
  memberCount: number;
  role: GroupMember['role'];
};

export type GroupMemberWithProfile = GroupMember & { profile: Profile };

export type SockWrapped = {
  session_count: number;
  total_seconds: number;
  average_seconds: number;
  longest_seconds: number;
  favorite_weekday: string;
  favorite_time_range: string;
  most_active_month: string;
  current_streak: number;
};

export type GroupWrapped = {
  group_total_sessions: number;
  group_total_seconds: number;
  member_rankings: {
    user_id: string;
    username: string;
    display_name: string | null;
    session_count: number;
    total_seconds: number;
  }[];
};
