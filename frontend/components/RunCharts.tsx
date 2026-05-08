'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  LineStyle,
} from 'lightweight-charts';

interface Bar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface Trade {
  id: number;
  symbol: string;
  entryT: number;
  entryPrice: number;
  exitT: number;
  exitPrice: number;
  qty: number;
  entryReason: string | null;
  exitReason: string | null;
  pnlUsd: number;
  pnlPct: number;
  holdMs: number;
}

interface Props {
  runId: number;
  startingEquity: number;
}

export default function RunCharts({ runId, startingEquity }: Props) {
  const priceRef = useRef<HTMLDivElement>(null);
  const equityRef = useRef<HTMLDivElement>(null);
  const priceChartRef = useRef<IChartApi | null>(null);
  const equityChartRef = useRef<IChartApi | null>(null);
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'ready'; bars: Bar[]; trades: Trade[] } | { status: 'error'; msg: string }
  >({ status: 'loading' });

  useEffect(() => {
    async function load() {
      try {
        const [barsRes, tradesRes] = await Promise.all([
          fetch(`/api/runs/${runId}/bars`).then(r => r.json()),
          fetch(`/api/runs/${runId}/trades`).then(r => r.json()),
        ]);
        if (!Array.isArray(barsRes) || !Array.isArray(tradesRes)) {
          throw new Error('Unexpected response shape');
        }
        setState({ status: 'ready', bars: barsRes, trades: tradesRes });
      } catch (err) {
        setState({
          status: 'error',
          msg: err instanceof Error ? err.message : 'fetch failed',
        });
      }
    }
    load();
  }, [runId]);

  useEffect(() => {
    if (state.status !== 'ready') return;
    if (!priceRef.current || !equityRef.current) return;
    const { bars, trades } = state;
    if (bars.length === 0) return;

    const chartOpts = {
      width: priceRef.current.clientWidth,
      height: 320,
      layout: { background: { color: '#0b0e14' }, textColor: '#8492a6' },
      grid: {
        vertLines: { color: '#1e2430' },
        horzLines: { color: '#1e2430' },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: '#1e2430' },
    };

    // ── Price chart with trade markers ───────────────────────
    priceChartRef.current?.remove();
    const priceChart = createChart(priceRef.current, chartOpts);
    priceChartRef.current = priceChart;
    const candleSeries = priceChart.addCandlestickSeries({
      upColor: '#4ade80',
      downColor: '#f87171',
      wickUpColor: '#4ade80',
      wickDownColor: '#f87171',
      borderVisible: false,
    });
    candleSeries.setData(
      bars.map(b => ({
        time: (b.t / 1000) as Time,
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
      })),
    );
    const markers: Array<{
      time: Time;
      position: 'aboveBar' | 'belowBar';
      color: string;
      shape: 'arrowUp' | 'arrowDown';
      text: string;
    }> = [];
    for (const t of trades) {
      markers.push({
        time: (t.entryT / 1000) as Time,
        position: 'belowBar',
        color: '#4ade80',
        shape: 'arrowUp',
        text: 'IN',
      });
      markers.push({
        time: (t.exitT / 1000) as Time,
        position: 'aboveBar',
        color: t.pnlPct >= 0 ? '#60a5fa' : '#f87171',
        shape: 'arrowDown',
        text: `OUT ${t.pnlPct >= 0 ? '+' : ''}${t.pnlPct.toFixed(1)}%`,
      });
    }
    markers.sort((a, b) => Number(a.time) - Number(b.time));
    candleSeries.setMarkers(markers);

    // ── Equity curve reconstructed from trades + bars ────────
    equityChartRef.current?.remove();
    const equityChart = createChart(equityRef.current, chartOpts);
    equityChartRef.current = equityChart;
    const equitySeries = equityChart.addLineSeries({
      color: '#60a5fa',
      lineWidth: 2,
    });
    const bhSeries = equityChart.addLineSeries({
      color: '#8492a6',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
    });

    const points = reconstructEquity(bars, trades, startingEquity);
    equitySeries.setData(points.strategy);
    bhSeries.setData(points.buyHold);

    priceChart.timeScale().fitContent();
    equityChart.timeScale().fitContent();

    const onResize = () => {
      if (priceRef.current)
        priceChart.applyOptions({ width: priceRef.current.clientWidth });
      if (equityRef.current)
        equityChart.applyOptions({ width: equityRef.current.clientWidth });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      priceChart.remove();
      equityChart.remove();
      priceChartRef.current = null;
      equityChartRef.current = null;
    };
  }, [state, startingEquity]);

  if (state.status === 'loading') {
    return <div className="panel">Loading charts...</div>;
  }
  if (state.status === 'error') {
    return <div className="panel">Error: {state.msg}</div>;
  }

  return (
    <>
      <div className="panel">
        <h2>Price &amp; trade markers</h2>
        <div ref={priceRef} className="chart-container" />
      </div>
      <div className="panel">
        <h2>Equity curve vs buy-and-hold</h2>
        <div ref={equityRef} className="chart-container" />
        <div className="mono muted" style={{ fontSize: '11px', marginTop: 8 }}>
          Blue solid = strategy equity. Grey dashed = buy-and-hold from first bar.
        </div>
      </div>
    </>
  );
}

// Reconstruct equity curve from trades (which are entry+exit pairs).
// Mechanics: start with cash. When trade entry hits, convert cash to qty at
// entryPrice. While in position, equity = qty * bar.close. On exit, convert
// back to cash at exitPrice.
function reconstructEquity(
  bars: Bar[],
  trades: Trade[],
  startingEquity: number,
): { strategy: Array<{ time: Time; value: number }>; buyHold: Array<{ time: Time; value: number }> } {
  // Sort trades defensively by entryT
  const sorted = [...trades].sort((a, b) => a.entryT - b.entryT);
  let cash = startingEquity;
  let qty = 0;
  let nextTradeIdx = 0;
  const strategy: Array<{ time: Time; value: number }> = [];

  // Buy-and-hold baseline: buy at first bar's open with full equity
  const bh: Array<{ time: Time; value: number }> = [];
  const bhFirstBar = bars[0];
  const bhQty = bhFirstBar ? startingEquity / bhFirstBar.o : 0;

  for (const bar of bars) {
    // If an entry has occurred by this bar's time, convert cash → qty
    while (
      nextTradeIdx < sorted.length &&
      sorted[nextTradeIdx]!.entryT <= bar.t &&
      qty === 0
    ) {
      const t = sorted[nextTradeIdx]!;
      qty = t.qty;
      cash = cash - qty * t.entryPrice;
      // don't advance nextTradeIdx here — we match on exit below
      break;
    }

    // Current equity
    const mark = qty > 0 ? cash + qty * bar.c : cash;
    strategy.push({ time: (bar.t / 1000) as Time, value: mark });
    bh.push({ time: (bar.t / 1000) as Time, value: bhQty * bar.c });

    // If an exit has occurred by this bar's time, convert qty → cash
    if (
      nextTradeIdx < sorted.length &&
      sorted[nextTradeIdx]!.exitT <= bar.t &&
      qty > 0
    ) {
      const t = sorted[nextTradeIdx]!;
      cash = cash + qty * t.exitPrice;
      qty = 0;
      nextTradeIdx++;
    }
  }
  return { strategy, buyHold: bh };
}
