import { NextResponse } from 'next/server';
import { getTrades } from '../../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);
  const trades = getTrades(id);
  return NextResponse.json(trades);
}
