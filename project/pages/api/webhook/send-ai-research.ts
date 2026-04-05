import { NextApiRequest, NextApiResponse } from 'next';
import { databaseService } from '@/services/database';
import { verifyToken } from '@/services/auth';

const N8N_AI_RESEARCH_WEBHOOK_URL = process.env.N8N_AI_RESEARCH_WEBHOOK_URL || '';
const BIDSQUIRE_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Verify auth
  const decoded: any = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const { itemId } = req.body;
  if (!itemId) return res.status(400).json({ error: 'itemId is required' });

  try {
    // 1. Load item
    const item = await databaseService.getAuctionItem(itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    // 2. Check and deduct 1 credit
    const userId = decoded.id || decoded.userId;
    const hasCredits = await databaseService.hasEnoughCredits(userId, 1);
    if (!hasCredits) {
      return res.status(402).json({ error: 'INSUFFICIENT_CREDITS', message: 'You need at least 1 credit for AI research.' });
    }
    await databaseService.deductCredits(userId, 1, `AI Research: ${item.itemName}`);

    // 3. Check n8n URL configured
    if (!N8N_AI_RESEARCH_WEBHOOK_URL) {
      return res.status(503).json({ error: 'AI research webhook not configured. Set N8N_AI_RESEARCH_WEBHOOK_URL.' });
    }

    // 4. Send to n8n and wait for response (synchronous)
    const payload = {
      itemId: item.id,
      itemName: item.itemName,
      description: item.description,
      category: item.category,
      currentBid: item.auctionSiteEstimate,
      auctionName: item.auctionName,
      auctionSiteEstimate: item.auctionSiteEstimate,
      images: item.images || [],
      callbackUrl: `${BIDSQUIRE_API_URL}/api/webhook/receive-ai-research`,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000); // 60s timeout

    let n8nData: any;
    try {
      const n8nResponse = await fetch(N8N_AI_RESEARCH_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      n8nData = await n8nResponse.json();
    } catch (fetchError: any) {
      clearTimeout(timeout);
      if (fetchError.name === 'AbortError') {
        return res.status(504).json({ error: 'AI research timed out. The item will be updated when ready.' });
      }
      throw fetchError;
    }

    // 5. If n8n responded synchronously with research data, apply it immediately
    if (n8nData?.success && n8nData?.research) {
      const { research } = n8nData;
      await databaseService.updateAuctionItem(itemId, {
        researcherEstimate: research.researcherEstimate,
        researcherDescription: research.researcherDescription,
        priority: research.priority,
        notes: research.notes,
        referenceUrls: research.referenceUrls || [],
      } as any);

      return res.status(200).json({
        success: true,
        research: n8nData.research,
        creditsDeducted: 1,
        ebayResultsFound: n8nData.ebaySearchResults || 0,
      });
    }

    // n8n accepted the request but will callback async
    return res.status(202).json({
      success: true,
      message: 'AI research in progress. Refresh in a few seconds.',
      creditsDeducted: 1,
    });

  } catch (error) {
    console.error('AI research error:', error);
    return res.status(500).json({ error: 'Failed to run AI research' });
  }
}
