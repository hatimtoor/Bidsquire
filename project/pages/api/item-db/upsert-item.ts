// pages/api/item-db/upsert-item.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { itemDbService } from '@/services/itemDb';

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers['x-internal-secret'] !== INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      title,
      category,
      description,
      brand,
      makersMarks,
      isExactMatchable,
      fakeRiskLevel,
      fakeRiskNotes,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const item = await itemDbService.upsertItem({
      title,
      category,
      description,
      brand,
      makersMarks,
      isExactMatchable,
      fakeRiskLevel,
      fakeRiskNotes,
    });

    return res.status(200).json({ item, was_existing: item.was_existing });
  } catch (error) {
    console.error('[item-db/upsert-item]', error);
    return res.status(500).json({
      error: 'Upsert failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
