// Add an auction to the territory (manager only). Creates a metro_auctions row and,
// when a catalog URL is given, scrapes it for the real name + lot count and fires
// the n8n Auction Dispatcher so lots flow through the normal per-lot pipeline.
import type { NextApiRequest, NextApiResponse } from 'next';
import { databaseService } from '@/services/database';
import { verifyToken } from '@/services/auth';
import { METRO_MANAGER_ROLES } from '@/lib/metro';
import { scrapeAuction, fireAuctionDispatcher } from '@/services/auctionDispatch';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const decoded: any = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  if (!METRO_MANAGER_ROLES.includes(decoded.role)) return res.status(403).json({ error: 'Forbidden' });

  let orgId: string | undefined = decoded.orgId;
  if (!orgId) {
    const u = await databaseService.getUserById(decoded.id);
    orgId = u?.orgId;
  }
  if (!orgId) return res.status(400).json({ error: 'No metro (organization) on this account' });

  const { name, county, sourceUrl, lots, closesAt } = req.body || {};

  try {
    // If a catalog URL is given, scrape it for the real name + lot count.
    let auctionName = (name || '').trim();
    let lotCount: number | null = typeof lots === 'number' ? lots : null;
    let dispatchable = false;

    if (sourceUrl) {
      const scraped = await scrapeAuction(sourceUrl);
      if (scraped) {
        auctionName = auctionName || scraped.auctionName;
        lotCount = scraped.totalLots;
        dispatchable = true;
      }
    }
    if (!auctionName) auctionName = 'New auction from HiBid';

    const row = await databaseService.createMetroAuction({
      orgId,
      name: auctionName,
      county: county || undefined,
      sourceUrl: sourceUrl || undefined,
      lots: lotCount,
      closesAt: closesAt || null,
    });

    // Fire the dispatcher so lots start flowing through the normal pipeline.
    // Credits attach to the manager (who acts as the metro's admin); the per-lot
    // send-url gate still applies downstream.
    let dispatched = false;
    if (dispatchable && sourceUrl) {
      await fireAuctionDispatcher({ auctionUrl: sourceUrl, adminId: decoded.id, adminEmail: decoded.email });
      dispatched = true;
    }

    return res.status(200).json({ success: true, auction: row, dispatched });
  } catch (error) {
    console.error('[metro/auctions]', error);
    return res.status(500).json({
      error: 'Failed to add auction',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
