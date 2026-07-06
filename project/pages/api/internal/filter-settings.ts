// Internal endpoint: returns an org's category-exclusion flags for a given admin.
// Consumed by the n8n scraper pipeline to decide whether to skip a lot.
// Each exclude_* flag TRUE means "skip this category". Auth: x-internal-secret
// header (same pattern as pages/api/item-db/*.ts).
import type { NextApiRequest, NextApiResponse } from 'next';
import { databaseService } from '@/services/database';

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

// No org, or no saved row -> nothing is excluded (everything included).
const DEFAULTS = {
  exclude_furniture: false,
  exclude_appliances: false,
  exclude_coins: false,
  exclude_firearms: false,
  exclude_vehicles: false,
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
      exclude_furniture: settings.exclude_furniture,
      exclude_appliances: settings.exclude_appliances,
      exclude_coins: settings.exclude_coins,
      exclude_firearms: settings.exclude_firearms,
      exclude_vehicles: settings.exclude_vehicles,
    });
  } catch (error) {
    console.error('[internal/filter-settings]', error);
    return res.status(500).json({
      error: 'Failed to fetch filter settings',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
