'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, Image, Calendar, Tag, DollarSign, RefreshCw, Plus, ArrowRight, Camera, Edit3, Save, X, Trash2 } from 'lucide-react';
import Navbar from '@/components/layout/navbar';
import ImageUpload from '@/components/ImageUpload';
import ItemCard from '@/components/ItemCard';
import { dataStore } from '@/services/dataStore'; // used for createSubItems (no mutation hook yet)
import { AuctionItem } from '@/types/auction';
import { toast } from 'sonner';
import { useAuctionItems } from '@/hooks/queries';
import { useUpdateItem, useDeleteItem, useMoveItem } from '@/hooks/mutations';

export default function PhotographerPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AuctionItem>>({});
  const [newImageUrl, setNewImageUrl] = useState('');

  const { data: allItems = [], isLoading: isLoadingData, refetch } = useAuctionItems(user?.id, user?.role);
  const updateItem = useUpdateItem();
  const deleteItemMutation = useDeleteItem();
  const moveItem = useMoveItem();

  // Filter to photographer items
  const items = useMemo(
    () => allItems.filter(item => item.assignedTo === 'photographer'),
    [allItems]
  );

  // Check authentication
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    } else if (user && user.role !== 'photographer') {
      router.push('/');
    }
  }, [user, isLoading, router]);

  const startEditing = (item: AuctionItem) => {
    setEditingItem(item.id);
    setEditForm({
      photographerQuantity: item.photographerQuantity || 1,
      photographerImages: item.photographerImages || [],
      photographerNotes: item.photographerNotes || '',
      isMultipleItems: item.isMultipleItems || false,
      multipleItemsCount: item.multipleItemsCount || 1
    });
  };

  const handleImageUpload = (image: any) => {
    if (image) {
      setEditForm(prev => ({
        ...prev,
        photographerImages: [...(prev.photographerImages || []), image.url]
      }));
    }
  };

  const handleImagesUpload = (images: any[]) => {
    const imageUrls = images.map(img => img.url);
    setEditForm(prev => ({
      ...prev,
      photographerImages: [...(prev.photographerImages || []), ...imageUrls]
    }));
  };

  const handleMainImageSelected = (image: any) => {
    setEditForm(prev => ({
      ...prev,
      mainImageUrl: image.url
    }));
  };

  const removeImageFromForm = (imageUrl: string) => {
    setEditForm(prev => ({
      ...prev,
      photographerImages: (prev.photographerImages || []).filter(url => url !== imageUrl)
    }));
  };

  const createSubItems = async (itemId: string) => {
    try {
      const item = allItems.find(i => i.id === itemId);
      if (!item) {
        toast.error('Item not found');
        return;
      }

      if (!item.isMultipleItems || !item.multipleItemsCount) {
        toast.error('This item is not marked as multiple items. Please enable "This item contains multiple items" and set the count first.');
        return;
      }

      const subItemCount = item.multipleItemsCount;
      if (subItemCount < 2) {
        toast.error('Sub-item count must be at least 2');
        return;
      }

      const existingSubItems = allItems.filter(i => i.parentItemId === itemId);
      if (existingSubItems.length > 0) {
        const confirmCreate = window.confirm(
          `Sub-items already exist for this item (${existingSubItems.length} found). Do you want to create new ones? This will create additional sub-items.`
        );
        if (!confirmCreate) return;
      }

      const subItems = await dataStore.createSubItems(itemId, subItemCount);
      refetch();

      toast.success(`Successfully created ${subItems.length} sub-items:\n${subItems.map(si => `• ${si.itemName}`).join('\n')}\n\n🔥 All items (parent + sub-items) have been set to HIGH priority!`);
    } catch (error) {
      console.error('Error creating sub-items:', error);
      toast.error(`Error creating sub-items: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getSubItems = (parentItemId: string) => {
    return items.filter(item => item.parentItemId === parentItemId);
  };

  const saveEdit = (itemId: string) => {
    const updates = { ...editForm, photographerImages: editForm.photographerImages || [] };
    updateItem.mutate(
      { id: itemId, updates },
      {
        onSuccess: () => {
          setEditingItem(null);
          setEditForm({});
          toast.success('Photography details saved successfully!');
        },
        onError: () => toast.error('Failed to save photography details. Please try again.'),
      }
    );
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditForm({});
  };

  const addImage = (itemId: string) => {
    if (!newImageUrl.trim()) {
      toast.error('Please enter an image URL.');
      return;
    }
    try {
      new URL(newImageUrl.trim());
    } catch {
      toast.error('Please enter a valid URL (e.g., https://example.com/image.jpg)');
      return;
    }

    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    const updatedImages = [...(item.photographerImages || []), newImageUrl.trim()];
    setEditForm(prev => ({ ...prev, photographerImages: updatedImages }));
    updateItem.mutate(
      { id: itemId, updates: { photographerImages: updatedImages } },
      {
        onSuccess: () => {
          setNewImageUrl('');
          toast.success('Image URL added successfully!');
        },
        onError: () => toast.error('Error adding image URL. Please try again.'),
      }
    );
  };

  const removeImage = (itemId: string, imageIndex: number) => {
    const item = allItems.find(i => i.id === itemId);
    if (!item?.photographerImages) return;

    const updatedImages = item.photographerImages.filter((_, index) => index !== imageIndex);
    setEditForm(prev => ({ ...prev, photographerImages: updatedImages }));
    updateItem.mutate(
      { id: itemId, updates: { photographerImages: updatedImages } },
      {
        onSuccess: () => toast.success('Image removed successfully!'),
        onError: () => toast.error('Error removing image. Please try again.'),
      }
    );
  };

  const moveToNextStatus = (itemId: string) => {
    const currentItem = allItems.find(i => i.id === itemId);
    if (!currentItem) {
      toast.error('Item not found. Please refresh and try again.');
      return;
    }
    if (currentItem.assignedTo !== 'photographer') {
      toast.error('You can only move items assigned to the photographer role.');
      return;
    }
    moveItem.mutate(
      { itemId, userId: user?.id || '', userName: user?.name || '' },
      {
        onSuccess: () => toast.success('Item moved to Research 2 stage successfully!'),
        onError: () => toast.error('Failed to move item to next status. Please try again.'),
      }
    );
  };

  const handleDeleteItem = (itemId: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      deleteItemMutation.mutate(itemId);
    }
  };

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-300 text-red-700';
      case 'medium': return 'border-yellow-300 text-yellow-700';
      case 'low': return 'border-green-300 text-green-700';
      default: return 'border-gray-300 text-gray-700';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  // Show access denied if not photographer
  if (user && user.role !== 'photographer') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don&apos;t have permission to access the photographer dashboard.</p>
        </div>
      </div>
    );
  }

  // All items are already filtered to photographer role, so use them directly
  const myAssignedItems = items; // All items shown are assigned to photographer role
  const stats = dataStore.getDashboardStats(user?.id);

  // Separate parent items and sub-items
  const parentItems = myAssignedItems.filter(item => !item.parentItemId);
  const subItems = myAssignedItems.filter(item => item.parentItemId);

  // Separate items by priority
  const highPriorityItems = myAssignedItems.filter(item => item.priority === 'high');
  const mediumPriorityItems = myAssignedItems.filter(item => item.priority === 'medium' || !item.priority);
  const lowPriorityItems = myAssignedItems.filter(item => item.priority === 'low');

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Photography Dashboard</h1>
          <p className="text-gray-600">Manage item photography and prepare images for the next workflow stage</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Camera className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Photography Items</CardTitle>
              <Image className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.photography}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Items</CardTitle>
              <Tag className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.myItems}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <Calendar className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.overdue}</div>
            </CardContent>
          </Card>
        </div>

        {/* My Photography Tasks */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900">My Photography Tasks</h2>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{myAssignedItems.length} items assigned to you</Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isLoadingData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading items...</span>
            </div>
          ) : myAssignedItems.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Camera className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No photography tasks assigned</h3>
                <p className="text-gray-600">
                  You don&apos;t have any items assigned to you for photography yet. Items will appear here when they are assigned to the photographer role.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {/* High Priority Items */}
              {highPriorityItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-xl font-semibold text-red-700">🔥 High Priority Items</h3>
                    <Badge variant="destructive" className="text-sm">
                      {highPriorityItems.length} urgent
                    </Badge>
                  </div>
                  <div className="space-y-6">
                    {highPriorityItems.filter(item => !item.parentItemId).map((item) => {
                      const itemSubItems = getSubItems(item.id);
                      return (
                        <div key={item.id}>
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            <ItemCard
                              item={item}
                              onEdit={startEditing}
                              onViewOriginal={(item) => {
                                const url = item.url || (item as any).url_main;
                                if (url) {
                                  window.open(url, '_blank');
                                } else {
                                  toast.error('No URL available for this item');
                                }
                              }}
                              onMoveToNext={moveToNextStatus}
                              onCreateSubItems={createSubItems}
                              showEditButton={true}
                              showMoveToNextButton={item.assignedTo === 'photographer'}
                              showCreateSubItemsButton={user?.role === 'photographer' && item.status === 'photography'}
                              userRole="photographer"
                            />
                          </div>
                          {/* Sub-items for this parent */}
                          {itemSubItems.length > 0 && (
                            <div className="ml-8 mt-4 pl-4 border-l-4 border-purple-300">
                              <div className="flex items-center gap-2 mb-3">
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                  📦 {itemSubItems.length} Sub-Items
                                </Badge>
                              </div>
                              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {itemSubItems.map((subItem) => (
                                  <ItemCard
                                    key={subItem.id}
                                    item={subItem}
                                    onEdit={startEditing}
                                    onViewOriginal={(item) => {
                                      const url = item.url || (item as any).url_main;
                                      if (url) {
                                        window.open(url, '_blank');
                                      } else {
                                        toast.error('No URL available for this item');
                                      }
                                    }}
                                    onMoveToNext={moveToNextStatus}
                                    onCreateSubItems={createSubItems}
                                    showEditButton={true}
                                    showMoveToNextButton={subItem.assignedTo === 'photographer'}
                                    showCreateSubItemsButton={false}
                                    userRole="photographer"
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Medium Priority Items */}
              {mediumPriorityItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-xl font-semibold text-yellow-700">⚡ Medium Priority Items</h3>
                    <Badge variant="secondary" className="text-sm">
                      {mediumPriorityItems.length} items
                    </Badge>
                  </div>
                  <div className="space-y-6">
                    {mediumPriorityItems.filter(item => !item.parentItemId).map((item) => {
                      const itemSubItems = getSubItems(item.id);
                      return (
                        <div key={item.id}>
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            <ItemCard
                              item={item}
                              onEdit={startEditing}
                              onViewOriginal={(item) => {
                                const url = item.url || (item as any).url_main;
                                if (url) {
                                  window.open(url, '_blank');
                                } else {
                                  toast.error('No URL available for this item');
                                }
                              }}
                              onMoveToNext={moveToNextStatus}
                              onCreateSubItems={createSubItems}
                              showEditButton={true}
                              showMoveToNextButton={item.assignedTo === 'photographer'}
                              showCreateSubItemsButton={user?.role === 'photographer' && item.status === 'photography'}
                              userRole="photographer"
                            />
                          </div>
                          {itemSubItems.length > 0 && (
                            <div className="ml-8 mt-4 pl-4 border-l-4 border-purple-300">
                              <div className="flex items-center gap-2 mb-3">
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                  📦 {itemSubItems.length} Sub-Items
                                </Badge>
                              </div>
                              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {itemSubItems.map((subItem) => (
                                  <ItemCard
                                    key={subItem.id}
                                    item={subItem}
                                    onEdit={startEditing}
                                    onViewOriginal={(item) => {
                                      const url = item.url || (item as any).url_main;
                                      if (url) {
                                        window.open(url, '_blank');
                                      } else {
                                        toast.error('No URL available for this item');
                                      }
                                    }}
                                    onMoveToNext={moveToNextStatus}
                                    onCreateSubItems={createSubItems}
                                    showEditButton={true}
                                    showMoveToNextButton={subItem.assignedTo === 'photographer'}
                                    showCreateSubItemsButton={false}
                                    userRole="photographer"
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Low Priority Items */}
              {lowPriorityItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-xl font-semibold text-green-700">📋 Low Priority Items</h3>
                    <Badge variant="outline" className="text-sm">
                      {lowPriorityItems.length} items
                    </Badge>
                  </div>
                  <div className="space-y-6">
                    {lowPriorityItems.filter(item => !item.parentItemId).map((item) => {
                      const itemSubItems = getSubItems(item.id);
                      return (
                        <div key={item.id}>
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            <ItemCard
                              item={item}
                              onEdit={startEditing}
                              onViewOriginal={(item) => {
                                const url = item.url || (item as any).url_main;
                                if (url) {
                                  window.open(url, '_blank');
                                } else {
                                  toast.error('No URL available for this item');
                                }
                              }}
                              onMoveToNext={moveToNextStatus}
                              onCreateSubItems={createSubItems}
                              showEditButton={true}
                              showMoveToNextButton={item.assignedTo === 'photographer'}
                              showCreateSubItemsButton={user?.role === 'photographer' && item.status === 'photography'}
                              userRole="photographer"
                            />
                          </div>
                          {itemSubItems.length > 0 && (
                            <div className="ml-8 mt-4 pl-4 border-l-4 border-purple-300">
                              <div className="flex items-center gap-2 mb-3">
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                  📦 {itemSubItems.length} Sub-Items
                                </Badge>
                              </div>
                              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {itemSubItems.map((subItem) => (
                                  <ItemCard
                                    key={subItem.id}
                                    item={subItem}
                                    onEdit={startEditing}
                                    onViewOriginal={(item) => {
                                      const url = item.url || (item as any).url_main;
                                      if (url) {
                                        window.open(url, '_blank');
                                      } else {
                                        toast.error('No URL available for this item');
                                      }
                                    }}
                                    onMoveToNext={moveToNextStatus}
                                    onCreateSubItems={createSubItems}
                                    showEditButton={true}
                                    showMoveToNextButton={subItem.assignedTo === 'photographer'}
                                    showCreateSubItemsButton={false}
                                    userRole="photographer"
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Editing Modal */}
        {editingItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={cancelEdit}>
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Edit Photography Details</h3>
                <Button variant="outline" size="sm" onClick={cancelEdit}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                {/* Multiple Items Section */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Multiple Items</h4>
                  <div className="flex items-center space-x-2 mb-3">
                    <input
                      type="checkbox"
                      id="isMultipleItems"
                      checked={editForm.isMultipleItems || false}
                      onChange={(e) => setEditForm(prev => ({ ...prev, isMultipleItems: e.target.checked }))}
                      className="rounded"
                    />
                    <label htmlFor="isMultipleItems" className="text-sm">
                      This item contains multiple items
                    </label>
                  </div>
                  {editForm.isMultipleItems && (
                    <div className="ml-6">
                      <label className="block text-sm font-medium mb-1">Number of items:</label>
                      <Input
                        type="number"
                        min="1"
                        value={editForm.multipleItemsCount || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, multipleItemsCount: parseInt(e.target.value) || 1 }))}
                        onFocus={(e) => e.target.select()}
                        placeholder="1"
                        className="w-32"
                      />
                    </div>
                  )}
                </div>

                {/* Image Upload Section */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Photography Images</h4>

                  {/* Image Upload Component */}
                  <div className="mb-4">
                    <ImageUpload
                      onImageUploaded={handleImageUpload}
                      onImagesUploaded={handleImagesUpload}
                      onMainImageSelected={handleMainImageSelected}
                      multiple={true}
                      allowMainImageSelection={true}
                    />
                  </div>

                  {/* Manual URL Input */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Add Image URL:</label>
                    <div className="flex gap-2">
                      <Input
                        value={newImageUrl}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                        placeholder="https://example.com/image.jpg"
                        className="flex-1"
                      />
                      <Button onClick={() => addImage(editingItem)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Current Images */}
                  {editForm.photographerImages && editForm.photographerImages.length > 0 && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium">Current Images:</label>
                      <div className="grid grid-cols-2 gap-2">
                        {editForm.photographerImages.map((imageUrl, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={imageUrl}
                              alt={`Photography ${index + 1}`}
                              className="w-full h-24 object-cover rounded border"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeImageFromForm(imageUrl)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Photographer Notes Section */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Photographer Notes</h4>
                  <Textarea
                    value={editForm.photographerNotes || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, photographerNotes: e.target.value }))}
                    placeholder="Add any notes about the photography..."
                    rows={3}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={() => saveEdit(editingItem)} className="flex-1">
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={cancelEdit} className="flex-1">
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}