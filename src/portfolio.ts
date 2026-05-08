// Portfolio: tracks cash, open positions, and closed trades. Applies signals
// with a spread cost model so backtests reflect realistic fills.
//
// Execution convention: the caller provides a fill price per action. The
// backtester uses the *next* bar's open to avoid look-ahead bias.

import type { Position, SpreadModel, Trade } from './types.js';
import { defaultSpreadModel } from './spread.js';

export class Portfolio {
  cash: number;
  positions = new Map<string, Position>();
  trades: Trade[] = [];
  // Most recently closed trade per symbol, for cooldown logic in strategies.
  lastTradeBySymbol = new Map<string, Trade>();

  private readonly spreads: SpreadModel;

  constructor(startingCash: number, spreads: SpreadModel = defaultSpreadModel) {
    this.cash = startingCash;
    this.spreads = spreads;
  }

  // Mark-to-market equity given current prices per symbol.
  equity(prices: Map<string, number>): number {
    let value = this.cash;
    for (const p of this.positions.values()) {
      const mark = prices.get(p.symbol) ?? p.entryPrice;
      value += p.qty * mark;
    }
    return value;
  }

  getPosition(symbol: string): Position | null {
    return this.positions.get(symbol) ?? null;
  }

  // Enter a new long position. sizeUsd is the intended allocation before spread.
  // Returns the position if the fill succeeded (cash available), else null.
  enter(args: {
    symbol: string;
    sizeUsd: number;
    fillPrice: number;
    t: number;
    reason: string;
    stopLoss?: number;
    takeProfit?: number;
  }): Position | null {
    const { symbol, sizeUsd, fillPrice, t, reason, stopLoss, takeProfit } = args;
    if (this.positions.has(symbol)) return null; // already long
    if (sizeUsd <= 0 || fillPrice <= 0) return null;

    const sideSpread = this.spreads.forSymbol(symbol);
    const effectivePrice = fillPrice * (1 + sideSpread); // pay the ask
    const allocation = Math.min(sizeUsd, this.cash);
    if (allocation <= 0) return null;

    const qty = allocation / effectivePrice;
    this.cash -= allocation;
    const position: Position = {
      symbol,
      qty,
      entryPrice: effectivePrice,
      entryT: t,
      entryReason: reason,
      costBasisUsd: allocation,
      stopLoss,
      takeProfit,
    };
    this.positions.set(symbol, position);
    return position;
  }

  // Close an existing position. Returns the Trade if successful, else null.
  exit(args: {
    symbol: string;
    fillPrice: number;
    t: number;
    reason: string;
  }): Trade | null {
    const { symbol, fillPrice, t, reason } = args;
    const position = this.positions.get(symbol);
    if (!position) return null;

    const sideSpread = this.spreads.forSymbol(symbol);
    const effectivePrice = fillPrice * (1 - sideSpread); // receive the bid
    const proceeds = position.qty * effectivePrice;
    this.cash += proceeds;
    this.positions.delete(symbol);

    const pnlUsd = proceeds - position.costBasisUsd;
    const pnlPct = (pnlUsd / position.costBasisUsd) * 100;
    const trade: Trade = {
      symbol,
      entryT: position.entryT,
      entryPrice: position.entryPrice,
      exitT: t,
      exitPrice: effectivePrice,
      qty: position.qty,
      entryReason: position.entryReason,
      exitReason: reason,
      pnlUsd,
      pnlPct,
      holdMs: t - position.entryT,
    };
    this.trades.push(trade);
    this.lastTradeBySymbol.set(symbol, trade);
    return trade;
  }
}
