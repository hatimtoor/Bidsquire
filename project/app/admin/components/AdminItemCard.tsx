'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Edit3, ExternalLink, FileText, Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuctionItem } from '@/types/auction';
import { getStatusColor, getStatusIcon } from './statusUtils';

interface CreditBalance {
  currentCredits: number;
  research2Cost?: number;
}

interface AdminItemCardProps {
  item: AuctionItem;
  creditBalance: CreditBalance | null;
  onChangeStatus: (itemId: string, newStatus: AuctionItem['status']) => void;
  onDelete: (itemId: string) => void;
  onOpenGallery: (item: AuctionItem) => void;
  onCreateDraft: (item: AuctionItem) => void;
  onEditFinalized?: (item: AuctionItem) => void;
}

export default function AdminItemCard({
  item,
  creditBalance,
  onChangeStatus,
  onDelete,
  onOpenGallery,
  onCreateDraft,
  onEditFinalized,
}: AdminItemCardProps) {
  const isFinalized = item.status === 'finalized';

  return (
    <Card
      className="overflow-hidden hover:shadow-lg transition-shadow"
      onClick={() => onOpenGallery(item)}
    >
      {/* Item Image */}
      {(item.mainImageUrl || (item.images && item.images.length > 0) || (item.photographerImages && item.photographerImages.length > 0)) && (
        <div className="aspect-video overflow-hidden cursor-pointer">
          <img
            src={
              item.mainImageUrl ||
              (item.images && item.images.length > 0 ? item.images[0] : '') ||
              (item.photographerImages && item.photographerImages.length > 0 ? item.photographerImages[0] : '')
            }
            alt={item.itemName}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg line-clamp-2">{item.itemName}</CardTitle>
            <CardDescription className="line-clamp-1">
              {item.auctionName} - {item.lotNumber}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2">
            <Badge className={getStatusColor(item.status)}>
              <div className="flex items-center gap-1">
                {getStatusIcon(item.status)}
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </div>
            </Badge>
            {item.priority && (
              <Badge variant="outline" className={
                item.priority === 'high' ? 'border-red-300 text-red-700' :
                  item.priority === 'medium' ? 'border-yellow-300 text-yellow-700' :
                    'border-green-300 text-green-700'
              }>
                {item.priority}
              </Badge>
            )}
            {isFinalized && onEditFinalized && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditFinalized(item);
                }}
              >
                <Edit3 className="h-3 w-3 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Two Column Info Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">Item Information</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">SKU:</span>
                <span className="text-gray-600">{item.sku || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Category:</span>
                <span className="text-gray-600">{item.category || 'Uncategorized'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Lead:</span>
                <span className="text-gray-600">{item.lead || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Bidsquire Estimate:</span>
                <span className="text-gray-600">{item.auctionSiteEstimate || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Researcher Estimate:</span>
                <span className="text-gray-600">{item.researcherEstimate || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">Research Analysis</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">AI Estimate:</span>
                <span className="text-gray-600">{item.aiEstimate || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">AI Description:</span>
                <span className="text-gray-600 line-clamp-3">{item.aiDescription || 'N/A'}</span>
              </div>
              {item.referenceUrls && item.referenceUrls.length > 0 && (
                <div>
                  <span className="font-medium text-gray-700">Reference URLs:</span>
                  <div className="mt-1 space-y-1">
                    {item.referenceUrls.map((url, index) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-blue-600 hover:text-blue-800 text-xs truncate"
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Team Notes */}
        {(item.notes || item.photographerNotes || item.researcherNotes || item.researcher2Notes) && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-semibold text-gray-900">Notes from Team</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {item.photographerNotes && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Camera className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-900">Photographer Notes</span>
                  </div>
                  <p className="text-sm text-blue-800">{item.photographerNotes}</p>
                </div>
              )}
              {item.researcherNotes && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-900">Researcher Notes</span>
                  </div>
                  <p className="text-sm text-green-800">{item.researcherNotes}</p>
                </div>
              )}
              {item.researcher2Notes && (
                <div className="p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-purple-900">Researcher 2 Notes</span>
                  </div>
                  <p className="text-sm text-purple-800">{item.researcher2Notes}</p>
                </div>
              )}
              {item.notes && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Edit3 className="h-4 w-4 text-gray-600" />
                    <span className="font-medium text-gray-900">General Notes</span>
                  </div>
                  <p className="text-sm text-gray-700">{item.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-4 border-t">
          <Select
            value={item.status}
            onValueChange={(newStatus) => onChangeStatus(item.id, newStatus as AuctionItem['status'])}
          >
            <SelectTrigger className="w-full" onClick={(e) => e.stopPropagation()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="research">Research</SelectItem>
              <SelectItem value="winning">Winning</SelectItem>
              <SelectItem value="photography">Photography</SelectItem>
              <SelectItem
                value="research2"
                disabled={creditBalance ? (creditBalance.currentCredits < (creditBalance.research2Cost || 0)) : false}
              >
                Research 2 {creditBalance?.research2Cost ? `(${creditBalance.research2Cost} credits)` : ''}
              </SelectItem>
              <SelectItem value="admin_review">Admin Review</SelectItem>
              <SelectItem value="finalized">Finalized</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            {item.status === 'admin_review' ? (
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateDraft(item);
                }}
              >
                <FileText className="mr-2 h-3 w-3" />
                Create eBay Draft
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  const url = item.url || (item as any).url_main;
                  if (url) {
                    window.open(url, '_blank');
                  } else {
                    toast.error('No URL available for this item');
                  }
                }}
              >
                <ExternalLink className="mr-2 h-3 w-3" />
                View Original
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
