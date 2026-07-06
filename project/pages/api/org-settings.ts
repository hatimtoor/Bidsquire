// Authed endpoint backing the profile "Category exclusions" UI. Reads/writes the
// logged-in admin's org_settings row. Auth: JWT cookie, role admin or super_admin.
// Each exclude_* flag TRUE means "skip this category"; defaults are all FALSE.
import { NextApiRequest, NextApiResponse } from 'next';
import { databaseService } from '@/services/database';
import { verifyToken } from '@/services/auth';

const DEFAULTS = {
  exclude_furniture: false,
  exclude_appliances: false,
  exclude_coins: false,
  exclude_firearms: false,
  exclude_vehicles: false,
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
              exclude_furniture: settings.exclude_furniture,
              exclude_appliances: settings.exclude_appliances,
              exclude_coins: settings.exclude_coins,
              exclude_firearms: settings.exclude_firearms,
              exclude_vehicles: settings.exclude_vehicles,
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
      // Only an explicit true excludes; anything else (missing/false) includes.
      const settings = {
        exclude_furniture: body.exclude_furniture === true,
        exclude_appliances: body.exclude_appliances === true,
        exclude_coins: body.exclude_coins === true,
        exclude_firearms: body.exclude_firearms === true,
        exclude_vehicles: body.exclude_vehicles === true,
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
