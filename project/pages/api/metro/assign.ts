// Assign an auction to an operator (manager only). This is the isolation pivot:
// once assigned, only that operator sees the auction (enforced in getMetroAuctions).
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

  const { auctionId, operatorId } = req.body || {};
  if (!auctionId || !operatorId) {
    return res.status(400).json({ error: 'auctionId and operatorId are required' });
  }

  let orgId: string | undefined = decoded.orgId;
  if (!orgId) {
    const u = await databaseService.getUserById(decoded.id);
    orgId = u?.orgId;
  }
  if (!orgId) return res.status(400).json({ error: 'No metro (organization) on this account' });

  try {
    // The operator must be one of this metro's own operators.
    const operator = await databaseService.getUserById(operatorId);
    if (!operator || operator.orgId !== orgId || operator.role !== 'operator') {
      return res.status(400).json({ error: 'That person is not an operator on this metro' });
    }

    const updated = await databaseService.assignMetroAuction(auctionId, orgId, operatorId);
    if (!updated) return res.status(404).json({ error: 'Auction not found in this metro' });

    return res.status(200).json({ success: true, auction: updated });
  } catch (error) {
    console.error('[metro/assign]', error);
    return res.status(500).json({
      error: 'Failed to assign auction',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
