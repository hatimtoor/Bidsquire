import { NextApiRequest, NextApiResponse } from 'next';
import { databaseService } from '@/services/database';
import { verifyToken } from '@/services/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const decoded: any = verifyToken(req);
    const orgId = decoded?.orgId;
    const { adminId } = req.query;

    let users;
    if (orgId) {
      // Org-based: return all team members in this org
      users = await databaseService.getUsersByOrg(orgId);
    } else if (adminId && typeof adminId === 'string') {
      // Legacy fallback: scope by admin creator
      users = await databaseService.getTeamMembersByAdmin(adminId);
    } else {
      return res.status(400).json({ error: 'Unable to determine user scope' });
    }

    return res.status(200).json({
      success: true,
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        createdBy: u.createdBy,
        orgId: u.orgId,
      })),
    });
  } catch (error) {
    console.error('Error getting team members:', error);
    return res.status(500).json({
      error: 'Failed to get team members',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
