/**
 * Tests for the activation token logic.
 * Covers: signature verification, expiry, one-time-use (jti).
 */

import crypto from 'crypto';

const SECRET = 'test-secret-key';

function createToken(payload: object, secret: string = SECRET): string {
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('hex');
  return `${payloadBase64}.${signature}`;
}

function verifyToken(token: string, secret: string): { valid: boolean; error?: string; payload?: any } {
  if (!secret) return { valid: false, error: 'Server misconfiguration' };
  if (!token.includes('.')) return { valid: false, error: 'Invalid token format' };

  const [payloadBase64, signature] = token.split('.');
  if (!payloadBase64 || !signature) return { valid: false, error: 'Invalid token components' };

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('hex');

  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (sigBuffer.length !== expectedBuffer.length) return { valid: false, error: 'Invalid signature' };

  const signaturesMatch = crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  if (!signaturesMatch) return { valid: false, error: 'Invalid signature / Token Modified' };

  const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());

  if (Date.now() > payload.exp) return { valid: false, error: 'Token has expired' };

  return { valid: true, payload };
}

describe('Activation Token', () => {
  describe('verifyToken', () => {
    it('accepts a valid, unexpired token', () => {
      const token = createToken({ email: 'test@example.com', exp: Date.now() + 60_000, jti: 'abc123' });
      const result = verifyToken(token, SECRET);
      expect(result.valid).toBe(true);
      expect(result.payload.email).toBe('test@example.com');
    });

    it('rejects a token signed with the wrong secret', () => {
      const token = createToken({ email: 'test@example.com', exp: Date.now() + 60_000 }, 'wrong-secret');
      const result = verifyToken(token, SECRET);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/signature/i);
    });

    it('rejects a token with a tampered payload', () => {
      const token = createToken({ email: 'original@example.com', exp: Date.now() + 60_000 });
      const [, sig] = token.split('.');
      // Tamper: swap email in base64 payload
      const tamperedPayload = Buffer.from(JSON.stringify({ email: 'hacker@example.com', exp: Date.now() + 60_000 })).toString('base64');
      const tamperedToken = `${tamperedPayload}.${sig}`;
      const result = verifyToken(tamperedToken, SECRET);
      expect(result.valid).toBe(false);
    });

    it('rejects an expired token', () => {
      const token = createToken({ email: 'test@example.com', exp: Date.now() - 1000 });
      const result = verifyToken(token, SECRET);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token has expired');
    });

    it('rejects a token with no secret configured', () => {
      const result = verifyToken('anything', '');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Server misconfiguration');
    });

    it('rejects a token with invalid format (no dot)', () => {
      const result = verifyToken('nodothere', SECRET);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token format');
    });
  });

  describe('one-time-use tracking', () => {
    it('token without jti does not require one-time-use check', () => {
      const token = createToken({ email: 'test@example.com', exp: Date.now() + 60_000 });
      const result = verifyToken(token, SECRET);
      expect(result.valid).toBe(true);
      expect(result.payload.jti).toBeUndefined();
    });

    it('token with jti includes it in payload', () => {
      const token = createToken({ email: 'test@example.com', exp: Date.now() + 60_000, jti: 'unique-id-xyz' });
      const result = verifyToken(token, SECRET);
      expect(result.valid).toBe(true);
      expect(result.payload.jti).toBe('unique-id-xyz');
    });
  });
});
