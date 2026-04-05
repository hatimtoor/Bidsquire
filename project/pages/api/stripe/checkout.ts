import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { databaseService } from '@/services/database';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { amount, credits, userId, expiresInDays } = req.body;

    if (!amount || !credits || !userId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${credits} Credits Top-up`,
              description: `Purchase ${credits} credits for Bidsquire${expiresInDays ? ` (Expires in ${expiresInDays} days)` : ''}`,
            },
            unit_amount: Math.round(amount * 100), // Amount in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin}/admin?credit_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/admin?credit_canceled=true`,
      metadata: {
        userId: userId,
        credits: credits.toString(),
        expiresInDays: expiresInDays ? expiresInDays.toString() : '',
      },
    });

    res.status(200).json({ id: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe Checkout Error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
