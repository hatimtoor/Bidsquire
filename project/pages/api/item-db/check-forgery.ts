import type { NextApiRequest, NextApiResponse } from 'next';
import { itemDbService } from '@/services/itemDb';

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers['x-internal-secret'] !== INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, category } = req.query as { title: string; category: string };

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const result = await itemDbService.checkForgeryRisk(title, category || '');
    return res.status(200).json({ forgery: result });
  } catch (error) {
    console.error('[item-db/check-forgery]', error);
    return res.status(500).json({
      error: 'Forgery check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
