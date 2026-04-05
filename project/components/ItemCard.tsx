'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, Trash2, Edit3, FileText, Award, Camera, Users, Tag, X, Image, ArrowRight, Plus, Sparkles, Loader2 } from 'lucide-react';
import { AuctionItem } from '@/types/auction';

interface ItemCardProps {
  item: AuctionItem;
  onStatusChange?: (itemId: string, newStatus: AuctionItem['status']) => void;
  onEdit?: (item: AuctionItem) => void;
  onDelete?: (itemId: string) => void;
  onViewOriginal?: (item: AuctionItem) => void;
  onMoveToNext?: (itemId: string) => void;
  onEbayDraft?: (item: AuctionItem) => void;
  onCreateSubItems?: (itemId: string) => void;
  onAiResearch?: (itemId: string) => void;
  isAiResearching?: boolean;
  showStatusDropdown?: boolean;
  showEditButton?: boolean;
  showDeleteButton?: boolean;
  showMoveToNextButton?: boolean;
  showEbayDraftButton?: boolean;
  showCreateSubItemsButton?: boolean;
  showAiResearchButton?: boolean;
  userRole?: string;
}

export default function ItemCard({
  item,
  onStatusChange,
  onEdit,
  onDelete,
  onViewOriginal,
  onMoveToNext,
  onEbayDraft,
  onCreateSubItems,
  onAiResearch,
  isAiResearching = false,
  showStatusDropdown = false,
  showEditButton = false,
  showDeleteButton = false,
  showMoveToNextButton = false,
  showEbayDraftButton = false,
  showCreateSubItemsButton = false,
  showAiResearchButton = false,
  userRole
}: ItemCardProps) {
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'research': return 'bg-blue-100 text-blue-800';
      case 'winning': return 'bg-green-100 text-green-800';
      case 'photography': return 'bg-purple-100 text-purple-800';
      case 'research2': return 'bg-orange-100 text-orange-800';
      case 'finalized': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'research': return <FileText className="h-4 w-4" />;
      case 'winning': return <Award className="h-4 w-4" />;
      case 'photography': return <Camera className="h-4 w-4" />;
      case 'research2': return <Users className="h-4 w-4" />;
      case 'finalized': return <Tag className="h-4 w-4" />;
      default: return <Tag className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-300 text-red-700';
      case 'medium': return 'border-yellow-300 text-yellow-700';
      case 'low': return 'border-green-300 text-green-700';
      default: return 'border-gray-300 text-gray-700';
    }
  };

  const openDetailModal = () => {
    setIsDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
  };

  return (
    <>
      <Card 
        className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" 
        onClick={openDetailModal}
      >
        {/* Image Display */}
        {(item.mainImageUrl || (item.images && item.images.length > 0) || (item.photographerImages && item.photographerImages.length > 0)) && (
          <div className="aspect-video overflow-hidden">
            <img
              src={item.mainImageUrl || (item.images && item.images.length > 0 ? item.images[0] : '') || (item.photographerImages && item.photographerImages.length > 0 ? item.photographerImages[0] : '')}
              alt={item.itemName}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
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
                <Badge variant="outline" className={getPriorityColor(item.priority)}>
                  {item.priority}
                </Badge>
              )}
              {item.isMultipleItems && item.multipleItemsCount && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  <Plus className="mr-1 h-3 w-3" />
                  {item.multipleItemsCount} items
                </Badge>
              )}
              {item.parentItemId && item.subItemNumber && (
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  Sub Item #{item.subItemNumber}
                </Badge>
              )}
              {item.isMultipleItems && item.multipleItemsCount && item.multipleItemsCount > 1 && (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  🔥 High Priority Lot
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3 pt-0">
          {/* Three Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Left Column: Basic Item Information */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Basic Information</h4>
              
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
                  <span className="font-medium text-gray-700">Assigned To:</span>
                  <span className="text-gray-600">{item.assignedTo || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Created:</span>
                  <span className="text-gray-600">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Middle Column: Estimates & Analysis */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Estimates & Analysis</h4>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Auction Estimate:</span>
                  <span className="text-gray-600">{item.auctionSiteEstimate || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">AI Estimate:</span>
                  <span className="text-gray-600">{item.aiEstimate || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Researcher Estimate:</span>
                  <span className="text-gray-600">{item.researcherEstimate || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Researcher2 Estimate:</span>
                  <span className="text-gray-600">{item.researcher2Estimate || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Photographer Qty:</span>
                  <span className="text-gray-600">{item.photographerQuantity || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Right Column: URLs & References */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">References & URLs</h4>
              
              <div className="space-y-2 text-sm">
                {item.referenceUrls && item.referenceUrls.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-700">Reference URLs:</span>
                    <div className="mt-1 space-y-1">
                      {item.referenceUrls.slice(0, 2).map((url, index) => (
                        <a
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-blue-600 hover:text-blue-800 text-xs truncate"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {url}
                        </a>
                      ))}
                      {item.referenceUrls.length > 2 && (
                        <span className="text-xs text-gray-500">+{item.referenceUrls.length - 2} more</span>
                      )}
                    </div>
                  </div>
                )}
                {item.similarUrls && item.similarUrls.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-700">Similar URLs:</span>
                    <div className="mt-1 space-y-1">
                      {item.similarUrls.slice(0, 2).map((url, index) => (
                        <a
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-green-600 hover:text-green-800 text-xs truncate"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {url}
                        </a>
                      ))}
                      {item.similarUrls.length > 2 && (
                        <span className="text-xs text-gray-500">+{item.similarUrls.length - 2} more</span>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Images Count:</span>
                  <span className="text-gray-600">{(item.images?.length || 0) + (item.photographerImages?.length || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Tags:</span>
                  <span className="text-gray-600">{item.tags?.length || 0} tags</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Description Section */}
          {item.aiDescription && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">AI Analysis</h4>
              <p className="text-sm text-gray-600 line-clamp-3">{item.aiDescription}</p>
            </div>
          )}

          {/* Notes Section */}
          {(item.notes || item.photographerNotes) && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Notes</h4>
              {item.notes && (
                <div className="mb-2">
                  <span className="text-xs font-medium text-gray-600">General Notes:</span>
                  <p className="text-sm text-gray-600 line-clamp-2">{item.notes}</p>
                </div>
              )}
              {item.photographerNotes && (
                <div>
                  <span className="text-xs font-medium text-gray-600">Photographer Notes:</span>
                  <p className="text-sm text-gray-600 line-clamp-2">{item.photographerNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-4 border-t">
            {/* Status Change Dropdown */}
            {showStatusDropdown && onStatusChange && (
              <Select
                value={item.status}
                onValueChange={(newStatus) => onStatusChange(item.id, newStatus as AuctionItem['status'])}
              >
                <SelectTrigger className="w-full" onClick={(e) => e.stopPropagation()}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="research">Research</SelectItem>
                  <SelectItem value="winning">Winning</SelectItem>
                  <SelectItem value="photography">Photography</SelectItem>
                  <SelectItem value="research2">Research 2</SelectItem>
                  <SelectItem value="finalized">Finalized</SelectItem>
                </SelectContent>
              </Select>
            )}
            
            {/* Action Buttons Row */}
            <div className="flex gap-2">
              {showEditButton && onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(item);
                  }}
                >
                  <Edit3 className="mr-2 h-3 w-3" />
                  Edit
                </Button>
              )}
              
              {onViewOriginal && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewOriginal(item);
                  }}
                >
                  <ExternalLink className="mr-2 h-3 w-3" />
                  View Original
                </Button>
              )}
              
              {showDeleteButton && onDelete && (
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
              )}
            </div>

            {/* AI Research Button */}
            {showAiResearchButton && onAiResearch && (
              <Button
                variant="outline"
                className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onAiResearch(item.id);
                }}
                disabled={isAiResearching}
              >
                {isAiResearching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {isAiResearching ? 'AI Researching...' : 'AI Research (1 credit)'}
              </Button>
            )}

            {/* Move to Next Status Button */}
            {showMoveToNextButton && onMoveToNext && (
              <Button
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveToNext(item.id);
                }}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                Move to Next Status
              </Button>
            )}

            {/* eBay Draft Button */}
            {showEbayDraftButton && onEbayDraft && (
              <Button
                variant="default"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onEbayDraft(item);
                }}
              >
                <Award className="mr-2 h-4 w-4" />
                Create eBay Listing Draft
              </Button>
            )}

            {/* Create Sub-Items Button */}
            {showCreateSubItemsButton && onCreateSubItems && item.isMultipleItems && item.multipleItemsCount && item.multipleItemsCount > 1 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateSubItems(item.id);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create {item.multipleItemsCount} Sub-Items
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Item Modal */}
      {isDetailModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={closeDetailModal}>
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-gray-900">
                  {item.itemName} - Detailed View
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={closeDetailModal}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Item Details */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Auction:</span>
                    <p className="text-gray-600">{item.auctionName || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Status:</span>
                    <p className="text-gray-600">{item.status}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">SKU:</span>
                    <p className="text-gray-600">{item.sku || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Priority:</span>
                    <p className="text-gray-600">{item.priority || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Bidsquire Estimate:</span>
                    <p className="text-gray-600">{item.auctionSiteEstimate || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">AI Estimate:</span>
                    <p className="text-gray-600">{item.aiEstimate || 'N/A'}</p>
                  </div>
                </div>

                {/* Original Webhook Data */}
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-medium text-gray-700 mb-2">📋 Original Webhook Data</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">Category:</span>
                      <p className="text-gray-500">{item.category || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Lot Number:</span>
                      <p className="text-gray-500">{item.lotNumber || 'N/A'}</p>
                    </div>
                  </div>
                  {item.aiDescription && (
                    <div className="mt-2">
                      <span className="font-medium text-gray-600">AI Analysis:</span>
                      <p className="text-gray-500 text-sm mt-1">{item.aiDescription}</p>
                    </div>
                  )}
                </div>

                {/* Research Data */}
                {item.researcherEstimate && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium text-gray-700 mb-2">🔍 Research Stage</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">Researcher Estimate:</span>
                        <p className="text-gray-500">{item.researcherEstimate}</p>
                      </div>
                    </div>
                    {item.researcherDescription && (
                      <div className="mt-2">
                        <span className="font-medium text-gray-600">Research Notes:</span>
                        <p className="text-gray-500 text-sm mt-1">{item.researcherDescription}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Photography Data */}
                {(item.photographerImages && item.photographerImages.length > 0) && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium text-gray-700 mb-2">📸 Photography Stage</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">Images Taken:</span>
                        <p className="text-gray-500">{item.photographerImages.length}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Quantity:</span>
                        <p className="text-gray-500">{item.photographerQuantity || 'N/A'}</p>
                      </div>
                    </div>
                    {item.isMultipleItems && (
                      <div className="mt-2 p-2 bg-purple-50 rounded border-l-2 border-purple-400">
                        <div className="text-sm">
                          <span className="font-medium text-purple-700">📦 Multiple Items:</span>
                          <span className="text-purple-600 ml-1">{item.multipleItemsCount || 1} pieces in this lot</span>
                        </div>
                      </div>
                    )}
                    {item.photographerNotes && (
                      <div className="mt-2">
                        <span className="font-medium text-gray-600">Photographer Notes:</span>
                        <p className="text-gray-500 text-sm mt-1">{item.photographerNotes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Research2 Data */}
                {item.researcher2Estimate && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium text-gray-700 mb-2">🔬 Research 2 Stage</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">Final Estimate:</span>
                        <p className="text-gray-500">{item.researcher2Estimate}</p>
                      </div>
                    </div>
                    {item.researcher2Description && (
                      <div className="mt-2">
                        <span className="font-medium text-gray-600">Final Notes:</span>
                        <p className="text-gray-500 text-sm mt-1">{item.researcher2Description}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* General Notes */}
                {item.notes && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium text-gray-700 mb-1">📝 General Notes</h4>
                    <p className="text-gray-600 text-sm whitespace-pre-wrap">{item.notes}</p>
                  </div>
                )}

                {/* Lead/Notes */}
                {item.lead && (
                  <div className="mt-4 pt-4 border-t">
                    <span className="font-medium text-gray-700">Lead/Notes:</span>
                    <p className="text-gray-600 mt-1">{item.lead}</p>
                  </div>
                )}
              </div>

              {/* Image Gallery */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">All Images ({(item.images?.length || 0) + (item.photographerImages?.length || 0)})</h3>
                
                {item.mainImageUrl && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Main Image</h4>
                    <div className="aspect-video overflow-hidden rounded-lg">
                      <img
                        src={item.mainImageUrl}
                        alt={`${item.itemName} - Main Image`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                )}

                {item.images && item.images.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Original Images</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {item.images.map((imageUrl, index) => (
                        <div key={index} className="aspect-video overflow-hidden rounded-lg">
                          <img
                            src={imageUrl}
                            alt={`${item.itemName} - Image ${index + 1}`}
                            className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                            onClick={() => window.open(imageUrl, '_blank')}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {item.photographerImages && item.photographerImages.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">📸 Photography Images</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {item.photographerImages.map((imageUrl, index) => (
                        <div key={`photo-${index}`} className="aspect-video overflow-hidden rounded-lg">
                          <img
                            src={imageUrl}
                            alt={`${item.itemName} - Photography ${index + 1}`}
                            className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                            onClick={() => window.open(imageUrl, '_blank')}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!item.mainImageUrl && (!item.images || item.images.length === 0) && (!item.photographerImages || item.photographerImages.length === 0)) && (
                  <div className="text-center py-8 text-gray-500">
                    <Image className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p>No images available for this item</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-6 pt-4 border-t">
                {onViewOriginal && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewOriginal(item);
                    }}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Original
                  </Button>
                )}
                {showEditButton && onEdit && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      closeDetailModal();
                      onEdit(item);
                    }}
                  >
                    <Edit3 className="mr-2 h-4 w-4" />
                    Edit Item
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
