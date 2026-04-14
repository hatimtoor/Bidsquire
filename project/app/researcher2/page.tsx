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
import { Loader2, ExternalLink, Image, Calendar, Tag, DollarSign, RefreshCw, Plus, ArrowRight, Users, Edit3, Save, X, FileText, Search, Trash2, Award } from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '@/components/layout/navbar';
import ItemCard from '@/components/ItemCard';
import { AuctionItem } from '@/types/auction';
import { useAuctionItems } from '@/hooks/queries';
import { useUpdateItem, useDeleteItem, useMoveItem } from '@/hooks/mutations';

export default function Researcher2Page() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AuctionItem>>({});
  const [activeTab, setActiveTab] = useState('research2');
  const [isEbayDraftModalOpen, setIsEbayDraftModalOpen] = useState(false);
  const [selectedItemForDraft, setSelectedItemForDraft] = useState<AuctionItem | null>(null);
  const [ebayDraft, setEbayDraft] = useState({
    title: '',
    description: '',
    condition: 'Used',
    listingType: 'auction' as 'auction' | 'fixed',
    startingPrice: '',
    fixedPrice: '',
    categoryId: '',
    categoryId2: '',
    categoryId3: ''
  });

  const { data: allItems = [], isLoading: isLoadingData, refetch } = useAuctionItems(user?.id, user?.role);
  const updateItem = useUpdateItem();
  const deleteItemMutation = useDeleteItem();
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
    } else if (user && user.role !== 'researcher2') {
      router.push('/');
    }
  }, [user, isLoading, router]);

  // Filter to researcher2 items, then apply search term
  const items = useMemo(() => {
    const research2Items = allItems.filter(item => item.assignedTo === 'researcher2');
    if (!searchTerm.trim()) return research2Items;
    const term = searchTerm.toLowerCase();
    return research2Items.filter(item =>
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
      notes: item.notes,
      priority: item.priority,
      similarUrls: item.similarUrls || []
    });
  };

  const saveEdit = (itemId: string) => {
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
      {
        onError: (error: any) => {
          if (error?.error === 'INSUFFICIENT_CREDITS') {
            toast.error('Insufficient credits to complete this stage. Please ask your admin to top up.');
          } else {
            toast.error('Failed to move item forward.');
          }
        },
      }
    );
  };

  const createEbayDraft = (item: AuctionItem) => {
    setSelectedItemForDraft(item);
    // Pre-fill from existing finalData if researcher2 already submitted a draft
    const existing = item.finalData as any;
    setEbayDraft({
      title: existing?.title || item.itemName || '',
      description: existing?.description || item.researcherDescription || item.description || '',
      condition: existing?.condition || 'Used',
      listingType: (existing?.listingType as 'auction' | 'fixed') || 'auction',
      startingPrice: existing?.startingPrice || item.researcherEstimate || '',
      fixedPrice: existing?.fixedPrice || '',
      categoryId: existing?.categoryId || '',
      categoryId2: existing?.categoryId2 || '',
      categoryId3: existing?.categoryId3 || '',
    });
    setIsEbayDraftModalOpen(true);
  };

  const submitEbayDraft = async () => {
    if (!selectedItemForDraft) return;

    try {
      // Create the eBay listing draft
      const draftData = {
        itemId: selectedItemForDraft.id,
        title: ebayDraft.title,
        description: ebayDraft.description,
        condition: ebayDraft.condition,
        listingType: ebayDraft.listingType,
        startingPrice: ebayDraft.listingType === 'auction' ? ebayDraft.startingPrice : '',
        fixedPrice: ebayDraft.listingType === 'fixed' ? ebayDraft.fixedPrice : '',
        categoryId: ebayDraft.categoryId,
        categoryId2: ebayDraft.categoryId2,
        categoryId3: ebayDraft.categoryId3,
        images: selectedItemForDraft.photographerImages || selectedItemForDraft.images || [],
        mainImage: selectedItemForDraft.mainImageUrl || (selectedItemForDraft.images && selectedItemForDraft.images[0]) || '',
        status: 'pending_approval',
        createdBy: user?.id,
        createdAt: new Date()
      };

      // Update item with draft data and move to admin_review for approval
      updateItem.mutate({
        id: selectedItemForDraft.id,
        updates: {
          status: 'admin_review',
          finalData: draftData,
          notes: `eBay listing draft created by ${user?.name} on ${new Date().toLocaleDateString()}`
        }
      });

      toast.success('Draft submitted for admin approval!');
      setIsEbayDraftModalOpen(false);
      setSelectedItemForDraft(null);
    } catch (error) {
      console.error('Error creating eBay draft:', error);
      toast.error('Error creating eBay draft. Please try again.');
    }
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

  // Show access denied if not researcher2
  if (user && user.role !== 'researcher2') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don&apos;t have permission to access the researcher2 dashboard.</p>
        </div>
      </div>
    );
  }

  // All items are already filtered to researcher2 role, so use them directly
  const myAssignedItems = items; // All items shown are assigned to researcher2 role
  const stats = {
    total: items.length,
    research2: items.filter(i => i.status === 'research2').length,
    myItems: items.filter(i => i.assignedTo === user?.id).length,
    overdue: 0,
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Research 2 Dashboard</h1>
          <p className="text-gray-600">Secondary research and final preparation for auction items</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Research 2 Items</CardTitle>
              <FileText className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.research2}</div>
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
              Search through research2 items by name, description, category, or auction
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="research2">Research 2 Items</TabsTrigger>
            <TabsTrigger value="assigned">My Assigned Items</TabsTrigger>
            <TabsTrigger value="completed">Completed Research 2</TabsTrigger>
          </TabsList>

          {/* Research 2 Items Tab */}
          <TabsContent value="research2" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-900">Research 2 Items</h2>
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
                  <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No research2 items</h3>
                  <p className="text-gray-600">
                    All items have been completed or there are no items in the research2 stage.
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
                            const url = item.url || (item as any).url_main;
                            if (url) {
                              window.open(url, '_blank');
                            } else {
                              toast.error('No URL available for this item');
                            }
                          }}
                          onMoveToNext={moveToNextStatus}
                          onAiResearch={runAiResearch}
                          isAiResearching={aiResearchingItemId === item.id}
                          showEditButton={true}
                          showMoveToNextButton={item.status === 'research2'}
                          showAiResearchButton={true}
                          userRole="researcher2"
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
                            const url = item.url || (item as any).url_main;
                            if (url) {
                              window.open(url, '_blank');
                            } else {
                              toast.error('No URL available for this item');
                            }
                          }}
                          onMoveToNext={moveToNextStatus}
                          onAiResearch={runAiResearch}
                          isAiResearching={aiResearchingItemId === item.id}
                          showEditButton={true}
                          showMoveToNextButton={item.status === 'research2'}
                          showAiResearchButton={true}
                          userRole="researcher2"
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
                            const url = item.url || (item as any).url_main;
                            if (url) {
                              window.open(url, '_blank');
                            } else {
                              toast.error('No URL available for this item');
                            }
                          }}
                          onMoveToNext={moveToNextStatus}
                          onAiResearch={runAiResearch}
                          isAiResearching={aiResearchingItemId === item.id}
                          showEditButton={true}
                          showMoveToNextButton={item.status === 'research2'}
                          showAiResearchButton={true}
                          userRole="researcher2"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* My Assigned Items Tab */}
          <TabsContent value="assigned" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-900">My Assigned Items</h2>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{myAssignedItems.length} items</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {myAssignedItems.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Tag className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No assigned items</h3>
                  <p className="text-gray-600">
                    You haven&apos;t been assigned any items yet. Assign items to yourself from the research2 tab.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {myAssignedItems.map((item) => (
                  <Card key={item.id} className="overflow-hidden">
                    {(item.mainImageUrl || (item.images && item.images.length > 0) || (item.photographerImages && item.photographerImages.length > 0)) && (
                      <div className="h-32 overflow-hidden rounded-t-lg">
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
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{item.itemName}</CardTitle>
                          <CardDescription>
                            {item.auctionName} - {item.lotNumber}
                          </CardDescription>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Badge className={getStatusColor(item.status)}>
                            {item.status}
                          </Badge>
                          {item.priority && (
                            <Badge variant="outline" className={getPriorityColor(item.priority)}>
                              {item.priority}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {editingItem === item.id ? (
                        // Edit Form
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium">Item Name</label>
                              <Input
                                value={editForm.itemName || ''}
                                onChange={(e) => setEditForm({ ...editForm, itemName: e.target.value })}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Category</label>
                              <Input
                                value={editForm.category || ''}
                                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                className="mt-1"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium">Description</label>
                            <Textarea
                              value={editForm.description || ''}
                              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                              className="mt-1"
                              rows={3}
                            />
                          </div>

                          <div>
                            <label className="text-sm font-medium">Priority</label>
                            <Select
                              value={editForm.priority || 'medium'}
                              onValueChange={(value) => setEditForm({ ...editForm, priority: value as any })}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <label className="text-sm font-medium">Research 2 Notes</label>
                            <Textarea
                              value={editForm.notes || ''}
                              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                              className="mt-1"
                              rows={3}
                              placeholder="Add your secondary research notes, final recommendations..."
                            />
                          </div>

                          {/* Similar URLs Section */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-medium">Similar Items URLs</label>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addSimilarUrl}
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
                                    onChange={(e) => updateSimilarUrl(index, e.target.value)}
                                    className="flex-1"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeSimilarUrl(index)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                  {url && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => window.open(url, '_blank')}
                                      className="text-blue-600 hover:text-blue-700"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              ))}

                              {(editForm.similarUrls || []).length === 0 && (
                                <p className="text-xs text-gray-500 italic">
                                  Add URLs of similar items to help with final research and pricing
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button onClick={() => saveEdit(item.id)}>
                              <Save className="mr-2 h-4 w-4" />
                              Save Changes
                            </Button>
                            <Button variant="outline" onClick={cancelEdit}>
                              <X className="mr-2 h-4 w-4" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // Display Mode
                        <div className="space-y-3">
                          <p className="text-sm text-gray-600">{item.description}</p>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Category:</span> {item.category}
                            </div>
                            <div>
                              <span className="font-medium">Estimate:</span> {item.auctionSiteEstimate || 'N/A'}
                            </div>
                            <div>
                              <span className="font-medium">Created:</span> {item.createdAt ? formatDate(item.createdAt.toString()) : 'N/A'}
                            </div>
                            <div>
                              <span className="font-medium">Updated:</span> {item.updatedAt ? formatDate(item.updatedAt.toString()) : 'N/A'}
                            </div>
                          </div>

                          {item.researcherEstimate && (
                            <div>
                              <span className="text-sm font-medium text-green-700">Researcher Estimate: </span>
                              <span className="text-sm text-green-600">{item.researcherEstimate}</span>
                            </div>
                          )}

                          {item.photographerImages && item.photographerImages.length > 0 && (
                            <div>
                              <span className="text-sm font-medium text-purple-700">Photography Images: </span>
                              <span className="text-sm text-purple-600">{item.photographerImages.length}</span>
                            </div>
                          )}

                          {item.isMultipleItems && (
                            <div className="bg-purple-50 p-2 rounded border-l-2 border-purple-400">
                              <div className="text-sm">
                                <span className="font-medium text-purple-700">📦 Multiple Items: </span>
                                <span className="text-purple-600">{item.multipleItemsCount || 1} pieces in this lot</span>
                              </div>
                            </div>
                          )}

                          {item.notes && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-gray-700">Notes:</p>
                              <p className="text-sm text-gray-600">{item.notes}</p>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => startEditing(item)}
                            >
                              <Edit3 className="mr-2 h-4 w-4" />
                              Edit Research 2
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
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
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteItemMutation.mutate(item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Move to Next Status Button */}
                      {item.status === 'research2' && (
                        <div className="pt-4 border-t">
                          <Button
                            className="w-full"
                            onClick={() => moveToNextStatus(item.id)}
                          >
                            <ArrowRight className="mr-2 h-4 w-4" />
                            Complete Research 2 & Finalize Item
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Completed Research 2 Tab */}
          <TabsContent value="completed" className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">Completed Research 2</h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.filter(item => item.status !== 'research2' && item.assignedTo === 'researcher2').map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onViewOriginal={(item) => {
                    const url = item.url || (item as any).url_main;
                    if (url) {
                      window.open(url, '_blank');
                    } else {
                      toast.error('No URL available for this item');
                    }
                  }}
                  userRole="researcher2"
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* eBay Listing Draft Modal */}
      {isEbayDraftModalOpen && selectedItemForDraft && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setIsEbayDraftModalOpen(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create eBay Listing Draft</h3>
              <Button variant="outline" size="sm" onClick={() => setIsEbayDraftModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Item Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Item: {selectedItemForDraft.itemName}</h4>
                <p className="text-sm text-gray-600">{selectedItemForDraft.auctionName} - Lot {selectedItemForDraft.lotNumber}</p>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-1">Listing Title *</label>
                <Input
                  value={ebayDraft.title}
                  onChange={(e) => setEbayDraft(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter eBay listing title"
                  className="w-full"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1">Description *</label>
                <Textarea
                  value={ebayDraft.description}
                  onChange={(e) => setEbayDraft(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter detailed description"
                  rows={4}
                  className="w-full"
                />
              </div>

              {/* Condition */}
              <div>
                <label className="block text-sm font-medium mb-1">Condition *</label>
                <Select
                  value={ebayDraft.condition}
                  onValueChange={(value) => setEbayDraft(prev => ({ ...prev, condition: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Used">Used</SelectItem>
                    <SelectItem value="For parts or not working">For parts or not working</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Listing Type */}
              <div>
                <label className="block text-sm font-medium mb-1">Listing Type *</label>
                <Select
                  value={ebayDraft.listingType}
                  onValueChange={(value) => setEbayDraft(prev => ({ ...prev, listingType: value as 'auction' | 'fixed' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auction">Auction</SelectItem>
                    <SelectItem value="fixed">Fixed Price</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Price */}
              {ebayDraft.listingType === 'auction' ? (
                <div>
                  <label className="block text-sm font-medium mb-1">Starting Price *</label>
                  <Input
                    value={ebayDraft.startingPrice}
                    onChange={(e) => setEbayDraft(prev => ({ ...prev, startingPrice: e.target.value }))}
                    placeholder="Enter starting price (e.g., 10.00)"
                    className="w-full"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">Fixed Price *</label>
                  <Input
                    value={ebayDraft.fixedPrice}
                    onChange={(e) => setEbayDraft(prev => ({ ...prev, fixedPrice: e.target.value }))}
                    placeholder="Enter fixed price (e.g., 25.00)"
                    className="w-full"
                  />
                </div>
              )}

              {/* Category IDs */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Primary Category ID</label>
                  <Input
                    value={ebayDraft.categoryId}
                    onChange={(e) => setEbayDraft(prev => ({ ...prev, categoryId: e.target.value }))}
                    placeholder="e.g., 12345"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Secondary Category ID</label>
                  <Input
                    value={ebayDraft.categoryId2}
                    onChange={(e) => setEbayDraft(prev => ({ ...prev, categoryId2: e.target.value }))}
                    placeholder="e.g., 12346"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tertiary Category ID</label>
                  <Input
                    value={ebayDraft.categoryId3}
                    onChange={(e) => setEbayDraft(prev => ({ ...prev, categoryId3: e.target.value }))}
                    placeholder="e.g., 12347"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={submitEbayDraft} className="flex-1">
                  <Award className="mr-2 h-4 w-4" />
                  Create Draft & Send for Approval
                </Button>
                <Button variant="outline" onClick={() => setIsEbayDraftModalOpen(false)} className="flex-1">
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setEditingItem(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Research 2 Item</h3>
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

              {/* Research 2 Notes */}
              <div>
                <label className="block text-sm font-medium mb-1">Research 2 Notes</label>
                <Textarea
                  value={editForm.notes || ''}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={4}
                  placeholder="Add your secondary research notes, final recommendations..."
                  className="w-full"
                />
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