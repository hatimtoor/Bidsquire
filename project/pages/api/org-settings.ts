// Authed endpoint backing the profile "Item Filters" UI. Reads/writes the
// logged-in admin's org_settings row. Auth: JWT cookie, role admin or super_admin.
import { NextApiRequest, NextApiResponse } from 'next';
import { databaseService } from '@/services/database';
import { verifyToken } from '@/services/auth';

const DEFAULTS = {
  include_large_items: true,
  include_coins: true,
  include_firearms: true,
  include_vehicles: true,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const decoded: any = verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Resolve the org id from the token, falling back to a fresh user lookup.
  let orgId: string | undefined = decoded.orgId;
  if (!orgId) {
    const user = await databaseService.getUserById(decoded.id);
    orgId = user?.orgId;
  }

  if (req.method === 'GET') {
    try {
      if (!orgId) {
        return res.status(200).json({ settings: DEFAULTS });
      }
      const settings = await databaseService.getOrgSettings(orgId);
      return res.status(200).json({
        settings: settings
          ? {
              include_large_items: settings.include_large_items,
              include_coins: settings.include_coins,
              include_firearms: settings.include_firearms,
              include_vehicles: settings.include_vehicles,
            }
          : DEFAULTS,
      });
    } catch (error) {
      console.error('Error fetching org settings:', error);
      return res.status(500).json({
        error: 'Failed to fetch org settings',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } else if (req.method === 'POST') {
    if (!orgId) {
      return res.status(400).json({ error: 'No organization associated with this account' });
    }
    try {
      const body = req.body || {};
      // Missing keys default to included (true); only an explicit false excludes.
      const settings = {
        include_large_items: body.include_large_items !== false,
        include_coins: body.include_coins !== false,
        include_firearms: body.include_firearms !== false,
        include_vehicles: body.include_vehicles !== false,
      };
      await databaseService.upsertOrgSettings(orgId, settings);
      return res.status(200).json({ success: true, settings });
    } catch (error) {
      console.error('Error saving org settings:', error);
      return res.status(500).json({
        error: 'Failed to save org settings',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
