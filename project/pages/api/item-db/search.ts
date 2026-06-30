// pages/api/item-db/search.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { itemDbService } from '@/services/itemDb';

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only n8n can call this
  if (req.headers['x-internal-secret'] !== INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { q, category, type = 'text' } = req.query as {
      q?: string; category?: string; type?: string;
    };

    if (!q && !category) {
      return res.status(400).json({ error: 'q or category required' });
    }

    let results;
    if (type === 'category') {
      results = await itemDbService.searchByCategory(category || q || '', 20);
    } else {
      results = await itemDbService.searchByText(q || '', category, 10);
    }

    return res.status(200).json({ results, count: results.length });
  } catch (error) {
    console.error('[item-db/search]', error);
    return res.status(500).json({
      error: 'Search failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
