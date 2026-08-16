import { useQuery } from '@tanstack/react-query';

import { registerPushToken } from '@/lib/notifications';

export function useNotificationRegistration(userId?: string) {
  const registration = useQuery({
    queryKey: ['notification-registration', userId ?? 'none'],
    queryFn: () => registerPushToken(userId!),
    enabled: Boolean(userId),
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });

  if (registration.isError) return 'Push registration will retry next launch.';
  if (registration.data?.status === 'denied') {
    return 'Push notifications are off in system settings.';
  }
  if (registration.data?.status === 'missing-project-id') {
    return 'Push is ready after this app is linked to an EAS project.';
  }
  return null;
}
