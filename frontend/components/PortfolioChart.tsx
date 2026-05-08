'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  LineStyle,
  type IChartApi,
  type Time,
} from 'lightweight-charts';

interface EquityPoint {
  t: number;
  equity: number;
}

interface Props {
  curve: EquityPoint[];
  startingEquity: number;
  rebalanceIntervalMs: number | null;
}

// Renders portfolio equity curve with optional rebalance markers.
export default function PortfolioChart({
  curve,
  startingEquity,
  rebalanceIntervalMs,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!ref.current || curve.length === 0) return;

    chartRef.current?.remove();
    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,
      height: 360,
      layout: { background: { color: '#0b0e14' }, textColor: '#8492a6' },
      grid: {
        vertLines: { color: '#1e2430' },
        horzLines: { color: '#1e2430' },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: '#1e2430' },
    });
    chartRef.current = chart;

    const equitySeries = chart.addLineSeries({
      color: '#60a5fa',
      lineWidth: 2,
      title: 'Portfolio equity',
    });
    equitySeries.setData(
      curve.map(p => ({ time: (p.t / 1000) as Time, value: p.equity })),
    );

    // Horizontal line at starting equity for reference
    const baselineSeries = chart.addLineSeries({
      color: '#8492a6',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: 'Starting equity',
    });
    baselineSeries.setData(
      curve.map(p => ({ time: (p.t / 1000) as Time, value: startingEquity })),
    );

    // Rebalance markers — one vertical marker on the main series every N ms
    if (rebalanceIntervalMs !== null && curve.length > 0) {
      const firstT = curve[0]!.t;
      const markers: Array<{
        time: Time;
        position: 'aboveBar' | 'belowBar';
        color: string;
        shape: 'circle';
        text: string;
      }> = [];
      let next = firstT + rebalanceIntervalMs;
      for (const p of curve) {
        if (p.t >= next) {
          markers.push({
            time: (p.t / 1000) as Time,
            position: 'aboveBar',
            color: '#fbbf24',
            shape: 'circle',
            text: 'RB',
          });
          next += rebalanceIntervalMs;
        }
      }
      if (markers.length > 0) {
        equitySeries.setMarkers(markers);
      }
    }

    chart.timeScale().fitContent();

    const onResize = () => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [curve, startingEquity, rebalanceIntervalMs]);

  if (curve.length === 0) {
    return <div className="panel">No equity data available.</div>;
  }

  return (
    <div className="panel">
      <h2>Portfolio equity</h2>
      <div ref={ref} className="chart-container" style={{ height: 360 }} />
      {rebalanceIntervalMs !== null && (
        <div
          className="mono muted"
          style={{ fontSize: 11, marginTop: 8 }}
        >
          Yellow circles = rebalance events (every {Math.round(rebalanceIntervalMs / (24 * 60 * 60 * 1000))} days)
        </div>
      )}
    </div>
  );
}
