// Internal endpoint: returns an org's item-exclusion filter settings for a given
// admin. Consumed by the n8n scraper pipeline to decide whether to skip a lot.
// Auth: x-internal-secret header (same pattern as pages/api/item-db/*.ts).
import type { NextApiRequest, NextApiResponse } from 'next';
import { databaseService } from '@/services/database';

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

// When an admin has no org, or the org has no saved row, everything is included.
const DEFAULTS = {
  include_large_items: true,
  include_coins: true,
  include_firearms: true,
  include_vehicles: true,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers['x-internal-secret'] !== INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const adminId = ((req.query.adminId as string) || '').trim();
    if (!adminId) {
      return res.status(400).json({ error: 'adminId is required' });
    }

    const user = await databaseService.getUserById(adminId);
    const orgId = user?.orgId;
    if (!orgId) {
      return res.status(200).json(DEFAULTS);
    }

    const settings = await databaseService.getOrgSettings(orgId);
    if (!settings) {
      return res.status(200).json(DEFAULTS);
    }

    return res.status(200).json({
      include_large_items: settings.include_large_items,
      include_coins: settings.include_coins,
      include_firearms: settings.include_firearms,
      include_vehicles: settings.include_vehicles,
    });
  } catch (error) {
    console.error('[internal/filter-settings]', error);
    return res.status(500).json({
      error: 'Failed to fetch filter settings',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
