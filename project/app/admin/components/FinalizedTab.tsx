'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { Award, RefreshCw } from 'lucide-react';
import { AuctionItem } from '@/types/auction';
import AdminItemCard from './AdminItemCard';

interface CreditBalance {
  currentCredits: number;
  research2Cost?: number;
}

interface FinalizedTabProps {
  items: AuctionItem[];
  creditBalance: CreditBalance | null;
  onRefresh: () => void;
  onChangeStatus: (itemId: string, newStatus: AuctionItem['status']) => void;
  onDelete: (itemId: string) => void;
  onOpenGallery: (item: AuctionItem) => void;
  onCreateDraft: (item: AuctionItem) => void;
  onEditFinalized: (item: AuctionItem) => void;
}

export default function FinalizedTab({
  items,
  creditBalance,
  onRefresh,
  onChangeStatus,
  onDelete,
  onOpenGallery,
  onCreateDraft,
  onEditFinalized,
}: FinalizedTabProps) {
  const finalizedItems = items.filter(i => i.status === 'finalized');

  return (
    <TabsContent value="finalized" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Finalized Items</h2>
          <p className="text-sm text-gray-600 mt-1">Click on any item to view all images</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{finalizedItems.length} finalized items</Badge>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {finalizedItems.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Award className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No finalized items yet</h3>
            <p className="text-gray-600">Items will appear here once they reach the finalized status.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {finalizedItems.map((item) => (
            <AdminItemCard
              key={item.id}
              item={item}
              creditBalance={creditBalance}
              onChangeStatus={onChangeStatus}
              onDelete={onDelete}
              onOpenGallery={onOpenGallery}
              onCreateDraft={onCreateDraft}
              onEditFinalized={onEditFinalized}
            />
          ))}
        </div>
      )}
    </TabsContent>
  );
}
