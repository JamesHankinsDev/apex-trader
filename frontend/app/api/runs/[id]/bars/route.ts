import { NextResponse } from 'next/server';
import { getBars, getRun } from '../../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);
  const run = getRun(id);
  if (!run) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Expand the range a bit so chart includes context bars around the run
  const expandMs = 7 * 24 * 60 * 60 * 1000;
  const fromT = run.startT - expandMs;
  const toT = (run.endT ?? run.startT) + expandMs;
  const bars = getBars(run.symbol, run.timeframe, fromT, toT);
  return NextResponse.json(bars);
}
