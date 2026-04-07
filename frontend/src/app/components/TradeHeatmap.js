"use client";
import { useRef, useEffect } from "react";
import styles from "../page.module.css";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS_LABELS = ["12a", "", "", "3a", "", "", "6a", "", "", "9a", "", "", "12p", "", "", "3p", "", "", "6p", "", "", "9p", "", ""];

export default function TradeHeatmap({ scalpLog }) {
  const canvasRef = useRef(null);
  const trades = scalpLog?.recentTrades || [];
  const snapshots = scalpLog?.featureSnapshots || [];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Combine trades and snapshots for time data
    const allEvents = [
      ...trades.map(t => ({ time: t.exitTime, pnl: t.pnlUsd, type: "trade" })),
      ...snapshots.map(s => ({ time: s.timestamp, pnl: null, type: "entry" })),
    ];

    if (allEvents.length < 3) return;

    const container = canvas.parentElement;
    const W = container.clientWidth - 4;
    const H = 140;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    // Build 7x24 grid (day x hour)
    const grid = Array(7).fill(null).map(() => Array(24).fill(null).map(() => ({ count: 0, wins: 0, pnl: 0 })));

    for (const evt of allEvents) {
      if (!evt.time) continue;
      const d = new Date(evt.time);
      const day = d.getUTCDay();
      const hour = d.getUTCHours();
      grid[day][hour].count++;
      if (evt.pnl != null) {
        if (evt.pnl > 0) grid[day][hour].wins++;
        grid[day][hour].pnl += evt.pnl;
      }
    }

    const maxCount = Math.max(...grid.flat().map(c => c.count), 1);

    const PAD_LEFT = 32;
    const PAD_TOP = 14;
    const cellW = (W - PAD_LEFT - 4) / 24;
    const cellH = (H - PAD_TOP - 16) / 7;

    // Hour labels
    ctx.fillStyle = "#555577";
    ctx.font = "8px Share Tech Mono, monospace";
    ctx.textAlign = "center";
    for (let h = 0; h < 24; h++) {
      if (HOURS_LABELS[h]) {
        ctx.fillText(HOURS_LABELS[h], PAD_LEFT + h * cellW + cellW / 2, 10);
      }
    }

    // Day labels + cells
    for (let d = 0; d < 7; d++) {
      const y = PAD_TOP + d * cellH;

      // Day label
      ctx.fillStyle = "#555577";
      ctx.font = "9px Share Tech Mono, monospace";
      ctx.textAlign = "right";
      ctx.fillText(DAYS[d], PAD_LEFT - 4, y + cellH / 2 + 3);

      for (let h = 0; h < 24; h++) {
        const x = PAD_LEFT + h * cellW;
        const cell = grid[d][h];

        if (cell.count === 0) {
          // Empty cell
          ctx.fillStyle = "rgba(26,26,46,0.4)";
        } else {
          // Intensity based on count, color based on P&L
          const intensity = Math.min(1, cell.count / maxCount);
          const alpha = 0.15 + intensity * 0.7;
          if (cell.pnl >= 0) {
            ctx.fillStyle = `rgba(0,255,136,${alpha})`;
          } else {
            ctx.fillStyle = `rgba(255,51,85,${alpha})`;
          }
        }

        ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);

        // Show count in cell if it has trades
        if (cell.count > 0 && cellW > 14) {
          ctx.fillStyle = `rgba(255,255,255,${0.4 + (cell.count / maxCount) * 0.4})`;
          ctx.font = "8px Share Tech Mono, monospace";
          ctx.textAlign = "center";
          ctx.fillText(cell.count, x + cellW / 2, y + cellH / 2 + 3);
        }
      }
    }

    ctx.textAlign = "start";
  }, [trades, snapshots]);

  if (trades.length < 3 && snapshots.length < 3) return null;

  return (
    <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
        <span className={styles.chartLabel} style={{ marginBottom: 0 }}>TRADE ACTIVITY (UTC)</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--dim)" }}>
          Green = net profitable hours \u00B7 Red = net losing hours \u00B7 Brighter = more trades
        </span>
      </div>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%" }} />
    </div>
  );
}
