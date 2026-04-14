'use client';
// Force refresh

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ExternalLink, Image, Calendar, Tag, DollarSign, RefreshCw, Plus, ArrowRight, Users, FileText, Camera, Award, Trash2, X, Edit3, CheckCircle, Save, Zap, Clock, CreditCard, AlertTriangle } from 'lucide-react';
// Navbar removed

import { dataStore } from '@/services/dataStore';
import { AuctionItem, UserAccount, CreditBalance } from '@/types/auction';
import { useAuctionItems, useCreditBalance } from '@/hooks/queries';
import { useUpdateItem, useDeleteItem, useMoveItem } from '@/hooks/mutations';
import { validateUrl } from '@/utils/urlValidation';
import { toast } from 'sonner';
import WorkflowTab from './components/WorkflowTab';
import FinalizedTab from './components/FinalizedTab';
import OverviewTab from './components/OverviewTab';
import { getStatusColor, getStatusIcon } from './components/statusUtils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [urls, setUrls] = useState<string[]>(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('workflow');
  const [error, setError] = useState('');

  // Image Gallery Modal State
  const [selectedItem, setSelectedItem] = useState<AuctionItem | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);



  // React Query — items and credits
  const { data: auctionItems = [], isLoading: isLoadingData, refetch: refetchItems } = useAuctionItems(user?.id, user?.role);
  const { data: creditBalance, refetch: refetchCredits } = useCreditBalance(user?.id);
  const updateItem = useUpdateItem();
  const deleteItemMutation = useDeleteItem();
  const moveItemMutation = useMoveItem();

  // Manual Item Creation Modal State
  const [isManualItemModalOpen, setIsManualItemModalOpen] = useState(false);
  const [manualItemForm, setManualItemForm] = useState({
    itemName: '',
    description: '',
    category: '',
    auctionName: '',
    lotNumber: '',
    auctionSiteEstimate: '',
    url: '',
    urlMain: '',
    priority: 'medium' as 'high' | 'medium' | 'low',
    assignedTo: 'photographer' as 'admin' | 'researcher' | 'researcher2' | 'photographer'
  });

  // eBay Draft Modal State
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

  // Finalized Item Edit State
  const [isEditFinalizedModalOpen, setIsEditFinalizedModalOpen] = useState(false);
  const [editingFinalizedItem, setEditingFinalizedItem] = useState<AuctionItem | null>(null);
  const [finalizedEditForm, setFinalizedEditForm] = useState<Partial<AuctionItem>>({});
  // Research 2 Confirmation State
  const [isConfirmResearch2Open, setIsConfirmResearch2Open] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ itemId: string, cost: number, isForwardTransition: boolean } | null>(null);

  const confirmResearch2Change = async () => {
    if (!pendingStatusChange) return;

    try {
      console.log('✅ Confirmed Research 2 change. Proceeding with status update...');
      const { itemId, isForwardTransition } = pendingStatusChange;

      let success = false;
      if (isForwardTransition) {
        // Forward transition: use moveItemToNextStatus (photography -> research2)
        const result = await dataStore.moveItemToNextStatus(itemId, user?.id || 'admin', user?.name || 'Admin');
        success = result.success;
      } else {
        // Backward/direct transition: use updateItem (finalized -> research2)
        const updatedItem = await dataStore.updateItem(itemId, {
          status: 'research2',
          assignedTo: 'researcher2'
        });
        success = !!updatedItem;
      }

      if (success) {
        toast.success('Item moved to Research 2 stage!');
        refetchItems();
        refetchCredits();
      } else {
        toast.error('Failed to move item to Research 2.');
      }

    } catch (error) {
      console.error('Error confirming Research 2 change:', error);
      toast.error('Failed to update status.');
    } finally {
      setIsConfirmResearch2Open(false);
      setPendingStatusChange(null);
    }
  };

  const changeItemStatus = async (itemId: string, newStatus: AuctionItem['status']) => {
    console.log('🔄 changeItemStatus called:', { itemId, newStatus });
    try {
      const item = dataStore.getItem(itemId);
      console.log('📋 Current item:', item);
      if (!item) {
        toast.error('Item not found.');
        return;
      }

      // Check if this is a valid next stage transition
      const validTransitions: { [key: string]: string } = {
        'research': 'winning',
        'winning': 'photography',
        'photography': 'research2',
        'research2': 'finalized'
      };

      console.log('🔍 Checking transition:', {
        currentStatus: item.status,
        newStatus,
        isValidTransition: validTransitions[item.status] === newStatus
      });

      if (validTransitions[item.status] === newStatus) {
        // Validation for research2
        if (newStatus === 'research2') {
          // Always prompt for Research 2
          const cost = creditBalance?.research2Cost || 2;

          if (creditBalance && !user?.isTrial) {
            if (creditBalance.currentCredits < cost) {
              toast.error('Insufficient credits to set status to Research 2.', { description: `Requires ${cost} credits.` });
              return;
            }
          }

          setPendingStatusChange({ itemId, cost, isForwardTransition: true });
          setIsConfirmResearch2Open(true);
          return;
        }

        console.log('✅ Using moveItemToNextStatus for valid transition');
        // Use moveItemToNextStatus for valid transitions (with auto-assignment)
        const { success, error } = await dataStore.moveItemToNextStatus(itemId, user?.id || 'admin', user?.name || 'Admin');
        if (success) {
          toast.success('Item moved to next stage with auto-assignment!');
          refetchItems();
          refetchCredits();
        } else if (error === 'INSUFFICIENT_CREDITS') {
          toast.error('Insufficient credits. Please top up to continue.');
        } else {
          toast.error('Failed to move item to next stage.');
        }
      } else {
        console.log('🔄 Using direct update for status change');
        // For other status changes, check if we need auto-assignment
        let updateData: Partial<AuctionItem> = { status: newStatus };

        // Auto-assign photographer role when admin sets status to photography
        if (newStatus === 'photography') {
          updateData.assignedTo = 'photographer';
          console.log('🎯 Admin setting status to photography - auto-assigning to photographer role');
        }
        // Auto-assign researcher2 role when admin sets status to research2
        else if (newStatus === 'research2') {
          // Backward or direct transition to research2 (e.g., finalized -> research2)
          const cost = creditBalance?.research2Cost || 2;

          if (creditBalance && !user?.isTrial) {
            if (creditBalance.currentCredits < cost) {
              toast.error(`Insufficient credits to set status to Research 2. Requires ${cost} credits.`);
              return;
            }
          }

          // Show confirmation dialog with backward transition flag
          setPendingStatusChange({ itemId, cost, isForwardTransition: false });
          setIsConfirmResearch2Open(true);
          return;
        }
        // Auto-assign researcher role when admin sets status to research
        else if (newStatus === 'research') {
          updateData.assignedTo = 'researcher';
          console.log('🎯 Admin setting status to research - auto-assigning to researcher role');
        }

        console.log('📤 Update data being sent:', updateData);
        const updatedItem = await dataStore.updateItem(itemId, updateData);
        console.log('📥 Update result:', updatedItem);

        if (updatedItem) {
          const assignmentNote = updateData.assignedTo ? ` and auto-assigned to ${updateData.assignedTo} role` : '';
          toast.success(`Item status changed to ${newStatus}${assignmentNote}!`);
          refetchItems();
        } else {
          toast.error('Failed to change item status.');
        }
      }
    } catch (error) {
      console.error('❌ Error changing item status:', error);
      toast.error('Error changing item status.');
    }
  };


  // Purchase Credits State
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  const handlePurchase = async (credits: number, amount: number, expiresInDays?: number) => {
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          credits,
          userId: user?.id,
          expiresInDays
        })
      });

      const data = await response.json();
      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        toast.error('Failed to initiate checkout');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error('Error initiating checkout');
    }
  };

  // Check authentication
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    } else if (user && user.role !== 'admin') {
      router.push('/');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    // Check for success/cancel params from Stripe
    const params = new URLSearchParams(window.location.search);
    if (user && params.get('credit_success') === 'true') {
      const sessionId = params.get('session_id');
      if (sessionId) {
        toast.loading('Verifying payment...', { id: 'verify-payment' });
        fetch('/api/stripe/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        })
          .then(res => res.json())
          .then(data => {
            if (data.status === 'success') {
              toast.success('Credits added successfully!', { id: 'verify-payment' });
              refetchCredits();
            } else if (data.status === 'already_processed') {
              toast.success('Payment verified. Credits added.', { id: 'verify-payment' });
              refetchCredits();
            } else {
              toast.error('Payment verification failed', { id: 'verify-payment' });
            }
          })
          .catch(err => {
            console.error(err);
            toast.error('Error verifying payment', { id: 'verify-payment' });
          });
      } else {
        toast.success('Payment successful! Credits will appear shortly.');
        refetchCredits();
      }
      // Clean URL
      window.history.replaceState({}, '', '/admin');
    } else if (params.get('credit_canceled') === 'true') {
      toast.error('Credit purchase canceled');
      window.history.replaceState({}, '', '/admin');
    }
  }, [user]);

  // Pre-fill URL from query params (New Flow)
  useEffect(() => {
    const prefillUrl = searchParams?.get('prefillUrl');
    if (prefillUrl && urls.length === 1 && !urls[0]) {
      setUrls([prefillUrl]);
      toast.info('Your claimed auction URL is ready. Click "Submit URLs" to process it.');
      router.replace('/admin');
    }
  }, [searchParams]);

  const handleAddUrl = () => {
    setUrls([...urls, '']);
  };

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const handleRemoveUrl = (index: number) => {
    const newUrls = urls.filter((_, i) => i !== index);
    if (newUrls.length === 0) {
      setUrls(['']);
    } else {
      setUrls(newUrls);
    }
  };

  const handleClearUrls = () => {
    setUrls(['']);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Filter and Validate URLs
    const validUrls: string[] = [];
    const invalidUrls: string[] = [];

    urls.forEach(u => {
      const trimmed = u.trim();
      if (!trimmed) return;

      const validation = validateUrl(trimmed);
      if (validation.isValid) {
        validUrls.push(trimmed);
      } else {
        invalidUrls.push(trimmed);
      }
    });

    if (invalidUrls.length > 0) {
      toast.error(`Found ${invalidUrls.length} invalid URLs. They must match allowed patterns.`);
      // Optionally stop submission or just process valid ones?
      // User said "any url that does not fit the pattern won't be processed."
      // So we should probably proceed with valid ones or halt?
      // "restrict our app to only take urls..." usually means reject invalid inputs explicitly.
      // I'll show error and stop if NO valid URLs. If MIXED, I'll warn and maybe stop to let user fix?
      // "any url that does not fit the pattern won't be processed" implies we can process the fitting ones.
      // But for better UX, let's block submission if ANY invalid are present so user knows.
      return;
    }

    if (validUrls.length === 0) return;

    // Check for sufficient credits
    if (creditBalance && !user?.isTrial) {
      const costPerItem = creditBalance.itemFetchCost || 1;
      const totalCost = costPerItem * validUrls.length;

      if (creditBalance.currentCredits < totalCost) {
        toast.error(`Insufficient credits. You need ${totalCost} credits to fetch ${validUrls.length} items. Please purchase more.`);
        return;
      }
    }

    setIsSubmitting(true);
    setIsSubmitting(true);

    try {
      console.log(`=== SUBMITTING ${validUrls.length} URLS TO AI ===`);
      const proxyUrl = '/api/webhook/send-url';

      let successCount = 0;
      let failCount = 0;

      for (let index = 0; index < validUrls.length; index++) {
        const currentUrl = validUrls[index];
        if (index > 0) {
          // Delay between requests
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`Processing URL ${index + 1}/${validUrls.length}:`, currentUrl);

        try {
          const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url_main: currentUrl, adminId: user?.id, adminEmail: user?.email }),
          });

          if (response.ok) {
            // AI responds with processed data on the same webhook
            const responseText = await response.text();
            let proxyResult: any = null;

            if (responseText && responseText.trim()) {
              try {
                proxyResult = JSON.parse(responseText);
              } catch (jsonError) {
                console.warn('Proxy response was not JSON', jsonError);
                proxyResult = { data: responseText };
              }
            }

            // Async pattern: API returns 'processing' status, no data to save immediately
            // Item will be created when n8n calls /api/webhook/receive
            if (proxyResult?.success && proxyResult?.status === 'processing') {
              console.log(`URL submitted for async processing: ${currentUrl}`);
              successCount++;
            } else if (proxyResult?.success) {
              // Fallback for any legacy sync response
              successCount++;
            } else {
              console.error(`Unexpected response for URL: ${currentUrl}`, proxyResult);
              failCount++;
            }

          } else {
            // Attempt to parse error response
            const errorText = await response.text();
            let errorData: any = {};
            try {
              errorData = JSON.parse(errorText);
            } catch (e) {
              errorData = { error: errorText || response.statusText };
            }

            console.error(`❌ [Admin] Submission Failed for URL: ${currentUrl}`);
            console.error('Status:', response.status);
            console.error('Error Details:', errorData);

            // Use the specific error from the API if available
            const errorMessage = errorData.error || `Server error (${response.status})`;
            toast.error(`Failed to submit URL: ${errorMessage}`);

            failCount++;
          }
        } catch (itemError) {
          console.error(`❌ [Admin] Network/Client Error for URL ${currentUrl}:`, itemError);
          toast.error(`Network error submitting URL`);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} URL(s) submitted! Your items are being fetched and will appear in the Item Pipeline once ready.`, {
          duration: 6000,
        });
        setUrls(['']); // Reset to single empty input

        // Refresh credits immediately; items will auto-refresh via React Query stale time
        refetchCredits();

        // Poll for n8n completion every 10s for up to 5 minutes
        const refreshInterval = setInterval(() => refetchItems(), 10_000);
        setTimeout(() => clearInterval(refreshInterval), 300_000);

      } else if (failCount > 0 && successCount === 0) {
        // Only show generic fail toast if we haven't already shown specific toasts in the loop
        // But since we added toasts in the loop, we might not need this final one if it's redundant.
        // However, a summary is nice.
        // Let's rely on the per-item logging above for "why", and just say "Submission failed" here if needed?
        // Or actually, if we showed specific errors above, we don't need a generic one.
        // But if multiple URLs were submitted, a summary is good.
        if (validUrls.length > 1) {
          toast.error(`Batch submission failing. ${failCount} failed.`);
        }
      }

    } catch (error) {
      console.error('Error in batch submission:', error);
      toast.error('Error processing URLs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auction-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...manualItemForm,
          status: 'photography', // Start at photographer stage
          assignedTo: 'photographer',
          images: [],
          photographerImages: [],
          mainImageUrl: null,
          researcherEstimate: null,
          researcherDescription: null,
          referenceUrls: [],
          similarUrls: [],
          photographerQuantity: 1,
          isMultipleItems: false,
          multipleItemsCount: 1,
          finalData: null,
          notes: '',
          tags: [],
          parentItemId: null,
          subItemNumber: null,
          adminId: user?.id, // Add admin ID for item allotment
          adminEmail: user?.email, // Add admin email
          orgId: user?.orgId || null,
          photographerNotes: ''
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('Manual item created successfully! Item has been assigned to photographer.');
        // Reset form
        setManualItemForm({
          itemName: '',
          description: '',
          category: '',
          auctionName: '',
          lotNumber: '',
          auctionSiteEstimate: '',
          url: '',
          urlMain: '',
          priority: 'medium',
          assignedTo: 'photographer'
        });
        setIsManualItemModalOpen(false);
        // Refresh the auction items list
        refetchItems();
      } else {
        toast.error(`Error: ${result.error || 'Failed to create manual item'}`);
      }
    } catch (error) {
      console.error('Error creating manual item:', error);
      toast.error('Error creating manual item. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteAuctionItem = async (itemId: string) => {
    const deleted = await dataStore.deleteItem(itemId);
    if (deleted) {
      toast.success('Auction item deleted successfully!');
      refetchItems();
    } else {
      toast.error('Failed to delete auction item.');
    }
  };

  // Open image gallery modal
  const openImageGallery = (item: AuctionItem) => {
    setSelectedItem(item);
    setIsImageModalOpen(true);
  };

  // Close image gallery modal
  const closeImageGallery = () => {
    setSelectedItem(null);
    setIsImageModalOpen(false);
  };



  const openEditFinalized = (item: AuctionItem) => {
    setEditingFinalizedItem(item);
    setFinalizedEditForm({
      itemName: item.itemName,
      description: item.description,
      category: item.category,
      researcherEstimate: item.researcherEstimate,
      researcherDescription: item.researcherDescription,
      notes: item.notes,
      priority: item.priority,
      finalData: item.finalData
    });
    setIsEditFinalizedModalOpen(true);
  };

  const closeEditFinalized = () => {
    setEditingFinalizedItem(null);
    setFinalizedEditForm({});
    setIsEditFinalizedModalOpen(false);
  };

  const saveFinalizedEdit = async () => {
    if (!editingFinalizedItem) return;

    try {
      await dataStore.updateItem(editingFinalizedItem.id, finalizedEditForm);
      refetchItems();
      closeEditFinalized();
      toast.success('Finalized item updated successfully!');
    } catch (error) {
      console.error('Error updating finalized item:', error);
      toast.error('Error updating finalized item. Please try again.');
    }
  };

  // Send finalized item data to external webhook (eBay integration)
  const sendToExternalWebhook = async (item: AuctionItem) => {
    try {
      console.log('📤 Sending data to external webhook via API route:', item);
      console.log('📸 Photographer images to be sent:', item.photographerImages);

      const response = await fetch('/api/webhook/send-external', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemData: item }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Webhook sent successfully:', result);
        const imageCount = result.imagesSent ?
          ` (${result.imagesSent.photographerImages} photographer images, ${result.imagesSent.originalImages} original images)` : '';
        toast.success(`Item data sent to external webhook successfully!${imageCount}`);
      } else {
        const errorData = await response.json();
        console.error('❌ Webhook failed:', response.status, errorData);
        toast.error(`Failed to send data to webhook: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Error sending to webhook:', error);
      toast.error('Error sending data to webhook. Please check the console.');
    }
  };

  // eBay Draft Functions
  const createEbayDraft = (item: AuctionItem) => {
    setSelectedItemForDraft(item);
    // Pre-fill from researcher2's submitted draft if available
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

  const submitEbayDraft = async (postLive = false) => {
    if (!selectedItemForDraft) return;

    try {
      // Step 1: Create draft on eBay
      const draftResponse = await fetch('/api/ebay/create-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          itemId: selectedItemForDraft.id,
          title: ebayDraft.title,
          description: ebayDraft.description,
          condition: ebayDraft.condition,
          listingType: ebayDraft.listingType,
          startingPrice: ebayDraft.startingPrice,
          fixedPrice: ebayDraft.fixedPrice,
          categoryId: ebayDraft.categoryId || undefined,
        }),
      });

      const draftData = await draftResponse.json();

      if (draftResponse.status === 401 && (draftData.error === 'EBAY_NOT_CONNECTED' || draftData.error === 'EBAY_TOKEN_EXPIRED')) {
        toast.error(draftData.message || 'Connect your eBay account in Profile settings first.');
        setIsEbayDraftModalOpen(false);
        return;
      }

      if (!draftResponse.ok) {
        toast.error(draftData.error || 'Failed to create eBay draft.');
        return;
      }

      // Step 2: Publish live if requested
      if (postLive && draftData.offerId) {
        const publishResponse = await fetch('/api/ebay/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ offerId: draftData.offerId, itemId: selectedItemForDraft.id }),
        });

        const publishData = await publishResponse.json();

        if (!publishResponse.ok) {
          toast.error(publishData.error || 'Draft created but failed to publish live.');
          setIsEbayDraftModalOpen(false);
          refetchItems();
          return;
        }

        toast.success(
          `Listing is now LIVE on eBay!`,
          { duration: 8000 }
        );
      } else {
        toast.success(
          `Draft saved on eBay. Review it in your Seller Hub before publishing.`,
          { duration: 6000 }
        );
      }

      setIsEbayDraftModalOpen(false);
      refetchItems();
    } catch (error) {
      console.error('Error submitting eBay listing:', error);
      toast.error('Error submitting to eBay. Please try again.');
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

  // Show access denied if not admin
  if (user && user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don&apos;t have permission to access the admin dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar removed */}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-gray-900">Bidsquire Admin Dashboard</h1>
            <p className="text-gray-600">Manage auction processing and workflow for bidsquire.com</p>
          </div>
          {creditBalance && (

            <div className="bg-white rounded-xl border p-5 shadow-sm w-full md:w-[320px]">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${creditBalance.currentCredits < ((creditBalance.itemFetchCost || 0) + (creditBalance.research2Cost || 0))
                    ? 'bg-red-100'
                    : 'bg-purple-100'
                    }`}>
                    <Zap className={`h-5 w-5 ${creditBalance.currentCredits < ((creditBalance.itemFetchCost || 0) + (creditBalance.research2Cost || 0))
                      ? 'text-red-600 fill-red-600'
                      : 'text-purple-600 fill-purple-600'
                      }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 leading-tight">Credit Availability</h3>
                    {/* <p className="text-xs text-gray-500">Never expires</p> */}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-2xl font-bold ${creditBalance.currentCredits < ((creditBalance.itemFetchCost || 0) + (creditBalance.research2Cost || 0))
                    ? 'text-red-600'
                    : 'text-gray-900'
                    }`}>
                    {Math.round((creditBalance.currentCredits / (creditBalance.totalPurchased || 1)) * 100)}%
                  </span>
                  <div className="text-[10px] text-gray-500 font-medium">available</div>
                </div>
              </div>

              {/* Segmented Progress Bar */}
              <div className="flex gap-1 h-3 mb-2">
                {[...Array(4)].map((_, i) => {
                  const percentAvailable = (creditBalance.currentCredits / (creditBalance.totalPurchased || 1)) * 100;
                  const segmentValue = 25 * (i + 1);
                  const isFull = percentAvailable >= segmentValue;
                  const isPartial = percentAvailable > (25 * i) && percentAvailable < segmentValue;
                  const isLow = creditBalance.currentCredits < ((creditBalance.itemFetchCost || 0) + (creditBalance.research2Cost || 0));

                  return (
                    <div key={i} className="flex-1 bg-gray-100 rounded-full overflow-hidden">
                      {(isFull || isPartial) && (
                        <div
                          className={`h-full rounded-full ${isLow ? 'bg-red-600' : 'bg-purple-600'}`}
                          style={{
                            width: isFull ? '100%' : `${(percentAvailable % 25) * 4}%`
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between text-xs font-medium text-gray-500 mb-4">
                <span>{creditBalance.currentCredits.toLocaleString()} available credits</span>
                {/* <span>{creditBalance.totalPurchased.toLocaleString()} total</span> */}
              </div>

              <Button
                size="sm"
                className="w-full h-8 text-xs bg-gray-900 hover:bg-gray-800 text-white gap-2"
                onClick={() => setIsPurchaseModalOpen(true)}
              >
                <Plus className="h-3 w-3" />
                Add More Credits
              </Button>
            </div>
          )}
        </div>

        {/* URL Submission Form */}
        <Card>
          <CardHeader>
            <CardDescription>
              Enter a HiBid URL. It will be processed by AI and imported into the auction workflow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-2">
                  {urls.map((u, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="url"
                        placeholder="https://hibid.com/lot/..."
                        value={u}
                        onChange={(e) => handleUrlChange(index, e.target.value)}
                        className="flex-1"
                      // disabled={user?.isTrial} // Unlocked for trial users
                      />
                      {urls.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveUrl(index)}
                          // disabled={user?.isTrial}
                          className="text-gray-500 hover:text-red-600 shrink-0"
                          title="Remove URL"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleAddUrl}
                    className="text-sm text-muted-foreground hover:text-primary p-0 h-auto font-normal"
                  // disabled={user?.isTrial}
                  >
                    + Add another URL
                  </Button>

                  {urls.some(u => u.trim()) && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleClearUrls}
                      className="text-sm text-red-500 hover:text-red-700 hover:bg-red-50 h-auto font-normal px-2"
                    // disabled={user?.isTrial}
                    >
                      Clear All
                    </Button>
                  )}
                </div>

                <div className="flex flex-col md:flex-row gap-3 pt-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {/* Span wrapper for disabled button interaction */}
                        <span tabIndex={0} className="inline-flex">
                          <Button type="submit" className="min-w-[200px]" disabled={isSubmitting || !creditBalance || creditBalance.itemFetchCost === undefined || (creditBalance.itemFetchCost !== undefined && creditBalance.currentCredits < (creditBalance.itemFetchCost * urls.filter(u => u.trim()).length))}>
                            {isSubmitting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              `Submit URLs ${urls.filter(u => u.trim()).length > 0 && creditBalance?.itemFetchCost ? `(${urls.filter(u => u.trim()).length * creditBalance.itemFetchCost} credits)` : ''}`
                            )}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {creditBalance && !user?.isTrial && (
                        <TooltipContent>
                          {creditBalance.itemFetchCost === undefined ? (
                            <p className="text-red-500 font-bold">System Error: Cost not configured</p>
                          ) : creditBalance.currentCredits < (creditBalance.itemFetchCost * urls.filter(u => u.trim()).length) ? (
                            <p>Requires {creditBalance.itemFetchCost * urls.filter(u => u.trim()).length} credits</p>
                          ) : null}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsManualItemModalOpen(true)}
                    className="flex items-center gap-2"
                  // disabled={user?.isTrial}
                  >
                    <Plus className="h-4 w-4" />
                    Add Manual Item
                  </Button>
                </div>
              </form>
            </div>

          </CardContent>
        </Card>

        {/* Dashboard Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="workflow">Item Pipeline</TabsTrigger>
            <TabsTrigger value="finalized">Finalized Items</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
          </TabsList>


          {/* Item Pipeline Tab */}
          <WorkflowTab
            items={auctionItems}
            creditBalance={creditBalance ?? null}
            onRefresh={refetchItems}
            onChangeStatus={changeItemStatus}
            onDelete={deleteAuctionItem}
            onOpenGallery={openImageGallery}
            onCreateDraft={createEbayDraft}
          />
          <FinalizedTab
            items={auctionItems}
            creditBalance={creditBalance ?? null}
            onRefresh={refetchItems}
            onChangeStatus={changeItemStatus}
            onDelete={deleteAuctionItem}
            onOpenGallery={openImageGallery}
            onCreateDraft={createEbayDraft}
            onEditFinalized={openEditFinalized}
          />
          <OverviewTab
            items={auctionItems}
            onSwitchTab={setActiveTab}
          />
        </Tabs>
      </div>

      {/* Image Gallery Modal */}
      {isImageModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={closeImageGallery}>
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-gray-900">
                  {selectedItem.itemName} - Image Gallery
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={closeImageGallery}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Item Details */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Auction:</span>
                    <p className="text-gray-600">{selectedItem.auctionName || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Status:</span>
                    <p className="text-gray-600">{selectedItem.status}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">SKU:</span>
                    <p className="text-gray-600">{selectedItem.sku || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Priority:</span>
                    <p className="text-gray-600">{selectedItem.priority || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Bidsquire Estimate:</span>
                    <p className="text-gray-600">{selectedItem.auctionSiteEstimate || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">AI Estimate:</span>
                    <p className="text-gray-600">{selectedItem.aiEstimate || 'N/A'}</p>
                  </div>
                </div>

                {/* Original Webhook Data */}
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-medium text-gray-700 mb-2">📋 Original Webhook Data</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">Category:</span>
                      <p className="text-gray-500">{selectedItem.category || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Lot Number:</span>
                      <p className="text-gray-500">{selectedItem.lotNumber || 'N/A'}</p>
                    </div>
                  </div>
                  {selectedItem.aiDescription && (
                    <div className="mt-2">
                      <span className="font-medium text-gray-600">AI Analysis:</span>
                      <p className="text-gray-500 text-sm mt-1">{selectedItem.aiDescription}</p>
                    </div>
                  )}
                </div>

                {/* Research Data */}
                {(selectedItem.researcherEstimate || selectedItem.researcherDescription) && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium text-gray-700 mb-2">🔍 Research 1 Stage</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">Researcher Estimate:</span>
                        <p className="text-gray-500">{selectedItem.researcherEstimate || 'N/A'}</p>
                      </div>
                    </div>
                    {selectedItem.researcherDescription && (
                      <div className="mt-2">
                        <span className="font-medium text-gray-600">Research 1 Notes:</span>
                        <p className="text-gray-500 text-sm mt-1">{selectedItem.researcherDescription}</p>
                      </div>
                    )}
                    {selectedItem.notes && selectedItem.status === 'research' && (
                      <div className="mt-2">
                        <span className="font-medium text-gray-600">Additional Research Notes:</span>
                        <p className="text-gray-500 text-sm mt-1">{selectedItem.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Research 2 Data */}
                {selectedItem.status === 'research2' && selectedItem.notes && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium text-gray-700 mb-2">🔍 Research 2 Stage</h4>
                    <div className="mt-2">
                      <span className="font-medium text-gray-600">Research 2 Notes:</span>
                      <p className="text-gray-500 text-sm mt-1">{selectedItem.notes}</p>
                    </div>
                  </div>
                )}

                {/* Photography Data */}
                {(selectedItem.photographerImages && selectedItem.photographerImages.length > 0) && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium text-gray-700 mb-2">📸 Photography Stage</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">Images Taken:</span>
                        <p className="text-gray-500">{selectedItem.photographerImages.length}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Quantity:</span>
                        <p className="text-gray-500">{selectedItem.photographerQuantity || 'N/A'}</p>
                      </div>
                    </div>
                    {selectedItem.isMultipleItems && (
                      <div className="mt-2 p-2 bg-purple-50 rounded border-l-2 border-purple-400">
                        <div className="text-sm">
                          <span className="font-medium text-purple-700">📦 Multiple Items:</span>
                          <span className="text-purple-600 ml-1">{selectedItem.multipleItemsCount || 1} pieces in this lot</span>
                        </div>
                      </div>
                    )}
                    {selectedItem.notes && selectedItem.status === 'photography' && (
                      <div className="mt-2">
                        <span className="font-medium text-gray-600">Photographer Notes:</span>
                        <p className="text-gray-500 text-sm mt-1">{selectedItem.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Lead/Notes */}
                {selectedItem.lead && (
                  <div className="mt-4 pt-4 border-t">
                    <span className="font-medium text-gray-700">Lead/Notes:</span>
                    <p className="text-gray-600 mt-1">{selectedItem.lead}</p>
                  </div>
                )}
              </div>

              {/* Image Gallery */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">All Images ({(selectedItem.images?.length || 0) + (selectedItem.photographerImages?.length || 0)})</h3>

                {selectedItem.mainImageUrl && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Main Image</h4>
                    <div className="aspect-video overflow-hidden rounded-lg">
                      <img
                        src={selectedItem.mainImageUrl}
                        alt={`${selectedItem.itemName} - Main Image`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                )}

                {selectedItem.images && selectedItem.images.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Original Images</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedItem.images.map((imageUrl, index) => (
                        <div key={index} className="aspect-video overflow-hidden rounded-lg">
                          <img
                            src={imageUrl}
                            alt={`${selectedItem.itemName} - Image ${index + 1}`}
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

                {selectedItem.photographerImages && selectedItem.photographerImages.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">📸 Photography Images</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedItem.photographerImages.map((imageUrl, index) => (
                        <div key={`photo-${index}`} className="aspect-video overflow-hidden rounded-lg">
                          <img
                            src={imageUrl}
                            alt={`${selectedItem.itemName} - Photography ${index + 1}`}
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

                {(!selectedItem.mainImageUrl && (!selectedItem.images || selectedItem.images.length === 0) && (!selectedItem.photographerImages || selectedItem.photographerImages.length === 0)) && (
                  <div className="text-center py-8 text-gray-500">
                    <Image className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p>No images available for this item</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-6 pt-4 border-t">
                {selectedItem.status === 'admin_review' ? (
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      createEbayDraft(selectedItem);
                    }}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Create eBay Draft
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = selectedItem.url || (selectedItem as any).url_main;
                      if (url) {
                        window.open(url, '_blank');
                      } else {
                        toast.error('No URL available for this item');
                      }
                    }}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Original
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    closeImageGallery();
                    // You can add navigation to edit the item here
                  }}
                >
                  <Edit3 className="mr-2 h-4 w-4" />
                  Edit Item
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Management Modal Removed */}

      {/* Add User Modal */}
      {/* Add User Modal Removed */}

      {/* Edit User Modal */}
      {/* Edit User Modal Removed */}

      {/* Edit Finalized Item Modal */}
      {isEditFinalizedModalOpen && editingFinalizedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={closeEditFinalized}>
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Finalized Item</h3>
              <Button variant="outline" size="sm" onClick={closeEditFinalized}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Item Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Item: {editingFinalizedItem.itemName}</h4>
                <p className="text-sm text-gray-600">{editingFinalizedItem.auctionName} - Lot {editingFinalizedItem.lotNumber}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-700">Basic Information</h4>

                  <div>
                    <label className="block text-sm font-medium mb-1">Item Name</label>
                    <Input
                      value={finalizedEditForm.itemName || ''}
                      onChange={(e) => setFinalizedEditForm(prev => ({ ...prev, itemName: e.target.value }))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <Input
                      value={finalizedEditForm.category || ''}
                      onChange={(e) => setFinalizedEditForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <Textarea
                      value={finalizedEditForm.description || ''}
                      onChange={(e) => setFinalizedEditForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Research Information */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-700">Research Information</h4>

                  <div>
                    <label className="block text-sm font-medium mb-1">Researcher Estimate</label>
                    <Input
                      value={finalizedEditForm.researcherEstimate || ''}
                      onChange={(e) => setFinalizedEditForm(prev => ({ ...prev, researcherEstimate: e.target.value }))}
                      placeholder="$100 - $200"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Researcher Description</label>
                    <Textarea
                      value={finalizedEditForm.researcherDescription || ''}
                      onChange={(e) => setFinalizedEditForm(prev => ({ ...prev, researcherDescription: e.target.value }))}
                      rows={3}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Priority</label>
                    <Select
                      value={finalizedEditForm.priority || 'medium'}
                      onValueChange={(value) => setFinalizedEditForm(prev => ({ ...prev, priority: value as any }))}
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
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-1">Admin Notes</label>
                <Textarea
                  value={finalizedEditForm.notes || ''}
                  onChange={(e) => setFinalizedEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={4}
                  placeholder="Add admin notes about final decisions..."
                  className="w-full"
                />
              </div>

              {/* Final Data (eBay Listing) */}
              {finalizedEditForm.finalData && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">eBay Listing Data</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <pre className="text-sm text-gray-600 whitespace-pre-wrap">
                      {JSON.stringify(finalizedEditForm.finalData, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={saveFinalizedEdit} className="flex-1">
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
                <Button variant="outline" onClick={closeEditFinalized} className="flex-1">
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Item Creation Modal */}
      {isManualItemModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setIsManualItemModalOpen(false)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-gray-900">Create Manual Item</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsManualItemModalOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <form onSubmit={handleManualItemSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Item Name *
                    </label>
                    <Input
                      value={manualItemForm.itemName}
                      onChange={(e) => setManualItemForm(prev => ({ ...prev, itemName: e.target.value }))}
                      placeholder="Enter item name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <Input
                      value={manualItemForm.category}
                      onChange={(e) => setManualItemForm(prev => ({ ...prev, category: e.target.value }))}
                      placeholder="Enter category"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <Textarea
                    value={manualItemForm.description}
                    onChange={(e) => setManualItemForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter item description"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Auction Name
                    </label>
                    <Input
                      value={manualItemForm.auctionName}
                      onChange={(e) => setManualItemForm(prev => ({ ...prev, auctionName: e.target.value }))}
                      placeholder="Enter auction name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lot Number
                    </label>
                    <Input
                      value={manualItemForm.lotNumber}
                      onChange={(e) => setManualItemForm(prev => ({ ...prev, lotNumber: e.target.value }))}
                      placeholder="Enter lot number"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bidsquire Estimate
                    </label>
                    <Input
                      value={manualItemForm.auctionSiteEstimate}
                      onChange={(e) => setManualItemForm(prev => ({ ...prev, auctionSiteEstimate: e.target.value }))}
                      placeholder="Enter estimate"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <Select
                      value={manualItemForm.priority}
                      onValueChange={(value: 'high' | 'medium' | 'low') =>
                        setManualItemForm(prev => ({ ...prev, priority: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL
                    </label>
                    <Input
                      value={manualItemForm.url}
                      onChange={(e) => setManualItemForm(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="Enter item URL"
                      type="url"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Main URL
                    </label>
                    <Input
                      value={manualItemForm.urlMain}
                      onChange={(e) => setManualItemForm(prev => ({ ...prev, urlMain: e.target.value }))}
                      placeholder="Enter main URL"
                      type="url"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Camera className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-900">Workflow Information</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    This item will be created and assigned directly to the <strong>Photographer</strong> stage.
                    It will follow the normal workflow: Photography → Research2 → Finalized.
                  </p>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button type="submit" disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Item
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsManualItemModalOpen(false)}
                    className="flex-1"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* eBay Listing Draft Modal */}
      {isEbayDraftModalOpen && selectedItemForDraft && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setIsEbayDraftModalOpen(false)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Create eBay Listing Draft</h3>
                <Button variant="outline" size="sm" onClick={() => setIsEbayDraftModalOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Listing Title
                  </label>
                  <Input
                    value={ebayDraft.title}
                    onChange={(e) => setEbayDraft(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter eBay listing title"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <Textarea
                    value={ebayDraft.description}
                    onChange={(e) => setEbayDraft(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter item description"
                    rows={4}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Condition
                  </label>
                  <Select
                    value={ebayDraft.condition}
                    onValueChange={(value) => setEbayDraft(prev => ({ ...prev, condition: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="Used">Used</SelectItem>
                      <SelectItem value="For parts or not working">For parts or not working</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Listing Type
                  </label>
                  <Select
                    value={ebayDraft.listingType}
                    onValueChange={(value) => setEbayDraft(prev => ({ ...prev, listingType: value as 'auction' | 'fixed' }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auction">Auction</SelectItem>
                      <SelectItem value="fixed">Fixed Price</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {ebayDraft.listingType === 'auction' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Starting Price
                    </label>
                    <Input
                      value={ebayDraft.startingPrice}
                      onChange={(e) => setEbayDraft(prev => ({ ...prev, startingPrice: e.target.value }))}
                      placeholder="Enter starting price"
                      className="w-full"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fixed Price
                    </label>
                    <Input
                      value={ebayDraft.fixedPrice}
                      onChange={(e) => setEbayDraft(prev => ({ ...prev, fixedPrice: e.target.value }))}
                      placeholder="Enter fixed price"
                      className="w-full"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category ID
                  </label>
                  <Input
                    value={ebayDraft.categoryId}
                    onChange={(e) => setEbayDraft(prev => ({ ...prev, categoryId: e.target.value }))}
                    placeholder="Enter eBay category ID"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Secondary Category ID
                  </label>
                  <Input
                    value={ebayDraft.categoryId2}
                    onChange={(e) => setEbayDraft(prev => ({ ...prev, categoryId2: e.target.value }))}
                    placeholder="Enter secondary category ID (optional)"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tertiary Category ID
                  </label>
                  <Input
                    value={ebayDraft.categoryId3}
                    onChange={(e) => setEbayDraft(prev => ({ ...prev, categoryId3: e.target.value }))}
                    placeholder="Enter tertiary category ID (optional)"
                    className="w-full"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-4">
                Make sure your eBay account is connected in{' '}
                <a href="/profile" className="text-blue-600 underline">Profile settings</a>{' '}
                before submitting.
              </p>
              <div className="flex flex-col gap-2 mt-4">
                <div className="flex gap-3">
                  <Button onClick={() => submitEbayDraft(false)} variant="outline" className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-50">
                    <FileText className="mr-2 h-4 w-4" />
                    Save as Draft on eBay
                  </Button>
                  <Button onClick={() => submitEbayDraft(true)} className="flex-1 bg-green-600 hover:bg-green-700">
                    <Award className="mr-2 h-4 w-4" />
                    Post Live on eBay
                  </Button>
                </div>
                <Button variant="outline" onClick={() => setIsEbayDraftModalOpen(false)} className="w-full">
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Research 2 Confirmation Dialog */}
      <AlertDialog open={isConfirmResearch2Open} onOpenChange={setIsConfirmResearch2Open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Credit Usage</AlertDialogTitle>
            <AlertDialogDescription>
              Switching this item to <strong>Research 2</strong> will cost <strong>{pendingStatusChange?.cost || 0} credits</strong>.
              <br /><br />
              Do you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingStatusChange(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResearch2Change} className="bg-purple-600 hover:bg-purple-700">
              Confirm & Pay {pendingStatusChange?.cost || 0} Credits
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isPurchaseModalOpen} onOpenChange={setIsPurchaseModalOpen}>
        <AlertDialogContent className="sm:max-w-4xl bg-white p-0 overflow-hidden">
          <div className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-cyan-500">Additional Research Credit Packs</h2>
              <p className="text-gray-500 mt-2">Need more credits? Easily purchase additional research credits at a discount.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* BOOSTER */}
              <div className="border-2 border-emerald-600 rounded-xl p-6 hover:shadow-lg transition-all duration-200 bg-white flex flex-col items-center relative overflow-hidden group">
                <div className="absolute -left-8 top-6 bg-emerald-600 text-white text-sm font-bold py-1 px-10 transform -rotate-0 uppercase tracking-wide" style={{clipPath: 'polygon(0 0, 100% 0, 95% 100%, 0 100%)'}}>
                  Booster
                </div>
                <div className="mt-8"></div>
                <div className="text-4xl font-extrabold text-gray-900 mb-2">$49</div>
                <div className="text-gray-700 font-semibold mb-1">100 Credits</div>
                <div className="text-sm text-gray-500 mb-6 font-medium">Never Expire!</div>
                <Button
                  className="w-full mt-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handlePurchase(100, 49)}
                  disabled={isSubmitting}
                >
                  Purchase
                </Button>
              </div>

              {/* GROWTH */}
              <div className="border-2 border-emerald-400 rounded-xl p-6 hover:shadow-lg transition-all duration-200 bg-white flex flex-col items-center relative overflow-hidden group">
                <div className="absolute -left-8 top-6 bg-emerald-400 text-white text-sm font-bold py-1 px-10 transform -rotate-0 uppercase tracking-wide" style={{clipPath: 'polygon(0 0, 100% 0, 95% 100%, 0 100%)'}}>
                  Growth
                </div>
                <div className="mt-8"></div>
                <div className="text-4xl font-extrabold text-gray-900 mb-2">$129</div>
                <div className="text-gray-700 font-semibold mb-1">300 Credits!</div>
                <div className="text-sm text-gray-500 mb-6 font-medium">Never Expire!</div>
                <Button
                  className="w-full mt-auto bg-emerald-400 hover:bg-emerald-500 text-white"
                  onClick={() => handlePurchase(300, 129)}
                  disabled={isSubmitting}
                >
                  Purchase
                </Button>
              </div>

              {/* ENTERPRISE */}
              <div className="border-2 border-emerald-700 rounded-xl p-6 hover:shadow-lg transition-all duration-200 bg-white flex flex-col items-center relative overflow-hidden group">
                <div className="absolute -left-8 top-6 bg-emerald-700 text-white text-sm font-bold py-1 px-10 transform -rotate-0 uppercase tracking-wide" style={{clipPath: 'polygon(0 0, 100% 0, 95% 100%, 0 100%)'}}>
                  Enterprise
                </div>
                <div className="mt-8"></div>
                <div className="text-4xl font-extrabold text-gray-900 mb-2">$189</div>
                <div className="text-gray-700 font-semibold mb-1">750 Credits!</div>
                <div className="text-sm text-gray-500 mb-6 font-medium">Never Expire!</div>
                <Button
                  className="w-full mt-auto bg-emerald-700 hover:bg-emerald-800 text-white"
                  onClick={() => handlePurchase(750, 189)}
                  disabled={isSubmitting}
                >
                  Purchase
                </Button>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 p-4 border-t flex justify-center">
            <Button variant="ghost" onClick={() => setIsPurchaseModalOpen(false)} className="text-gray-500 hover:text-gray-900">
              Cancel
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
