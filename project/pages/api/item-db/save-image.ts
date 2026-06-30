// pages/api/item-db/save-image.ts
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
      itemDbItemId,
      sourceUrl,
      sourcePlatform,
      r2Key,
      r2Url,
      fileSizeBytes,
      mimeType,
      isPrimary,
      // For logging failures
      failed,
      error: downloadError,
    } = req.body;

    if (!itemDbItemId || !sourceUrl) {
      return res.status(400).json({ error: 'itemDbItemId and sourceUrl required' });
    }

    if (failed) {
      await itemDbService.logImageFailure({
        itemDbItemId,
        sourceUrl,
        error: downloadError || 'unknown',
      });
      return res.status(200).json({ logged: 'failure' });
    }

    if (!r2Key || !r2Url) {
      return res.status(400).json({ error: 'r2Key and r2Url required for successful uploads' });
    }

    const image = await itemDbService.saveImage({
      itemDbItemId,
      sourceUrl,
      sourcePlatform,
      r2Key,
      r2Url,
      fileSizeBytes,
      mimeType,
      isPrimary,
    });

    return res.status(200).json({ image });
  } catch (error) {
    console.error('[item-db/save-image]', error);
    return res.status(500).json({
      error: 'Save image failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
