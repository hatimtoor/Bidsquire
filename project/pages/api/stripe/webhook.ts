import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { databaseService } from '@/services/database';
import { buffer } from 'micro';

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-12-15.clover',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  let event: Stripe.Event;

  try {
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature']!;

    try {
        event = stripe.webhooks.constructEvent(buf, sig, endpointSecret);
    } catch (err: any) {
        console.error(`Webhook Signature Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      // Fulfill the purchase...
      const userId = session.metadata?.userId;
      const credits = session.metadata?.credits ? parseInt(session.metadata.credits) : 0;
      const expiresInDays = session.metadata?.expiresInDays ? parseInt(session.metadata.expiresInDays) : null;

      if (userId && credits > 0) {
        console.log(`💰 Processing credit purchase for user ${userId}: ${credits} credits, expires in: ${expiresInDays} days`);
        try {
            await databaseService.topUpCredits(userId, credits, `Stripe Purchase: ${session.id}`, expiresInDays);
            console.log(`✅ Credits added successfully for user ${userId}`);
        } catch (dbError) {
            console.error('❌ Database error adding credits:', dbError);
            // We should NOT return 500 here if we want Stripe to stop retrying, but typically we want retry if DB fails.
            // Return 500 to trigger retry.
            throw dbError;
        }
      } else {
          console.warn('⚠️ Missing metadata in checkout session:', session.id);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}
