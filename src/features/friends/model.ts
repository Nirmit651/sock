import type { Friendship } from '@/types/domain';

export function relationshipKind(friendship: Friendship, userId: string) {
  if (friendship.status === 'accepted') return 'friend' as const;
  return friendship.addressee_id === userId ? ('incoming' as const) : ('outgoing' as const);
}
