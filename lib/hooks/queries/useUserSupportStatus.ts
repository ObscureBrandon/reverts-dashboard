import { useQuery } from '@tanstack/react-query';

type SupportState = 'active' | 'pending' | 'resolved' | 'none' | 'archived';

interface SupportStatusResponse {
  state: SupportState;
  data: {
    id: number;
    active: boolean;
    assignedAt: string | null;
    createdAt: string;
    channelId: string;
    assignedById: string | null;
  } | null;
}

export function useUserSupportStatus(
  userId: string | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['userSupportStatus', userId],
    queryFn: async (): Promise<SupportStatusResponse> => {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const res = await fetch(`/api/users/${userId}/support`);

      if (!res.ok) {
        throw new Error('Failed to fetch support status');
      }

      const json = await res.json();

      return json;
    },
    enabled: options?.enabled !== false && !!userId,
    staleTime: 30 * 1000, // support status can change quickly
  });
}
