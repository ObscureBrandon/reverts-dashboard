'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export type TicketSummaryResponse = {
  success: true;
  summary: string;
  model: string;
  tokensUsed: number;
};

export type TicketSummaryError = {
  error: string;
};

/**
 * Mutation hook for generating a ticket summary using AI
 * 
 * @param ticketId - The ID of the ticket to generate a summary for
 * @returns Mutation object with mutate function, loading state, and error handling
 * 
 * @example
 * ```tsx
 * const { mutate: generateSummary, isPending, error } = useGenerateTicketSummary(ticketId);
 * 
 * <button onClick={() => generateSummary()}>
 *   {isPending ? 'Generating...' : 'Generate Summary'}
 * </button>
 * ```
 */
export function useGenerateTicketSummary(ticketId: string | number) {
  const queryClient = useQueryClient();

  return useMutation<TicketSummaryResponse, Error>({
    mutationFn: async () => {
      const response = await fetch(`/api/tickets/${ticketId}/summary`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData: TicketSummaryError = await response.json();
        throw new Error(errorData.error || 'Failed to generate summary');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate ticket query to refetch with new summary
      queryClient.invalidateQueries({ queryKey: ['ticket', String(ticketId)] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] }); // Also invalidate list in case it shows summaries
    },
  });
}
