import { relationshipKind } from '@/features/friends/model';
import type { Friendship } from '@/types/domain';

const base: Friendship = {
  id: 'friendship',
  requester_id: 'alice',
  addressee_id: 'bob',
  user_low: 'alice',
  user_high: 'bob',
  status: 'pending',
  responded_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('relationshipKind', () => {
  it('classifies incoming and outgoing requests from the current user perspective', () => {
    expect(relationshipKind(base, 'bob')).toBe('incoming');
    expect(relationshipKind(base, 'alice')).toBe('outgoing');
  });

  it('classifies accepted relationships as friends for either participant', () => {
    expect(relationshipKind({ ...base, status: 'accepted' }, 'alice')).toBe('friend');
    expect(relationshipKind({ ...base, status: 'accepted' }, 'bob')).toBe('friend');
  });
});
