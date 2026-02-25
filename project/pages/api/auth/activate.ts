import { NextApiRequest, NextApiResponse } from 'next';
import { databaseService } from '@/services/database';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password are required' });
  }

  try {
    // 1. Verify Token (HMAC-SHA256)
    // Must match the logic in Onboarding App
    const secret = process.env.CROSS_APP_SECRET || 'temporary-dev-secret-change-me';

    if (!token.includes('.')) {
        return res.status(400).json({ error: 'Invalid token format' });
    }

    const [payloadBase64, signature] = token.split('.');

    if (!payloadBase64 || !signature) {
      return res.status(400).json({ error: 'Invalid token components' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadBase64)
      .digest('hex');

    // Timing-safe comparison recommended but strict equality ok for now
    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid signature / Token Modified' });
    }

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
    console.log('[Activate] Decoded Payload:', JSON.stringify(payload, null, 2));

    if (Date.now() > payload.exp) {
      return res.status(401).json({ error: 'Token has expired' });
    }

    const { email, name, credits, expiresInDays } = payload;

    if (!email) {
        return res.status(400).json({ error: 'Invalid token payload' });
    }

    // 2. Find or Create User
    // We strictly follow the request: "those users will appear as admin on main application"
    let user = await databaseService.getUserByEmail(email);

    if (user) {
        // User exists: Update password and ensure active status
        console.log(`Updating existing user ${email} during activation`);
        await databaseService.updateUser(user.id, {
            password: password,
            isActive: true,
            role: 'admin' // Ensure they are admin as requested
        });
    } else {
        // Create new Admin User
        console.log(`Creating new admin user ${email}`);
        user = await databaseService.createUser({
            name: name || 'Admin User',
            email: email,
            password: password,
            role: 'admin',
            isActive: true, // Mark active immediately upon activation
            avatar: undefined,
            createdBy: 'onboarding-bridge'
        });
    }

    // --- CREDIT PROVISIONING LOGIC ---
    // Strict "One Trial Per Lifetime" Rule
    // We check transaction history, not just current active status
    const hasUsedTrial = await databaseService.hasUsedTrial(user.id);

    if (!hasUsedTrial) {
         if (credits && typeof credits === 'number' && credits > 0) {
              console.log(`Applying ${credits} trial credits to user ${email} (First time trial)`);
              await databaseService.topUpCredits(user.id, credits, 'Provisioned via Activation', expiresInDays || null);
         } else {
              // Internal fallback if token doesn't have credits but they are eligible
              // Default to 500 credits for all trial users (as per Paul's request)
              const creditSettings = await databaseService.getCreditSettings();
              const initialCredits = typeof creditSettings.trial_credits === 'number' ? creditSettings.trial_credits : 500;
              console.log(`Applying system default ${initialCredits} trial credits to user ${email}`);
              await databaseService.createUserCredits(user.id, initialCredits);
         }
    } else {
         console.log(`User ${email} has already used a trial. Skipping credit provisioning.`);
    }

    // 3. NO Item Stub Creation - Return URL for frontend pre-fill
    // We pass the URL back so the frontend can redirect the user to the dashboard with the URL pre-filled.
     let hibidUrl = payload.hibid_url;

    // Tag the contact as "AUTHENTICATED" in Active Campaign
    // This triggers Paul's AC automation to send the welcome email
    try {
      const acTagRes = await fetch(`${process.env.ONBOARDING_APP_URL || 'http://localhost:3002'}/api/ac/tag-authenticated`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: process.env.CROSS_APP_SECRET || 'temporary-dev-secret-change-me',
          email: email,
        }),
      });
      if (acTagRes.ok) {
        console.log(`[Activate] "AUTHENTICATED" tag applied in AC for ${email}`);
      } else {
        console.error(`[Activate] Failed to tag in AC:`, await acTagRes.text());
      }
    } catch (acError) {
      console.error('[Activate] Error tagging in AC:', acError);
      // Don't fail activation if AC tagging fails
    }

    return res.status(200).json({
        user: { email: user.email, role: user.role },
        success: true,
        hibid_url: hibidUrl
    });
  } catch (error) {
    console.error('Activation error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
