import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';

export type UserListItem = {
  id: string;
  name: string | null;
  displayName: string | null;
  displayAvatar: string | null;
  inGuild: boolean;
  isVerified: boolean;
  isVoiceVerified: boolean;
  relationToIslam: string | null;
  gender: string | null;
  age: string | null;
  region: string | null;
  currentAssignmentStatus: string | null;
  topRoles: Array<{ id: string; name: string; color: number }>;
  createdAt: string;
};

export type UsersTableParams = {
  query?: string;
  assignmentStatus?: string;
  relationToIslam?: string;
  inGuild?: boolean;
  verified?: boolean;
  voiceVerified?: boolean;
  roleId?: string;
  assignedToMe?: boolean;
  sortBy?: 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
};

type UsersResponse = {
  users: UserListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

async function fetchUsers(params: UsersTableParams): Promise<UsersResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.query) searchParams.set('q', params.query);
  if (params.assignmentStatus) searchParams.set('assignmentStatus', params.assignmentStatus);
  if (params.relationToIslam) searchParams.set('relationToIslam', params.relationToIslam);
  if (params.inGuild !== undefined) searchParams.set('inGuild', String(params.inGuild));
  if (params.verified !== undefined) searchParams.set('verified', String(params.verified));
  if (params.voiceVerified !== undefined) searchParams.set('voiceVerified', String(params.voiceVerified));
  if (params.roleId) searchParams.set('roleId', params.roleId);
  if (params.assignedToMe) searchParams.set('assignedToMe', 'true');
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));

  const response = await fetch(`/api/users?${searchParams.toString()}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }
  
  return response.json();
}

export function useUsersTable(params: UsersTableParams) {
  return useQuery({
    queryKey: ['users', 'table', params],
    queryFn: () => fetchUsers(params),
    staleTime: 30 * 1000, // 30 seconds
    // Keep previous data while fetching new data to prevent layout shift
    placeholderData: keepPreviousData,
  });
}

export function usePrefetchUsersTable() {
  const queryClient = useQueryClient();
  
  const prefetchPage = (params: UsersTableParams) => {
    queryClient.prefetchQuery({
      queryKey: ['users', 'table', params],
      queryFn: () => fetchUsers(params),
      staleTime: 30 * 1000,
    });
  };
  
  return { prefetchPage };
}

// Roles for filter dropdown
type Role = {
  id: string;
  name: string;
  color: number;
  position: number;
};

async function fetchRoles(): Promise<{ roles: Role[] }> {
  const response = await fetch('/api/roles');
  if (!response.ok) throw new Error('Failed to fetch roles');
  return response.json();
}

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: fetchRoles,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Relations to Islam for filter dropdown
async function fetchRelations(): Promise<{ relations: string[] }> {
  const response = await fetch('/api/users/relations');
  if (!response.ok) throw new Error('Failed to fetch relations');
  return response.json();
}

export function useRelationsToIslam() {
  return useQuery({
    queryKey: ['relations-to-islam'],
    queryFn: fetchRelations,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
