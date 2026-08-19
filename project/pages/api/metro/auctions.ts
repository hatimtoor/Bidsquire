// Add an auction to the territory (manager only). Creates a metro_auctions row;
// wiring this to actually dispatch the catalog's lots (send-auction) is a follow-up.
import type { NextApiRequest, NextApiResponse } from 'next';
import { databaseService } from '@/services/database';
import { verifyToken } from '@/services/auth';
import { METRO_MANAGER_ROLES } from '@/lib/metro';

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
  const auctionName = (name || '').trim() || 'New auction from HiBid';

  try {
    const row = await databaseService.createMetroAuction({
      orgId,
      name: auctionName,
      county: county || undefined,
      sourceUrl: sourceUrl || undefined,
      lots: typeof lots === 'number' ? lots : null,
      closesAt: closesAt || null,
    });
    return res.status(200).json({ success: true, auction: row });
  } catch (error) {
    console.error('[metro/auctions]', error);
    return res.status(500).json({
      error: 'Failed to add auction',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
