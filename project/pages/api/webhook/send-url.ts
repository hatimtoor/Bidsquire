import type { NextApiRequest, NextApiResponse } from 'next';
import { validateUrl } from '@/utils/urlValidation';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { url_main, adminId, adminEmail } = req.body || {};
    if (!url_main || typeof url_main !== 'string') {
      return res.status(400).json({ error: 'url_main is required' });
    }

    const validation = validateUrl(url_main);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error || 'Invalid URL pattern' });
    }

    const { databaseService } = await import('@/services/database');

    // Check if this URL is already being processed or exists FOR THIS ADMIN
    // We pass adminId to scope the check. If adminId is null/undefined, it behaves globally (or however db service handles it)
    // But importantly, if I am Admin A, I won't see Admin B's items as duplicates.
    const existingItem = await databaseService.findItemByUrl(url_main, adminId);
    if (existingItem) {
      if (existingItem.status === 'processing') {
        return res.status(409).json({
          error: 'This URL is already being processed',
          code: 'ALREADY_PROCESSING',
          itemId: existingItem.id
        });
      }
      // URL already exists as a completed item
      return res.status(409).json({
        error: 'This URL has already been fetched',
        code: 'DUPLICATE_URL',
        itemId: existingItem.id
      });
    }

    // Credit Check
    const creditSettings = await databaseService.getCreditSettings();
    const itemFetchCost = creditSettings.item_fetch_cost || 1;

    if (adminId) {
      const hasCredits = await databaseService.hasEnoughCredits(adminId, itemFetchCost);
      if (!hasCredits) {
        return res.status(403).json({
          error: 'Insufficient credits',
          code: 'INSUFFICIENT_CREDITS',
          required: itemFetchCost
        });
      }

      // Deduct credits immediately
      await databaseService.deductCredits(
        adminId,
        itemFetchCost,
        `Item Fetch: ${url_main}`
      );
    }

    // Validate adminId exists in users table (foreign key constraint)
    let validAdminId: string | null = null;
    if (adminId) {
      const adminUser = await databaseService.getUserById(adminId);
      if (adminUser) {
        validAdminId = adminId;
      } else {
        console.warn(`[API] Admin ID ${adminId} not found in users table, setting to null`);
      }
    }

    // Create placeholder item with 'processing' status
    const { normalizeUrl } = await import('@/utils/urlValidation');
    const displayUrl = normalizeUrl(url_main);

    const placeholderId = uuidv4();
    const placeholderItem = await databaseService.createItem({
      id: placeholderId,
      url: url_main,
      itemName: `Fetching: ${displayUrl}`,
      status: 'processing',
      adminId: adminId || undefined,
      adminEmail: adminEmail || undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`[API] Created placeholder item ${placeholderId} for URL: ${url_main}`);

    // Fire lead notification (non-blocking)
    if (adminId) {
      databaseService.getUserById(adminId).then(async adminUser => {
        if (!adminUser) return;
        const { notifyAuctionFetched } = await import('@/services/lead-notifications');
        await notifyAuctionFetched({
          adminName: adminUser.name,
          adminEmail: adminUser.email,
          auctionUrl: url_main,
          itemId: placeholderId,
        });
      }).catch(e => console.error('[Notify] auction fetch email failed:', e));
    }

    const webhookUrl = 'https://sorcer.app.n8n.cloud/webhook/789023dc-a9bf-459c-8789-d9d0c993d1cb';

    // Send to n8n asynchronously with the placeholder item ID
    fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url_main,
        itemId: placeholderId, // Send item ID so n8n can update it
        ...(adminId ? { adminId } : {}),
        ...(adminEmail ? { adminEmail } : {})
      })
    }).then(response => {
      console.log(`[API] n8n acknowledged URL: ${url_main}, status: ${response.status}`);
    }).catch(error => {
      console.error(`[API] Error sending to n8n (async): ${error.message}`);
      // Mark item as failed if n8n call fails
      databaseService.updateItem(placeholderId, {
        status: 'research', // Fallback to research status
        itemName: 'Failed to fetch - please try again'
      });
    });

    return res.status(200).json({
      success: true,
      status: 'processing',
      itemId: placeholderId,
      message: 'URL submitted for processing. Item will update when complete.'
    });

  } catch (error) {
    console.error('Error calling n8n webhook:', error);
    return res.status(500).json({
      error: 'Failed to call n8n webhook',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
