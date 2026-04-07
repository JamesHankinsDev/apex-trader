"use client";
import { useRef, useEffect } from "react";
import { createChart, ColorType, CrosshairMode, LineSeries } from "lightweight-charts";
import styles from "../page.module.css";

const BOT_COLORS = {
  main: "#00ff88",
  exp1: "#4488ff",
  exp2: "#ff9900",
};

const BOT_LABELS = {
  main: "Main Bot",
  exp1: "Experiment 1",
  exp2: "Experiment 2",
};

// Convert [{t: unix_ms, v: number}] to [{time: unix_sec, value: number}]
// Normalized to % return from start value
function toReturnData(arr, startValue) {
  if (!arr || arr.length < 1 || !startValue || startValue <= 0) return [];
  const seen = new Set();
  return arr
    .map((d) => ({
      time: Math.floor(d.t / 1000),
      value: ((d.v - startValue) / startValue) * 100,
    }))
    .filter((d) => d.time > 0 && isFinite(d.value))
    .sort((a, b) => a.time - b.time)
    .filter((d) => {
      if (seen.has(d.time)) return false;
      seen.add(d.time);
      return true;
    });
}

export default function OverlayChart({ bots, period }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 220,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#667799",
        fontFamily: "Share Tech Mono, monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(26,26,46,0.6)" },
        horzLines: { color: "rgba(26,26,46,0.6)" },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: "rgba(68,136,255,0.3)", width: 1, labelBackgroundColor: "#1a1a2e" },
        horzLine: { color: "rgba(68,136,255,0.3)", width: 1, labelBackgroundColor: "#1a1a2e" },
      },
      rightPriceScale: {
        borderColor: "rgba(26,26,46,0.8)",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "rgba(26,26,46,0.8)",
        timeVisible: period === "1D",
        rightOffset: 2,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: false,
      handleScale: false,
    });
    chartRef.current = chart;

    // Zero line
    const zeroSeries = chart.addSeries(LineSeries, {
      color: "rgba(255,255,255,0.08)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    // Add each bot as a line
    for (const bot of bots) {
      const data = toReturnData(bot.equityHistory, bot.startValue);
      if (data.length < 2) continue;

      // Set zero line range from first bot's data
      if (zeroSeries.data?.length === 0 || !zeroSeries._hasData) {
        zeroSeries.setData([
          { time: data[0].time, value: 0 },
          { time: data[data.length - 1].time, value: 0 },
        ]);
        zeroSeries._hasData = true;
      }

      const series = chart.addSeries(LineSeries, {
        color: BOT_COLORS[bot.key] || "#888",
        lineWidth: 2,
        crosshairMarkerRadius: 3,
        crosshairMarkerBorderColor: BOT_COLORS[bot.key],
        crosshairMarkerBackgroundColor: BOT_COLORS[bot.key],
        priceFormat: { type: "custom", formatter: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` },
        title: BOT_LABELS[bot.key],
        lastValueVisible: true,
        priceLineVisible: false,
      });
      series.setData(data);
    }

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [bots, period]);

  return (
    <div style={{ padding: "0 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
        <span className={styles.chartLabel} style={{ marginBottom: 0 }}>ALL BOTS — RETURN %</span>
        <div style={{ display: "flex", gap: 12, marginLeft: "auto" }}>
          {Object.entries(BOT_LABELS).map(([key, label]) => (
            <span key={key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontFamily: "var(--font-mono)" }}>
              <span style={{ width: 10, height: 3, background: BOT_COLORS[key], display: "inline-block", borderRadius: 1 }} />
              <span style={{ color: "var(--dim)" }}>{label}</span>
            </span>
          ))}
        </div>
      </div>
      <div ref={containerRef} style={{ width: "100%", minHeight: 220 }} />
    </div>
  );
}
