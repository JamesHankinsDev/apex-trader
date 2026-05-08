import { NextResponse } from 'next/server';
import { getRun } from '../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);
  const run = getRun(id);
  if (!run) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(run);
}
