// RSI mean-reversion baseline strategy.
//
// Enter long when RSI is oversold AND price is below SMA20 (confirms we're
// buying a dip, not catching a falling knife into a new regime).
// Exit on RSI recovery OR stop loss OR take profit OR max hold.
//
// This is a deliberately simple reference strategy. Every future strategy
// should be compared against its backtest metrics as a floor.

import { rsi, sma } from '../indicators.js';
import type { Signal, Strategy, StrategyContext } from '../types.js';

const DEFAULTS = {
  rsiPeriod: 14,
  rsiBuy: 30,       // enter when RSI below this
  rsiExit: 55,      // exit when RSI climbs above this
  smaPeriod: 20,    // price must be below SMA(this) to enter
  stopLossPct: 2.0, // exit if position down this much
  takeProfitPct: 4.0, // exit if position up this much
  maxHoldBars: 48,  // exit after this many bars regardless
  cooldownBars: 6,  // bars to wait after a loss in this symbol
  allocationPctOfEquity: 95, // fraction of equity to allocate per entry
};

export const rsiMeanRevertStrategy: Strategy = {
  name: 'rsi-mean-revert',
  defaultParams: DEFAULTS,
  paramGrid: [
    { name: 'rsiBuy', values: [25, 30, 35] },
    { name: 'rsiExit', values: [50, 55, 60] },
    { name: 'stopLossPct', values: [2.0, 3.0] },
    { name: 'takeProfitPct', values: [3.0, 5.0] },
  ], // 3×3×2×2 = 36 combinations per window

  onBar(ctx: StrategyContext): Signal {
    const { bar, history, position, lastTrade, params, equity } = ctx;
    const closes = history.map(b => b.c);
    const currentRsi = rsi(closes, params.rsiPeriod!);
    const currentSma = sma(closes, params.smaPeriod!);

    const factors = [
      { name: 'rsi', value: +currentRsi.toFixed(2) },
      { name: 'price', value: bar.c },
      { name: 'sma', value: +currentSma.toFixed(4) },
    ];

    // ── Exit logic (when we have a position) ─────────────────
    if (position) {
      const pnlPct = ((bar.c - position.entryPrice) / position.entryPrice) * 100;
      const barsHeld = history.length - history.findIndex(b => b.t === position.entryT);
      factors.push(
        { name: 'pnl_pct', value: +pnlPct.toFixed(2) },
        { name: 'bars_held', value: barsHeld },
      );

      if (pnlPct <= -params.stopLossPct!) {
        return {
          action: 'exit',
          reason: `stop-loss at ${pnlPct.toFixed(2)}%`,
          factors,
        };
      }
      if (pnlPct >= params.takeProfitPct!) {
        return {
          action: 'exit',
          reason: `take-profit at ${pnlPct.toFixed(2)}%`,
          factors,
        };
      }
      if (currentRsi >= params.rsiExit!) {
        return {
          action: 'exit',
          reason: `RSI recovered to ${currentRsi.toFixed(1)}`,
          factors,
        };
      }
      if (barsHeld >= params.maxHoldBars!) {
        return {
          action: 'exit',
          reason: `max-hold ${barsHeld} bars`,
          factors,
        };
      }
      return { action: 'hold', reason: 'holding', factors };
    }

    // ── Cooldown after recent loss ───────────────────────────
    if (lastTrade && lastTrade.pnlUsd < 0) {
      const barsSinceExit = history.findIndex(b => b.t > lastTrade.exitT);
      const cooldownActive =
        barsSinceExit === -1 ||
        history.length - barsSinceExit < params.cooldownBars!;
      if (cooldownActive) {
        return {
          action: 'hold',
          reason: `cooldown after loss (${lastTrade.pnlPct.toFixed(2)}%)`,
          factors,
        };
      }
    }

    // ── Entry logic ──────────────────────────────────────────
    const rsiOversold = currentRsi < params.rsiBuy!;
    const belowSma = bar.c < currentSma;
    factors.push(
      { name: 'rsi_oversold', value: rsiOversold ? 1 : 0 },
      { name: 'below_sma', value: belowSma ? 1 : 0 },
    );

    if (rsiOversold && belowSma) {
      const sizeUsd = equity * (params.allocationPctOfEquity! / 100);
      // Intrabar stops: exit at these price levels the moment they're touched
      // rather than waiting for the next bar close. The bar-close checks above
      // still fire for non-stop exits (RSI recovery, max hold).
      const stopLoss = bar.c * (1 - params.stopLossPct! / 100);
      const takeProfit = bar.c * (1 + params.takeProfitPct! / 100);
      return {
        action: 'enter',
        sizeUsd,
        stopLoss,
        takeProfit,
        reason: `RSI ${currentRsi.toFixed(1)} oversold, price ${((bar.c / currentSma - 1) * 100).toFixed(2)}% below SMA${params.smaPeriod}`,
        factors,
      };
    }

    return { action: 'hold', reason: 'no setup', factors };
  },
};
