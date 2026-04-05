import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.POSTGRES_USER || 'auctionuser'}:${process.env.POSTGRES_PASSWORD || 'auctionpass'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'auctionflow'}`,
});

export async function GET() {
  try {
    await pool.query('SELECT 1');
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    console.error('Database connection failed:', error);
    return NextResponse.json(
      { status: 'error', message: 'Service Unavailable' },
      { status: 503 }
    );
  }
}
