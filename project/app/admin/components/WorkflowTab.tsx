'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { FileText, RefreshCw } from 'lucide-react';
import { AuctionItem } from '@/types/auction';
import AdminItemCard from './AdminItemCard';

interface CreditBalance {
  currentCredits: number;
  research2Cost?: number;
}

interface WorkflowTabProps {
  items: AuctionItem[];
  creditBalance: CreditBalance | null;
  onRefresh: () => void;
  onChangeStatus: (itemId: string, newStatus: AuctionItem['status']) => void;
  onDelete: (itemId: string) => void;
  onOpenGallery: (item: AuctionItem) => void;
  onCreateDraft: (item: AuctionItem) => void;
}

function PriorityGroup({
  label,
  items,
  badgeContent,
  badgeVariant,
  creditBalance,
  onChangeStatus,
  onDelete,
  onOpenGallery,
  onCreateDraft,
}: {
  label: string;
  items: AuctionItem[];
  badgeContent: React.ReactNode;
  badgeVariant: 'destructive' | 'secondary' | 'outline';
  creditBalance: CreditBalance | null;
  onChangeStatus: (itemId: string, newStatus: AuctionItem['status']) => void;
  onDelete: (itemId: string) => void;
  onOpenGallery: (item: AuctionItem) => void;
  onCreateDraft: (item: AuctionItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-xl font-semibold">{label}</h3>
        <Badge variant={badgeVariant} className="text-sm">{badgeContent}</Badge>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <AdminItemCard
            key={item.id}
            item={item}
            creditBalance={creditBalance}
            onChangeStatus={onChangeStatus}
            onDelete={onDelete}
            onOpenGallery={onOpenGallery}
            onCreateDraft={onCreateDraft}
          />
        ))}
      </div>
    </div>
  );
}

export default function WorkflowTab({
  items,
  creditBalance,
  onRefresh,
  onChangeStatus,
  onDelete,
  onOpenGallery,
  onCreateDraft,
}: WorkflowTabProps) {
  const highPriority = items.filter(i => i.priority === 'high');
  const mediumPriority = items.filter(i => i.priority === 'medium' || !i.priority);
  const lowPriority = items.filter(i => i.priority === 'low');

  return (
    <TabsContent value="workflow" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Item Pipeline</h2>
          <p className="text-sm text-gray-600 mt-1">Click on any item to view all images</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{items.length} items</Badge>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No auction items yet</h3>
            <p className="text-gray-600">Submit a URL above or add items manually to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          <PriorityGroup
            label="🔥 High Priority Items"
            items={highPriority}
            badgeContent={`${highPriority.length} urgent`}
            badgeVariant="destructive"
            creditBalance={creditBalance}
            onChangeStatus={onChangeStatus}
            onDelete={onDelete}
            onOpenGallery={onOpenGallery}
            onCreateDraft={onCreateDraft}
          />
          <PriorityGroup
            label="⚡ Medium Priority Items"
            items={mediumPriority}
            badgeContent={`${mediumPriority.length} items`}
            badgeVariant="secondary"
            creditBalance={creditBalance}
            onChangeStatus={onChangeStatus}
            onDelete={onDelete}
            onOpenGallery={onOpenGallery}
            onCreateDraft={onCreateDraft}
          />
          <PriorityGroup
            label="📋 Low Priority Items"
            items={lowPriority}
            badgeContent={`${lowPriority.length} items`}
            badgeVariant="outline"
            creditBalance={creditBalance}
            onChangeStatus={onChangeStatus}
            onDelete={onDelete}
            onOpenGallery={onOpenGallery}
            onCreateDraft={onCreateDraft}
          />
        </div>
      )}
    </TabsContent>
  );
}
