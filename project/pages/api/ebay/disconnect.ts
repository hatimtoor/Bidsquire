import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '@/services/auth';
import { databaseService } from '@/services/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  const decoded: any = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  try {
    await databaseService.clearEbayTokens(decoded.id);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('eBay disconnect error:', err);
    return res.status(500).json({ error: 'Failed to disconnect eBay account' });
  }
}
