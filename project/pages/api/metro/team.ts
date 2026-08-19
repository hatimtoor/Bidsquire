// Add an operator to the metro (manager only). Each operator is a real user in
// the manager's org with role 'operator'. Password setup reuses the existing
// reset-link email flow (set-up link) or a manager-set password.
import type { NextApiRequest, NextApiResponse } from 'next';
import { databaseService } from '@/services/database';
import { verifyToken } from '@/services/auth';
import { sendPasswordResetEmail } from '@/services/email';
import { METRO_MANAGER_ROLES } from '@/lib/metro';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const decoded: any = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  if (!METRO_MANAGER_ROLES.includes(decoded.role)) return res.status(403).json({ error: 'Forbidden' });

  let orgId: string | undefined = decoded.orgId;
  if (!orgId) {
    const u = await databaseService.getUserById(decoded.id);
    orgId = u?.orgId;
  }
  if (!orgId) return res.status(400).json({ error: 'No metro (organization) on this account' });

  const { name, email, homeCounty, pwMethod, password } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  const method = pwMethod === 'manual' ? 'manual' : 'link';
  if (method === 'manual' && (!password || String(password).length < 6)) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const existing = await databaseService.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'A user with that email already exists' });
    }

    // For the set-up-link path, seed a random password they can never guess;
    // they set their own via the emailed link.
    const initialPassword = method === 'manual' ? String(password) : crypto.randomBytes(24).toString('hex');

    const operator = await databaseService.createUser(
      {
        name: String(name).trim(),
        email: String(email).trim(),
        password: initialPassword,
        role: 'operator',
        isActive: true,
        orgId,
      } as any,
      decoded.id
    );

    if (homeCounty) {
      await databaseService.updateUser(operator.id, { homeCounty: String(homeCounty) } as any);
    }

    let invited = false;
    if (method === 'link') {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days to set up
      await databaseService.createPasswordResetToken(operator.email, token, expires);
      try {
        await sendPasswordResetEmail(operator.email, token);
        invited = true;
      } catch (e) {
        console.error('[metro/team] set-up email failed:', e);
      }
    }

    return res.status(200).json({
      success: true,
      operator: {
        id: operator.id,
        name: operator.name,
        email: operator.email,
        homeCounty: homeCounty || null,
      },
      method,
      invited,
    });
  } catch (error) {
    console.error('[metro/team]', error);
    return res.status(500).json({
      error: 'Failed to add operator',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
