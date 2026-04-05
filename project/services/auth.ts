
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';
import { NextApiRequest, NextApiResponse } from 'next';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const TOKEN_NAME = 'auth_token';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function setTokenCookie(res: NextApiResponse, token: string) {
  const cookie = serialize(TOKEN_NAME, token, {
    maxAge: MAX_AGE,
    expires: new Date(Date.now() + MAX_AGE * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
  });

  res.setHeader('Set-Cookie', cookie);
}

export function removeTokenCookie(res: NextApiResponse) {
  const cookie = serialize(TOKEN_NAME, '', {
    maxAge: -1,
    path: '/',
  });

  res.setHeader('Set-Cookie', cookie);
}

export function generateToken(user: any) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      orgId: user.orgId || null,
    },
    JWT_SECRET,
    {
      expiresIn: '7d',
    }
  );
}

export function verifyToken(req: NextApiRequest) {
  const token = req.cookies[TOKEN_NAME];

  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}
