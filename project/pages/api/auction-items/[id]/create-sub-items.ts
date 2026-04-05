import { NextApiRequest, NextApiResponse } from 'next';
import { databaseService } from '@/services/database';
import type { AuctionItem } from '@/types/auction';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    const { subItemCount } = req.body;

    console.log('API Request - ID:', id, 'SubItemCount:', subItemCount);

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Item ID is required' });
    }

    if (!subItemCount || typeof subItemCount !== 'number' || subItemCount < 2) {
      return res.status(400).json({ error: 'Sub-item count must be at least 2' });
    }

    console.log(`Creating ${subItemCount} sub-items for item ${id}`);

    // First, let's check if the item exists
    const allItems = await databaseService.getAuctionItems();
    console.log('Total items found:', allItems.length);
    const targetItem = allItems.find(item => item.id === id);
    console.log('Target item found:', !!targetItem);
    if (targetItem) {
      console.log('Target item details:', {
        id: targetItem.id,
        itemName: targetItem.itemName,
        isMultipleItems: targetItem.isMultipleItems,
        multipleItemsCount: targetItem.multipleItemsCount,
        status: targetItem.status,
        assignedTo: targetItem.assignedTo
      });
    }

    if (!targetItem) {
      return res.status(404).json({ error: 'Original item not found' });
    }

    if (!targetItem.isMultipleItems || !targetItem.multipleItemsCount) {
      return res.status(400).json({ error: 'Original item is not marked as multiple items' });
    }

    // Create sub-items
    const subItems: AuctionItem[] = [];
    const now = new Date();

    for (let i = 1; i <= subItemCount; i++) {
      const subItem = {
        url: targetItem.url,
        url_main: targetItem.url_main,
        auctionName: targetItem.auctionName,
        lotNumber: targetItem.lotNumber,
        images: [], // Sub-items start with no images - they need their own photography
        mainImageUrl: undefined, // Sub-items start with no main image
        sku: `${targetItem.sku || targetItem.id}-SUB${i}`,
        itemName: `${(targetItem.itemName || '').replace(/\((\d+)\)/, `(${subItemCount})`)} - Sub Item #${i}`,
        category: targetItem.category,
        description: targetItem.description,
        lead: targetItem.lead,
        auctionSiteEstimate: targetItem.auctionSiteEstimate,
        aiDescription: targetItem.aiDescription,
        aiEstimate: targetItem.aiEstimate,
        status: 'photography' as const,
        researcherEstimate: targetItem.researcherEstimate,
        researcherDescription: targetItem.researcherDescription,
        referenceUrls: [...(targetItem.referenceUrls || [])],
        similarUrls: [...(targetItem.similarUrls || [])],
        photographerQuantity: 1,
        photographerImages: [], // Sub-items start with no photographer images
        isMultipleItems: false,
        multipleItemsCount: 1,
        finalData: null,
        createdAt: now,
        updatedAt: now,
        assignedTo: 'photographer',
        notes: `Sub-item #${i} of ${targetItem.itemName}`,
        photographerNotes: '',
        priority: 'high' as const,
        tags: [...(targetItem.tags || []), 'sub-item'],
        parentItemId: targetItem.id,
        subItemNumber: i,
        adminId: targetItem.adminId, // Inherit adminId from parent
        adminEmail: targetItem.adminEmail // Inherit adminEmail from parent
      };

      // Create sub-item in database
      const createdSubItem = await databaseService.createAuctionItem(subItem);
      if (createdSubItem) {
        subItems.push(createdSubItem);
      }
    }

    // Update parent item to high priority since it now has sub-items
    await databaseService.updateAuctionItem(id, {
      priority: 'high' as const,
      itemName: (targetItem.itemName || '').replace(/\((\d+)\)/, `(${subItemCount})`),
      notes: `${targetItem.notes || ''}\n\n📦 Multiple items lot - ${subItemCount} sub-items created. Priority set to HIGH.`.trim()
    });

    console.log(`Successfully created ${subItems.length} sub-items`);

    return res.status(200).json({
      success: true,
      message: `Successfully created ${subItems.length} sub-items`,
      subItems: subItems
    });

  } catch (error) {
    console.error('Error creating sub-items:', error);
    return res.status(500).json({
      error: 'Failed to create sub-items',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
