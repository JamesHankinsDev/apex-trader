"use client";
import { useRef, useEffect } from "react";
import { createChart, ColorType, LineStyle, CrosshairMode, AreaSeries, LineSeries } from "lightweight-charts";
import { PERIODS } from "./helpers";

// Convert [{t: unix_ms, v: number}] to [{time: unix_sec, value: number}]
function toChartData(arr) {
  if (!arr || arr.length < 1) return [];
  // Dedupe by timestamp (lightweight-charts requires strictly increasing time)
  const seen = new Set();
  return arr
    .map((d) => ({ time: Math.floor(d.t / 1000), value: d.v }))
    .filter((d) => d.value > 0 && d.time > 0)
    .sort((a, b) => a.time - b.time)
    .filter((d) => {
      if (seen.has(d.time)) return false;
      seen.add(d.time);
      return true;
    });
}

export default function EquityChart({ data, startValue, equalHistory, mcapHistory, btcHistory, period }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(container, {
      width: container.clientWidth,
      height: Math.max(220, container.clientHeight || 280),
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
        vertLine: { color: "rgba(68,136,255,0.3)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1a1a2e" },
        horzLine: { color: "rgba(68,136,255,0.3)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1a1a2e" },
      },
      rightPriceScale: {
        borderColor: "rgba(26,26,46,0.8)",
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: "rgba(26,26,46,0.8)",
        timeVisible: !periodCfg.useDaily,
        secondsVisible: false,
        rightOffset: 2,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: false,
      handleScale: false,
    });

    chartRef.current = chart;

    const portfolioData = toChartData(data);
    const isUp = portfolioData.length >= 2
      ? portfolioData[portfolioData.length - 1].value >= portfolioData[0].value
      : true;
    const lineColor = isUp ? "#00ff88" : "#ff3355";
    const areaTopColor = isUp ? "rgba(0,255,136,0.2)" : "rgba(255,51,85,0.2)";
    const areaBottomColor = "rgba(0,0,0,0)";

    const isMobileChart = container.clientWidth < 500;
    const periodCfg = PERIODS[period] || PERIODS["1D"];

    // Portfolio area series (v5 API: chart.addSeries(AreaSeries, options))
    const portfolioSeries = chart.addSeries(AreaSeries, {
      lineColor,
      topColor: areaTopColor,
      bottomColor: areaBottomColor,
      lineWidth: 2,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: lineColor,
      crosshairMarkerBackgroundColor: lineColor,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
      title: isMobileChart ? "" : "Portfolio",
    });
    if (portfolioData.length > 0) portfolioSeries.setData(portfolioData);

    // Baseline price line
    if (startValue && startValue > 0) {
      portfolioSeries.createPriceLine({
        price: startValue,
        color: "rgba(68,136,255,0.35)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: !isMobileChart,
        title: isMobileChart ? "" : "Start",
      });
    }

    // Benchmark series
    const addBenchmark = (arr, color, title) => {
      const d = toChartData(arr);
      if (d.length < 2) return;
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        crosshairMarkerRadius: 3,
        crosshairMarkerBorderColor: color,
        crosshairMarkerBackgroundColor: color,
        priceFormat: { type: "price", precision: 2, minMove: 0.01 },
        title: isMobileChart ? "" : title,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      series.setData(d);
    };

    addBenchmark(btcHistory, "rgba(255,153,0,0.7)", "BTC Hold");
    addBenchmark(equalHistory, "rgba(255,204,0,0.7)", "Equal Wt");
    addBenchmark(mcapHistory, "rgba(168,85,247,0.7)", "Mcap Wt");

    // Fit content
    chart.timeScale().fitContent();

    // Responsive resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          chart.applyOptions({ width });
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data, startValue, equalHistory, mcapHistory, btcHistory, period]);

  return <div ref={containerRef} style={{ width: "100%", minHeight: 220 }} />;
}
