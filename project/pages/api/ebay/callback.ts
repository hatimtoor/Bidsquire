import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '@/services/auth';
import { exchangeCodeForTokens } from '@/services/ebay';
import { databaseService } from '@/services/database';
import { serialize } from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }

  const { code, state, error: ebayError } = req.query;

  // If eBay returned an error (user denied access)
  if (ebayError) {
    return res.redirect('/profile?ebay=denied');
  }

  if (!code || !state) {
    return res.redirect('/profile?ebay=error&reason=missing_params');
  }

  // Verify state matches cookie (CSRF protection)
  const savedState = req.cookies['ebay_oauth_state'];
  if (!savedState || savedState !== state) {
    return res.redirect('/profile?ebay=error&reason=invalid_state');
  }

  // Verify user is logged in
  const decoded: any = verifyToken(req);
  if (!decoded) {
    return res.redirect('/auth/login');
  }

  try {
    const tokens = await exchangeCodeForTokens(code as string);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await databaseService.saveEbayTokens(decoded.id, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    });

    // Clear the OAuth state cookie
    res.setHeader(
      'Set-Cookie',
      serialize('ebay_oauth_state', '', {
        httpOnly: true,
        maxAge: 0,
        path: '/',
      })
    );

    return res.redirect('/profile?ebay=connected');
  } catch (err: any) {
    console.error('eBay OAuth callback error:', err);
    return res.redirect(`/profile?ebay=error&reason=token_exchange`);
  }
}
