import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { queryKeys } from '@/hooks/use-data';
import { supabase } from '@/lib/supabase';

export function useSockRealtime(userId?: string) {
  const client = useQueryClient();
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`sock-feed:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sock_feed_invalidations',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void client.invalidateQueries({ queryKey: queryKeys.activeFriends(userId) });
          void client.invalidateQueries({ queryKey: queryKeys.activeSession(userId) });
          void client.invalidateQueries({ queryKey: queryKeys.groups(userId) });
          void client.invalidateQueries({ queryKey: queryKeys.friends(userId) });
          void client.invalidateQueries({ queryKey: ['group', userId] });
          void client.invalidateQueries({ queryKey: ['group-wrapped', userId] });
        },
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [client, userId]);

  return connected;
}
