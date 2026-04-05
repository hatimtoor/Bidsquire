import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '@/services/auth';
import { getEbayAuthUrl } from '@/services/ebay';
import { serialize } from 'cookie';
import crypto from 'crypto';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }

  const decoded: any = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  // Generate a random state value to prevent CSRF
  const state = crypto.randomBytes(16).toString('hex');

  // Store state in a short-lived cookie so callback.ts can verify it
  res.setHeader(
    'Set-Cookie',
    serialize('ebay_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })
  );

  const url = getEbayAuthUrl(state);
  return res.status(200).json({ url });
}
