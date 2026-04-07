"use client";
import { useRef, useEffect } from "react";

export default function WeeklyChart({ snapshots }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshots?.length) return;
    const container = canvas.parentElement;
    const W = container.clientWidth - 8;
    const H = 100;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    const bots = [
      { key: "main", color: "#00ff88", label: "Main" },
      { key: "exp1", color: "#4488ff", label: "Exp1" },
      { key: "exp2", color: "#ff9900", label: "Exp2" },
    ];

    const allVals = [];
    for (const b of bots) {
      for (const s of snapshots) {
        if (s[b.key]?.totalReturnPct != null) allVals.push(s[b.key].totalReturnPct);
      }
    }
    if (allVals.length === 0) return;

    const minV = Math.min(0, ...allVals) - 1;
    const maxV = Math.max(0, ...allVals) + 1;
    const range = maxV - minV || 1;
    const toY = (v) => H - ((v - minV) / range) * H;
    const toX = (i) => snapshots.length > 1 ? (i / (snapshots.length - 1)) * W : W / 2;

    // Zero line
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, toY(0));
    ctx.lineTo(W, toY(0));
    ctx.stroke();
    ctx.setLineDash([]);

    for (const b of bots) {
      const pts = snapshots.map((s) => s[b.key]?.totalReturnPct ?? 0);
      ctx.beginPath();
      pts.forEach((v, i) => (i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v))));
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      if (pts.length > 0) {
        const lastI = pts.length - 1;
        ctx.beginPath();
        ctx.arc(toX(lastI), toY(pts[lastI]), 3, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
      }
    }

    let lx = 8;
    ctx.font = "10px Share Tech Mono, monospace";
    for (const b of bots) {
      ctx.beginPath();
      ctx.moveTo(lx, 10);
      ctx.lineTo(lx + 14, 10);
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = b.color;
      ctx.fillText(b.label, lx + 18, 14);
      lx += 60;
    }
  }, [snapshots]);

  return <canvas ref={canvasRef} style={{ display: "block", width: "100%" }} />;
}
