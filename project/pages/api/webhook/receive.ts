import type { NextApiRequest, NextApiResponse } from 'next';
import { dataStore } from '@/services/dataStore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const data = req.body;

      console.log('=== WEBHOOK DATA RECEIVED ===');
      console.log('Full request body:', JSON.stringify(data, null, 2));
      console.log('Data type:', typeof data);
      console.log('Data keys:', Object.keys(data));
      console.log('Data structure check:', {
        isArray: Array.isArray(data),
        hasRawOutput: !!(Array.isArray(data) && data[0] && data[0].rawOutput),
        hasHttpData: !!(data.httpData && data.httpData[0] && data.httpData[0].json),
        hasDirectData: !!(data.item_name || data.url_main),
        httpDataLength: data.httpData ? data.httpData.length : 0,
        arrayLength: Array.isArray(data) ? data.length : 0
      });

      // Helper to extract data from various structures
      const getProcessedData = (data: any) => {
        if (!data) return {};

        // Handle array wrapper from n8n
        if (Array.isArray(data)) {
          const item = data[0];
          // Prioritize 'output' for direct object, then 'json', then 'body', then the item itself
          if (item && typeof item.output === 'object' && item.output !== null) return item.output;
          if (item && typeof item.json === 'object' && item.json !== null) return item.json;
          if (item && typeof item.body === 'object' && item.body !== null) return item.body;
          // If rawOutput is a string, parse it
          if (item && typeof item.rawOutput === 'string') {
            try {
              return JSON.parse(item.rawOutput);
            } catch (e) {
              console.error('Error parsing rawOutput:', e);
              return {};
            }
          }
          return item || {}; // Fallback to the item itself if it's already an object
        }

        // Handle direct object with 'output', 'json', or 'body'
        if (typeof data.output === 'object' && data.output !== null) return data.output;
        if (typeof data.json === 'object' && data.json !== null) return data.json;
        if (typeof data.body === 'object' && data.body !== null) return data.body;

        return data || {}; // Fallback to the data itself
      };

      const n8nData = getProcessedData(data);
      console.log('=== EXTRACTED N8N DATA ===');
      console.log(JSON.stringify(n8nData, null, 2));

      // Map n8n data to our AuctionItem structure
      let processedData: any = {};

      // If we have n8n data structure
      if (Object.keys(n8nData).length > 0) {
        console.log('=== USING EXTRACTED N8N DATA ===');
        processedData = {
          id: Date.now().toString(),
          url_main: n8nData.url || n8nData.url_main || '',
          item_name: n8nData.item_name || n8nData.title || n8nData.name || n8nData.lot_title || n8nData.item_title || n8nData.lot_name || n8nData.product_name || n8nData.description || 'Unnamed Item',
          lot_number: n8nData.lot_number || '',
          description: n8nData.description || '',
          lead: n8nData.lead || '',
          category: n8nData.category || '',
          estimate: n8nData.estimate || '',
          auction_name: n8nData.auction_name || '',
          all_unique_image_urls: n8nData.all_unique_image_urls || '',
          main_image_url: n8nData.main_image_url || n8nData.image_data?.main_image_url || '',
          gallery_image_urls: n8nData.gallery_image_urls || n8nData.image_data?.gallery_image_urls || '',
          broad_search_images: n8nData.broad_search_images || n8nData.image_data?.broad_search_images || '',
          tumbnail_images: n8nData.tumbnail_images || n8nData.image_data?.thumbnail_urls || '',
          ai_response: n8nData.ai_response || n8nData.cleanedOutput || n8nData.rawOutput || '',
          received_at: new Date().toISOString(),
          status: 'processed'
        };
      } else {
        // Fallback for completely unknown structure
        console.log('=== UNKNOWN STRUCTURE - USING RAW DATA ===');
        processedData = { ...data, status: 'processed' };
      }

      console.log('=== PROCESSED DATA ===');
      console.log('Processed data:', JSON.stringify(processedData, null, 2));

      // Extract adminId, adminEmail, and itemId from request body
      // Handle various n8n data structures (flat object or array)
      let adminId = data.adminId;
      let adminEmail = data.adminEmail;
      let itemId = data.itemId;

      if (Array.isArray(data) && data[0]) {
        // Check inside the first element of the array
        if (!itemId) itemId = data[0].itemId || data[0].id; // Check 'id' as well
        if (!itemId && data[0].json) itemId = data[0].json.itemId || data[0].json.id;
        if (!itemId && data[0].body) itemId = data[0].body.itemId || data[0].body.id;
        if (!itemId && data[0].output) itemId = data[0].output.itemId || data[0].output.id;

        if (!adminId) adminId = data[0].adminId || data[0].admin_id;
        if (!adminId && data[0].json) adminId = data[0].json.adminId || data[0].json.admin_id;
        if (!adminId && data[0].body) adminId = data[0].body.adminId || data[0].body.admin_id;
        if (!adminId && data[0].output) adminId = data[0].output.adminId || data[0].output.admin_id;

        if (!adminEmail) adminEmail = data[0].adminEmail || data[0].admin_email;
        if (!adminEmail && data[0].json) adminEmail = data[0].json.adminEmail || data[0].json.admin_email;
        if (!adminEmail && data[0].body) adminEmail = data[0].body.adminEmail || data[0].body.admin_email;
        if (!adminEmail && data[0].output) adminEmail = data[0].output.adminEmail || data[0].output.admin_email;
      }

      // Also check if they were passed inside the raw output/processed data
      if (!itemId && processedData.itemId) itemId = processedData.itemId;
      if (!itemId && processedData.item_id) itemId = processedData.item_id;
      if (!itemId && processedData.id) itemId = processedData.id; // Check processedData.id too

      console.log('=== ADMIN/ITEM ID EXTRACTION RESULT ===');
      console.log('Final Admin ID:', adminId);
      console.log('Final Item ID:', itemId);
      console.log('Extraction Source:', {
        fromRoot: !!data.itemId,
        fromArray: Array.isArray(data) && !!(data[0]?.itemId || data[0]?.json?.itemId),
        fromProcessed: !!(processedData.itemId || processedData.item_id)
      });

      // Import database service for direct update
      const { databaseService } = await import('@/services/database');

      let resultItem;

      // If itemId is provided, this is an update to an existing placeholder
      if (itemId) {
        console.log('=== UPDATING EXISTING PLACEHOLDER ITEM ===');
        console.log('Item ID to update:', itemId);

        // Update the placeholder with actual data
        const updateData = {
          url: processedData.url_main || undefined,
          itemName: processedData.item_name || 'Unnamed Item',
          lotNumber: processedData.lot_number || undefined,
          description: processedData.description || undefined,
          lead: processedData.lead || undefined,
          category: processedData.category || 'Uncategorized',
          auctionSiteEstimate: processedData.estimate || undefined,
          auctionName: processedData.auction_name || undefined,
          mainImageUrl: processedData.main_image_url || undefined,
          images: Array.isArray(processedData.all_unique_image_urls)
            ? processedData.all_unique_image_urls
            : processedData.all_unique_image_urls
              ? processedData.all_unique_image_urls.split(',').filter(Boolean)
              : [],
          aiDescription: processedData.ai_response || undefined,
          status: 'research' as const, // Move from 'processing' to 'research'
          assignedTo: 'researcher',
          adminId: adminId || undefined,
        };

        resultItem = await databaseService.updateAuctionItem(itemId, updateData);
        if (resultItem) {
           console.log('=== PLACEHOLDER UPDATED BY ID ===');
        } else {
           console.log('=== UPDATE BY ID FAILED - ITEM NOT FOUND ===');
        }
      }

      // If update by ID failed or no ID provided, try Fuzzy URL Match if we have adminId
      if (!resultItem && adminId) {
         console.log('=== ATTEMPTING FUZZY URL MATCH ===');
         const urlToMatch = processedData.url_main;
         if (urlToMatch) {
            const fuzzyMatch = await databaseService.findProcessingItemByFuzzyUrl(urlToMatch, adminId);
            if (fuzzyMatch) {
               console.log(`=== FOUND FUZZY MATCH: ${fuzzyMatch.id} ===`);
               // Update this item
               const updateData = {
                url: processedData.url_main || undefined,
                itemName: processedData.item_name || 'Unnamed Item',
                lotNumber: processedData.lot_number || undefined,
                description: processedData.description || undefined,
                lead: processedData.lead || undefined,
                category: processedData.category || 'Uncategorized',
                auctionSiteEstimate: processedData.estimate || undefined,
                auctionName: processedData.auction_name || undefined,
                mainImageUrl: processedData.main_image_url || undefined,
                images: Array.isArray(processedData.all_unique_image_urls)
                  ? processedData.all_unique_image_urls
                  : processedData.all_unique_image_urls
                    ? processedData.all_unique_image_urls.split(',').filter(Boolean)
                    : [],
                aiDescription: processedData.ai_response || undefined,
                status: 'research' as const,
                assignedTo: 'researcher',
                adminId: adminId,
               };
               resultItem = await databaseService.updateAuctionItem(fuzzyMatch.id, updateData);
            } else {
              console.log('=== NO FUZZY MATCH FOUND ===');
            }
         }
      }

      // Fallback: If still no result, create new item (legacy behavior)
      if (!resultItem) {
        // Fallback: No itemId/Match means this might be from an old request or direct n8n call
        // Use the old import method
        console.log('=== NO MATCH FOUND - USING LEGACY IMPORT (CREATING NEW) ===');
        resultItem = await dataStore.importFromWebhook(processedData, adminId);
      }

      console.log('=== DATA SAVED TO POSTGRESQL ===');
      console.log('Result item:', JSON.stringify(resultItem, null, 2));

      if (!resultItem) {
        console.error('❌ Save operation returned null - there was an error');
      }

      return res.status(200).json({
        message: itemId ? 'Placeholder item updated successfully' : 'Webhook data received and stored successfully',
        item: resultItem,
        status: 'success',
        storage: 'postgresql'
      });

    } catch (error) {
      console.error('Error processing webhook:', error);
      return res.status(500).json({
        error: 'Failed to process webhook data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else if (req.method === 'GET') {
    try {
      console.log('=== GET REQUEST RECEIVED ===');

      // Get auction items directly from database service
      const { databaseService } = await import('@/services/database');
      const auctionItems = await databaseService.getAuctionItems();

      console.log('=== AUCTION ITEMS RETRIEVED FROM POSTGRESQL ===');
      console.log('Total items:', auctionItems.length);

      // Return auction items (webhook data is now integrated into auction workflow)
      return res.status(200).json({
        message: 'Auction items retrieved successfully',
        items: auctionItems,
        total_count: auctionItems.length,
        status: 'success',
        storage: 'postgresql'
      });
    } catch (error) {
      console.error('Error retrieving auction items:', error);
      return res.status(500).json({
        error: 'Failed to retrieve auction items',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
