import { useQuery, useQueryClient } from '@tanstack/react-query';

type UserRole = {
  id: string;
  name: string;
  color: number;
  position: number;
};

type UserData = {
  id: string;
  name: string;
  displayName: string | null;
  displayAvatar: string | null;
  roles?: UserRole[];
};

type TicketStatsData = {
  open: number;
  closed: number;
};

type RecentTicket = {
  id: number;
  sequence: number | null;
  status: string | null;
  createdAt: string;
};

/**
 * Fetch user data with roles
 */
export function useUser(userId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user');
      }
      return response.json() as Promise<UserData>;
    },
    enabled: options?.enabled !== false && !!userId,
    staleTime: 2 * 60 * 1000, // User data is fresh for 2 minutes
  });
}

/**
 * Fetch user ticket statistics (open and closed counts)
 */
export function useUserTicketStats(userId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['userTicketStats', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      const [openData, closedData, deletedData] = await Promise.all([
        fetch(`/api/tickets?author=${userId}&status=OPEN&limit=1`).then(res => res.json()),
        fetch(`/api/tickets?author=${userId}&status=CLOSED&limit=1`).then(res => res.json()),
        fetch(`/api/tickets?author=${userId}&status=DELETED&limit=1`).then(res => res.json()),
      ]);
      
      return {
        open: openData.pagination?.total || 0,
        closed: (closedData.pagination?.total || 0) + (deletedData.pagination?.total || 0),
      } as TicketStatsData;
    },
    enabled: options?.enabled !== false && !!userId,
    staleTime: 1 * 60 * 1000, // Ticket stats fresh for 1 minute
  });
}

/**
 * Fetch user's recent tickets
 */
export function useUserRecentTickets(
  userId: string | undefined,
  limit: number = 5,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['userRecentTickets', userId, limit],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      const response = await fetch(`/api/tickets?author=${userId}&limit=${limit}&sortBy=newest`);
      if (!response.ok) {
        throw new Error('Failed to fetch recent tickets');
      }
      const data = await response.json();
      return (data.tickets || []) as RecentTicket[];
    },
    enabled: options?.enabled !== false && !!userId,
    staleTime: 1 * 60 * 1000, // Recent tickets fresh for 1 minute
  });
}

/**
 * Prefetch user data and stats on hover
 * Use this to improve popover performance
 */
export function usePrefetchUser() {
  const queryClient = useQueryClient();

  const prefetchUser = (userId: string, limit: number = 5) => {
    // Prefetch user data
    queryClient.prefetchQuery({
      queryKey: ['user', userId],
      queryFn: async () => {
        const response = await fetch(`/api/users/${userId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }
        return response.json() as Promise<UserData>;
      },
      staleTime: 2 * 60 * 1000,
    });

    // Prefetch user ticket stats
    queryClient.prefetchQuery({
      queryKey: ['userTicketStats', userId],
      queryFn: async () => {
        const [openData, closedData, deletedData] = await Promise.all([
          fetch(`/api/tickets?author=${userId}&status=OPEN&limit=1`).then(res => res.json()),
          fetch(`/api/tickets?author=${userId}&status=CLOSED&limit=1`).then(res => res.json()),
          fetch(`/api/tickets?author=${userId}&status=DELETED&limit=1`).then(res => res.json()),
        ]);
        
        return {
          open: openData.pagination?.total || 0,
          closed: (closedData.pagination?.total || 0) + (deletedData.pagination?.total || 0),
        } as TicketStatsData;
      },
      staleTime: 1 * 60 * 1000,
    });

    // Prefetch recent tickets
    queryClient.prefetchQuery({
      queryKey: ['userRecentTickets', userId, limit],
      queryFn: async () => {
        const response = await fetch(`/api/tickets?author=${userId}&limit=${limit}&sortBy=newest`);
        if (!response.ok) {
          throw new Error('Failed to fetch recent tickets');
        }
        const data = await response.json();
        return (data.tickets || []) as RecentTicket[];
      },
      staleTime: 1 * 60 * 1000,
    });
  };

  return { prefetchUser };
}
