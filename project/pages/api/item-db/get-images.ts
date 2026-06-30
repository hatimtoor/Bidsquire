// pages/api/item-db/get-images.ts
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
    const { itemDbItemId } = req.query as { itemDbItemId: string };

    if (!itemDbItemId) {
      return res.status(400).json({ error: 'itemDbItemId required' });
    }

    const result = await itemDbService.getImages(itemDbItemId);
    return res.status(200).json({ images: result });
  } catch (error) {
    console.error('[item-db/get-images]', error);
    return res.status(500).json({
      error: 'Failed to get images',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
