// Metro Manager dashboard data. Manager (metro_manager/admin/super_admin) sees
// the whole territory; an operator sees only auctions assigned to them.
import type { NextApiRequest, NextApiResponse } from 'next';
import { databaseService } from '@/services/database';
import { verifyToken } from '@/services/auth';
import { NYC_METRO_COUNTIES, METRO_MANAGER_ROLES } from '@/lib/metro';

const EMPTY_STATS = {
  counties_held: NYC_METRO_COUNTIES.length,
  active_operators: 0,
  auctions_in_progress: 0,
  items_this_week: 0,
  listed_on_ebay: 0,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const decoded: any = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const isManager = METRO_MANAGER_ROLES.includes(decoded.role);
  const isOperator = decoded.role === 'operator';
  if (!isManager && !isOperator) return res.status(403).json({ error: 'Forbidden' });

  let orgId: string | undefined = decoded.orgId;
  if (!orgId) {
    const u = await databaseService.getUserById(decoded.id);
    orgId = u?.orgId;
  }

  const counties = NYC_METRO_COUNTIES.map((c) => ({ name: c.name, state: c.state, active: 0 }));
  if (!orgId) {
    return res.status(200).json({
      role: decoded.role,
      metroName: 'New York Metro',
      counties,
      team: [],
      auctions: [],
      stats: EMPTY_STATS,
    });
  }

  try {
    const operatorScope = isOperator ? decoded.id : undefined;
    const raw = await databaseService.getMetroAuctions(orgId, operatorScope);

    const auctions = raw.map((a: any) => ({
      id: a.id,
      name: a.name,
      site: a.source_url ? 'HiBid' : '—',
      county: a.county || '—',
      operator: a.operator_name || null,
      lots: a.lots ?? '—',
      status: a.status || 'new',
      closes: a.closes_at || '—',
    }));

    const orgUsers = isManager ? await databaseService.getUsersByOrg(orgId) : [];
    const operators = orgUsers.filter((u) => u.role === 'operator');
    const team = operators.map((u) => {
      const assigned = raw.filter((a: any) => a.operator_id === u.id);
      const itemProxy = assigned.reduce((s: number, a: any) => s + (Number(a.lots) || 0), 0);
      return {
        id: u.id,
        name: u.name,
        county: u.homeCounty || '—',
        auctions: assigned.length,
        items: itemProxy,
      };
    });

    const coverage = NYC_METRO_COUNTIES.map((c) => {
      const active = raw.filter(
        (a: any) => (a.county || '').toLowerCase() === c.name.toLowerCase() && a.operator_id
      ).length;
      return { name: c.name, state: c.state, active };
    });

    const live = isManager
      ? await databaseService.getMetroStats(orgId)
      : { items_this_week: 0, listed_on_ebay: 0 };

    return res.status(200).json({
      role: decoded.role,
      metroName: 'New York Metro',
      counties: coverage,
      team,
      auctions,
      stats: {
        counties_held: NYC_METRO_COUNTIES.length,
        active_operators: operators.length,
        auctions_in_progress: auctions.length,
        items_this_week: live.items_this_week,
        listed_on_ebay: live.listed_on_ebay,
      },
    });
  } catch (error) {
    console.error('[metro/summary]', error);
    return res.status(500).json({
      error: 'Failed to load metro summary',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
