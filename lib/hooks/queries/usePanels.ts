import { useQuery } from '@tanstack/react-query';

export type Panel = {
  id: number;
  title: string;
};

export function usePanels() {
  return useQuery({
    queryKey: ['panels'],
    queryFn: async () => {
      const response = await fetch('/api/panels');
      if (!response.ok) {
        throw new Error('Failed to fetch panels');
      }
      const data = await response.json();
      return data.panels as Panel[];
    },
    staleTime: 5 * 60 * 1000, // Panels rarely change, cache for 5 minutes
  });
}
