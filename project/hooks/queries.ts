'use client';

import { useQuery } from '@tanstack/react-query';
import { dataStore } from '@/services/dataStore';

// ── Auction Items ─────────────────────────────────────────────────────────────

export function useAuctionItems(userId?: string, userRole?: string) {
  return useQuery({
    queryKey: ['auction-items', userId, userRole],
    queryFn: async () => {
      const items = await dataStore.getItems(userId, userRole);
      // Filter out 'processing' placeholders
      return items.filter(item => item.status !== 'processing');
    },
    enabled: !!userId,
  });
}

// ── Credit Balance ────────────────────────────────────────────────────────────

export interface CreditBalance {
  currentCredits: number;
  totalPurchased: number;
  isLowBalance: boolean;
  itemFetchCost?: number;
  research2Cost?: number;
}

export function useCreditBalance(userId?: string) {
  return useQuery<CreditBalance>({
    queryKey: ['credit-balance', userId],
    queryFn: async () => {
      const response = await fetch(`/api/credits/balance?userId=${userId}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to fetch credit balance');
      return data.credits as CreditBalance;
    },
    enabled: !!userId,
    staleTime: 10_000, // Credits change more frequently — refresh every 10s
  });
}

// ── Users ─────────────────────────────────────────────────────────────────────

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      // /api/users returns a plain array
      return Array.isArray(data) ? data : [];
    },
  });
}
