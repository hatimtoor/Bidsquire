'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ExternalLink, Image, Calendar, Tag, DollarSign, RefreshCw, Plus, ArrowRight, FileText, Search, Edit3, Save, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '@/components/layout/navbar';
import ItemCard from '@/components/ItemCard';
import { dataStore } from '@/services/dataStore'; // still used for getDashboardStats
import { AuctionItem } from '@/types/auction';
import { useAuctionItems } from '@/hooks/queries';
import { useUpdateItem, useDeleteItem, useMoveItem } from '@/hooks/mutations';

export default function ResearcherPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AuctionItem>>({});
  const [activeTab, setActiveTab] = useState('research');

  const { data: allItems = [], isLoading: isLoadingData, refetch } = useAuctionItems(user?.id, user?.role);
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const moveItem = useMoveItem();

  const [aiResearchingItemId, setAiResearchingItemId] = useState<string | null>(null);

  const runAiResearch = async (itemId: string) => {
    setAiResearchingItemId(itemId);
    try {
      const response = await fetch('/api/webhook/send-ai-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      });
      const data = await response.json();

      if (response.status === 402) {
        toast.error('Not enough credits for AI research. You need at least 1 credit.');
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'AI research failed.');
        return;
      }

      if (data.research) {
        // Synchronous response — fields already saved, update the edit form
        const item = allItems.find(i => i.id === itemId);
        if (item) {
          startEditing({ ...item, ...data.research });
        }
        toast.success(`AI research complete! ${data.ebayResultsFound > 0 ? `Found ${data.ebayResultsFound} comparable eBay listings.` : 'Estimated from AI knowledge.'} 1 credit used.`);
        refetch();
      } else {
        toast.success('AI research submitted. Results will appear shortly — refresh in a few seconds.');
      }
    } catch (error) {
      toast.error('Failed to connect to AI research service.');
    } finally {
      setAiResearchingItemId(null);
    }
  };

  // Check authentication
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    } else if (user && user.role !== 'researcher') {
      router.push('/');
    }
  }, [user, isLoading, router]);

  // Filter to researcher items, then apply search term
  const items = useMemo(() => {
    const researcherItems = allItems.filter(item => item.assignedTo === 'researcher');
    if (!searchTerm.trim()) return researcherItems;
    const term = searchTerm.toLowerCase();
    return researcherItems.filter(item =>
      item.itemName?.toLowerCase().includes(term) ||
      item.description?.toLowerCase().includes(term) ||
      item.category?.toLowerCase().includes(term) ||
      item.auctionName?.toLowerCase().includes(term)
    );
  }, [allItems, searchTerm]);

  const startEditing = (item: AuctionItem) => {
    setEditingItem(item.id);
    setEditForm({
      itemName: item.itemName,
      description: item.description,
      category: item.category,
      researcherEstimate: item.researcherEstimate,
      researcherDescription: item.researcherDescription,
      referenceUrls: item.referenceUrls,
      similarUrls: item.similarUrls || [],
      priority: item.priority,
      notes: item.notes
    });
  };

  const saveEdit = async (itemId: string) => {
    updateItem.mutate(
      { id: itemId, updates: editForm },
      {
        onSuccess: () => {
          setEditingItem(null);
          setEditForm({});
        },
        onError: (error) => console.error('Error saving item:', error),
      }
    );
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditForm({});
  };

  const addSimilarUrl = () => {
    const currentUrls = editForm.similarUrls || [];
    if (currentUrls.length < 10) {
      setEditForm({
        ...editForm,
        similarUrls: [...currentUrls, '']
      });
    }
  };

  const updateSimilarUrl = (index: number, url: string) => {
    const currentUrls = editForm.similarUrls || [];
    const updatedUrls = [...currentUrls];
    updatedUrls[index] = url;
    setEditForm({
      ...editForm,
      similarUrls: updatedUrls
    });
  };

  const removeSimilarUrl = (index: number) => {
    const currentUrls = editForm.similarUrls || [];
    const updatedUrls = currentUrls.filter((_, i) => i !== index);
    setEditForm({
      ...editForm,
      similarUrls: updatedUrls
    });
  };

  const moveToNextStatus = (itemId: string) => {
    moveItem.mutate(
      { itemId, userId: user?.id || '', userName: user?.name || '' },
      { onError: () => toast.error('Failed to move item forward.') }
    );
  };

  const handleDeleteItem = (itemId: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      deleteItem.mutate(itemId);
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

  // Show access denied if not researcher
  if (user && user.role !== 'researcher') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don&apos;t have permission to access the researcher dashboard.</p>
        </div>
      </div>
    );
  }

  // All items are already filtered to researcher role, so use them directly
  const stats = dataStore.getDashboardStats(user?.id);

  // Separate items by priority
  const highPriorityItems = items.filter(item => item.priority === 'high');
  const mediumPriorityItems = items.filter(item => item.priority === 'medium' || !item.priority);
  const lowPriorityItems = items.filter(item => item.priority === 'low');

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Research Dashboard</h1>
          <p className="text-gray-600">Research auction items and prepare them for the next workflow stage</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <FileText className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Research Items</CardTitle>
              <Search className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.research}</div>
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

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle>Search Items</CardTitle>
            <CardDescription>
              Search through research items by name, description, category, or auction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  refetch();
                }}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Dashboard Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="research">All Research Items</TabsTrigger>
            <TabsTrigger value="completed">Completed Research</TabsTrigger>
          </TabsList>

          {/* Research Items Tab */}
          <TabsContent value="research" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-900">All Research Items</h2>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{items.length} items</Badge>
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
            ) : items.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No research items</h3>
                  <p className="text-gray-600">
                    All items have been researched or there are no items in the research stage.
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
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {highPriorityItems.map((item) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          onEdit={startEditing}
                          onViewOriginal={(item) => {
                            const url = item.url || item.url_main || (item as any).url_main;
                            console.log('View Original clicked for item:', item.itemName, 'URL:', url);
                            if (url) {
                              window.open(url, '_blank');
                            } else {
                              toast.error(`No URL available for item: ${item.itemName}\nAvailable fields: url=${item.url}, url_main=${item.url_main}`);
                            }
                          }}
                          onMoveToNext={moveToNextStatus}
                          onAiResearch={runAiResearch}
                          isAiResearching={aiResearchingItemId === item.id}
                          showEditButton={true}
                          showMoveToNextButton={item.status === 'research'}
                          showAiResearchButton={item.status === 'research'}
                          userRole="researcher"
                        />
                      ))}
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
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {mediumPriorityItems.map((item) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          onEdit={startEditing}
                          onViewOriginal={(item) => {
                            const url = item.url || item.url_main || (item as any).url_main;
                            console.log('View Original clicked for item:', item.itemName, 'URL:', url);
                            if (url) {
                              window.open(url, '_blank');
                            } else {
                              toast.error(`No URL available for item: ${item.itemName}\nAvailable fields: url=${item.url}, url_main=${item.url_main}`);
                            }
                          }}
                          onMoveToNext={moveToNextStatus}
                          onAiResearch={runAiResearch}
                          isAiResearching={aiResearchingItemId === item.id}
                          showEditButton={true}
                          showMoveToNextButton={item.status === 'research'}
                          showAiResearchButton={item.status === 'research'}
                          userRole="researcher"
                        />
                      ))}
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
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {lowPriorityItems.map((item) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          onEdit={startEditing}
                          onViewOriginal={(item) => {
                            const url = item.url || item.url_main || (item as any).url_main;
                            console.log('View Original clicked for item:', item.itemName, 'URL:', url);
                            if (url) {
                              window.open(url, '_blank');
                            } else {
                              toast.error(`No URL available for item: ${item.itemName}\nAvailable fields: url=${item.url}, url_main=${item.url_main}`);
                            }
                          }}
                          onMoveToNext={moveToNextStatus}
                          onAiResearch={runAiResearch}
                          isAiResearching={aiResearchingItemId === item.id}
                          showEditButton={true}
                          showMoveToNextButton={item.status === 'research'}
                          showAiResearchButton={item.status === 'research'}
                          userRole="researcher"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Completed Research Tab */}
          <TabsContent value="completed" className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">Completed Research</h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.filter(item => item.status !== 'research' && item.assignedTo === 'researcher').map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onViewOriginal={(item) => {
                    const url = item.url || item.url_main || (item as any).url_main;
                    console.log('View Original clicked for item:', item.itemName, 'URL:', url);
                    if (url) {
                      window.open(url, '_blank');
                    } else {
                      toast.error(`No URL available for item: ${item.itemName}\nAvailable fields: url=${item.url}, url_main=${item.url_main}`);
                    }
                  }}
                  userRole="researcher"
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setEditingItem(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Research Item</h3>
              <Button variant="outline" size="sm" onClick={() => setEditingItem(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Item Name */}
              <div>
                <label className="block text-sm font-medium mb-1">Item Name *</label>
                <Input
                  value={editForm.itemName || ''}
                  onChange={(e) => setEditForm({ ...editForm, itemName: e.target.value })}
                  className="w-full"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium mb-1">Category *</label>
                <Input
                  value={editForm.category || ''}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Textarea
                  value={editForm.description || ''}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full"
                />
              </div>

              {/* Researcher Estimate */}
              <div>
                <label className="block text-sm font-medium mb-1">Researcher Estimate</label>
                <Input
                  value={editForm.researcherEstimate || ''}
                  onChange={(e) => setEditForm({ ...editForm, researcherEstimate: e.target.value })}
                  placeholder="e.g., $100 - $200"
                  className="w-full"
                />
              </div>

              {/* Researcher Description */}
              <div>
                <label className="block text-sm font-medium mb-1">Research Notes</label>
                <Textarea
                  value={editForm.researcherDescription || ''}
                  onChange={(e) => setEditForm({ ...editForm, researcherDescription: e.target.value })}
                  rows={4}
                  placeholder="Add your research findings, condition notes, market analysis..."
                  className="w-full"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <Select
                  value={editForm.priority || 'medium'}
                  onValueChange={(value) => setEditForm({ ...editForm, priority: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reference URLs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Reference URLs</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const currentUrls = editForm.referenceUrls || [];
                      if (currentUrls.length < 10) {
                        setEditForm({
                          ...editForm,
                          referenceUrls: [...currentUrls, '']
                        });
                      }
                    }}
                    disabled={(editForm.referenceUrls || []).length >= 10}
                    className="text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add URL ({(editForm.referenceUrls || []).length}/10)
                  </Button>
                </div>

                <div className="space-y-2">
                  {(editForm.referenceUrls || []).map((url, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        placeholder={`Reference URL ${index + 1}`}
                        value={url}
                        onChange={(e) => {
                          const currentUrls = editForm.referenceUrls || [];
                          const updatedUrls = [...currentUrls];
                          updatedUrls[index] = e.target.value;
                          setEditForm({ ...editForm, referenceUrls: updatedUrls });
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const currentUrls = editForm.referenceUrls || [];
                          const updatedUrls = currentUrls.filter((_, i) => i !== index);
                          setEditForm({ ...editForm, referenceUrls: updatedUrls });
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Similar URLs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Similar Items URLs</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const currentUrls = editForm.similarUrls || [];
                      if (currentUrls.length < 10) {
                        setEditForm({
                          ...editForm,
                          similarUrls: [...currentUrls, '']
                        });
                      }
                    }}
                    disabled={(editForm.similarUrls || []).length >= 10}
                    className="text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add URL ({(editForm.similarUrls || []).length}/10)
                  </Button>
                </div>

                <div className="space-y-2">
                  {(editForm.similarUrls || []).map((url, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        placeholder={`Similar item URL ${index + 1}`}
                        value={url}
                        onChange={(e) => {
                          const currentUrls = editForm.similarUrls || [];
                          const updatedUrls = [...currentUrls];
                          updatedUrls[index] = e.target.value;
                          setEditForm({ ...editForm, similarUrls: updatedUrls });
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const currentUrls = editForm.similarUrls || [];
                          const updatedUrls = currentUrls.filter((_, i) => i !== index);
                          setEditForm({ ...editForm, similarUrls: updatedUrls });
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={() => saveEdit(editingItem)} className="flex-1">
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setEditingItem(null)} className="flex-1">
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}