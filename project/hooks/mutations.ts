'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dataStore } from '@/services/dataStore';
import type { AuctionItem } from '@/types/auction';

// ── Update Item ───────────────────────────────────────────────────────────────

export function useUpdateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<AuctionItem> }) =>
      dataStore.updateItem(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auction-items'] });
    },
  });
}

// ── Delete Item ───────────────────────────────────────────────────────────────

export function useDeleteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dataStore.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auction-items'] });
    },
  });
}

// ── Move Item to Next Status ──────────────────────────────────────────────────

export function useMoveItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      userId,
      userName,
      notes,
    }: {
      itemId: string;
      userId: string;
      userName: string;
      notes?: string;
    }) => dataStore.moveItemToNextStatus(itemId, userId, userName, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auction-items'] });
      queryClient.invalidateQueries({ queryKey: ['credit-balance'] });
    },
  });
}
