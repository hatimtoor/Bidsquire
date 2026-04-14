import { NextApiRequest, NextApiResponse } from 'next';
import { databaseService } from '@/services/database';
import { verifyToken } from '@/services/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const decoded: any = verifyToken(req);
      const role = decoded?.role;
      const orgId = decoded?.orgId;

      let items;
      if (role === 'super_admin') {
        // Super admin sees everything
        items = await databaseService.getAuctionItems();
      } else if (orgId) {
        // Everyone else is scoped to their org
        items = await databaseService.getAuctionItemsByOrg(orgId);
      } else {
        // No org assigned yet — fall back to admin_id scoping for legacy accounts
        const { userId, userRole } = req.query;
        if (userId) {
          if (userRole === 'photographer') {
            const user = await databaseService.getUserById(userId as string);
            items = user?.createdBy ? await databaseService.getAuctionItemsByAdmin(user.createdBy) : [];
          } else {
            items = await databaseService.getAuctionItemsByAdmin(userId as string);
          }
        } else {
          items = [];
        }
      }

      res.status(200).json(items);
    } catch (error) {
      console.error('Error fetching auction items:', error);
      res.status(500).json({ error: 'Failed to fetch auction items' });
    }
  } else if (req.method === 'POST') {
    try {
      const decoded: any = verifyToken(req);
      const body = req.body;
      const itemData = {
        ...body,
        // Normalize snake_case (n8n) → camelCase (DB service)
        itemName: body.itemName || body.item_name || null,
        lotNumber: body.lotNumber || body.lot_number || null,
        auctionName: body.auctionName || body.auction_name || null,
        mainImageUrl: body.mainImageUrl || body.main_image_url || null,
        auctionSiteEstimate: body.auctionSiteEstimate || body.estimate || null,
        aiDescription: body.aiDescription || body.ai_response || null,
        images: body.images?.length
          ? body.images
          : body.all_unique_image_urls
            ? body.all_unique_image_urls.split(',').map((s: string) => s.trim())
            : [],
        status: body.status || 'research',
        orgId: body.orgId || decoded?.orgId || null,
      };

      // Manual item creation is free. No credit deduction needed.

      const newItem = await databaseService.createAuctionItem(itemData);
      res.status(201).json(newItem);
    } catch (error) {
      console.error('Error creating auction item:', error);
      res.status(500).json({ error: 'Failed to create auction item' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Item ID is required' });
      }

       const updates = req.body;
       console.log('🔄 API PUT /api/auction-items called:', { id, updates });

       // Check specific status transitions for credit deduction
       if (updates.status === 'research2') {
         const currentItem = await databaseService.getAuctionItem(id);

         // Only charge if we are NOT already in research2 (entering the stage)
         if (currentItem && currentItem.status !== 'research2') {
             const adminId = currentItem.adminId;
             if (adminId) {
                 const creditSettings = await databaseService.getCreditSettings();
                 // DB may have research2_stage_cost or research2_cost
                 const research2Cost = creditSettings.research2_stage_cost ?? creditSettings.research2_cost;

                 if (research2Cost === undefined) {
                     console.error('CRITICAL: research2_stage_cost/research2_cost not found in credit_settings. Available settings:', creditSettings);
                     return res.status(500).json({
                         error: 'System configuration error: Research 2 cost not set.',
                         code: 'CONFIG_ERROR',
                         details: `Missing key 'research2_stage_cost'. Available keys: ${Object.keys(creditSettings || {}).join(', ')}`
                     });
                 }

                 const hasCredits = await databaseService.hasEnoughCredits(adminId, research2Cost);
                 if (!hasCredits) {
                     return res.status(403).json({
                         error: `Insufficient credits for Research 2 task. Required: ${research2Cost}`,
                         code: 'INSUFFICIENT_CREDITS',
                         required: research2Cost
                     });
                 }

                 // Deduct credits
                 await databaseService.deductCredits(
                     adminId,
                     research2Cost,
                     `Research 2 completion: ${currentItem.itemName || 'Unnamed Item'}`
                 );
             }
         }
       }

      const updatedItem = await databaseService.updateAuctionItem(id, updates);
      console.log('📥 Database update result:', updatedItem);

      if (updatedItem) {
        res.status(200).json(updatedItem);
      } else {
        res.status(404).json({ error: 'Item not found' });
      }
    } catch (error) {
      console.error('❌ Error updating auction item:', error);
      res.status(500).json({ error: 'Failed to update auction item' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Item ID is required' });
      }

      const success = await databaseService.deleteAuctionItem(id);
      if (success) {
        res.status(200).json({ message: 'Item deleted successfully' });
      } else {
        res.status(404).json({ error: 'Item not found' });
      }
    } catch (error) {
      console.error('Error deleting auction item:', error);
      res.status(500).json({ error: 'Failed to delete auction item' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
