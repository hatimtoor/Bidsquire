import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '@/services/auth';
import { databaseService } from '@/services/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }

  const decoded: any = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const tokens = await databaseService.getEbayTokens(decoded.id);
    return res.status(200).json({
      connected: !!tokens?.refreshToken,
      ebayUserId: tokens?.ebayUserId || null,
    });
  } catch (err) {
    console.error('eBay status error:', err);
    return res.status(500).json({ error: 'Failed to get eBay status' });
  }
}
