"use client";
import { useRef, useEffect } from "react";
import styles from "../page.module.css";

const BOT_COLORS = { main: "#00ff88", exp1: "#4488ff", exp2: "#ff9900" };

export default function PnlDistribution({ scalpLog }) {
  const canvasRef = useRef(null);
  const trades = scalpLog?.recentTrades || [];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || trades.length < 2) return;
    const container = canvas.parentElement;
    const W = container.clientWidth - 4;
    const H = 160;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    // Build histogram buckets
    const pnls = trades.map(t => t.pnlPct);
    const minPnl = Math.min(...pnls, -0.5);
    const maxPnl = Math.max(...pnls, 0.5);
    const bucketCount = Math.min(20, Math.max(8, Math.ceil(trades.length / 3)));
    const bucketSize = (maxPnl - minPnl) / bucketCount || 0.1;
    const buckets = Array(bucketCount).fill(null).map(() => ({ count: 0, wins: 0, losses: 0 }));

    for (const pnl of pnls) {
      let idx = Math.floor((pnl - minPnl) / bucketSize);
      if (idx >= bucketCount) idx = bucketCount - 1;
      if (idx < 0) idx = 0;
      buckets[idx].count++;
      if (pnl >= 0) buckets[idx].wins++;
      else buckets[idx].losses++;
    }

    const maxCount = Math.max(...buckets.map(b => b.count), 1);
    const PAD_LEFT = 30;
    const PAD_BOTTOM = 22;
    const PAD_TOP = 8;
    const chartW = W - PAD_LEFT - 8;
    const chartH = H - PAD_BOTTOM - PAD_TOP;
    const barW = chartW / bucketCount - 2;

    // Y-axis grid
    ctx.strokeStyle = "rgba(26,26,46,0.6)";
    ctx.lineWidth = 1;
    ctx.font = "9px Share Tech Mono, monospace";
    ctx.fillStyle = "#444466";
    for (let i = 0; i <= 3; i++) {
      const y = PAD_TOP + (i / 3) * chartH;
      ctx.beginPath();
      ctx.moveTo(PAD_LEFT, y);
      ctx.lineTo(W - 8, y);
      ctx.stroke();
      const val = Math.round(maxCount - (i / 3) * maxCount);
      ctx.fillText(val, 2, y + 4);
    }

    // Bars
    for (let i = 0; i < bucketCount; i++) {
      const b = buckets[i];
      if (b.count === 0) continue;
      const x = PAD_LEFT + i * (chartW / bucketCount) + 1;
      const h = (b.count / maxCount) * chartH;
      const y = PAD_TOP + chartH - h;
      const bucketMid = minPnl + (i + 0.5) * bucketSize;
      const color = bucketMid >= 0 ? "rgba(0,255,136,0.6)" : "rgba(255,51,85,0.6)";
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barW, h);
    }

    // X-axis labels
    ctx.fillStyle = "#555577";
    ctx.font = "9px Share Tech Mono, monospace";
    ctx.textAlign = "center";
    const labelCount = Math.min(5, bucketCount);
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.round((i / (labelCount - 1)) * (bucketCount - 1));
      const val = minPnl + (idx + 0.5) * bucketSize;
      const x = PAD_LEFT + idx * (chartW / bucketCount) + barW / 2;
      ctx.fillText(`${val >= 0 ? "+" : ""}${val.toFixed(2)}%`, x, H - 4);
    }

    // Zero line
    const zeroIdx = Math.floor((0 - minPnl) / bucketSize);
    if (zeroIdx >= 0 && zeroIdx < bucketCount) {
      const zeroX = PAD_LEFT + zeroIdx * (chartW / bucketCount);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(zeroX, PAD_TOP);
      ctx.lineTo(zeroX, PAD_TOP + chartH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.textAlign = "start";
  }, [trades]);

  if (trades.length < 2) return null;

  const wins = trades.filter(t => t.pnlUsd > 0).length;
  const avgPnl = trades.reduce((s, t) => s + t.pnlPct, 0) / trades.length;

  return (
    <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
        <span className={styles.chartLabel} style={{ marginBottom: 0 }}>P&L DISTRIBUTION</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--dim)" }}>
          {trades.length} scalps \u00B7 {((wins / trades.length) * 100).toFixed(0)}% WR \u00B7 avg {avgPnl >= 0 ? "+" : ""}{avgPnl.toFixed(3)}%
        </span>
      </div>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%" }} />
    </div>
  );
}
