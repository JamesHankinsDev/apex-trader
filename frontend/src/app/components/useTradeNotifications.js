"use client";
import { useEffect, useRef, useCallback } from "react";
import { fmt$ } from "./helpers";

const BOT_NAMES = { main: "Exp 1", exp1: "Exp 2", exp2: "Exp 3" };

/**
 * Hook that fires browser notifications when trades are detected.
 * Compares the latest trade in each bot's status against the previous poll.
 * Only fires after the first poll cycle (doesn't notify on page load).
 */
export default function useTradeNotifications(statuses) {
  const prevTradesRef = useRef({});
  const initialized = useRef(false);

  const notify = useCallback((title, body, tag) => {
    if (typeof window === "undefined") return;
    if (Notification.permission !== "granted") return;

    try {
      new Notification(title, {
        body,
        icon: "/icon.svg",
        badge: "/icon.svg",
        tag, // prevents duplicate notifications for the same event
        silent: false,
      });
    } catch {
      // Notification API not available (e.g. some mobile browsers)
    }
  }, []);

  useEffect(() => {
    if (!statuses || statuses.length === 0) return;

    for (const { key, status } of statuses) {
      if (!status?.trades || status.trades.length === 0) continue;

      const latestTrade = status.trades[0]; // trades are newest-first
      const prevLatest = prevTradesRef.current[key];

      // Skip first poll — don't notify for existing trades on page load
      if (!initialized.current) continue;

      // Compare by time + symbol + side to detect genuinely new trades
      if (prevLatest &&
          latestTrade.time === prevLatest.time &&
          latestTrade.symbol === prevLatest.symbol &&
          latestTrade.side === prevLatest.side) {
        continue; // Same trade, no notification
      }

      if (!prevLatest && !initialized.current) continue;

      const botName = BOT_NAMES[key] || key;
      const coin = latestTrade.symbol?.replace("/USD", "");

      if (latestTrade.side === "BUY") {
        notify(
          `${botName}: Bought ${coin}`,
          `Entry @ ${fmt$(latestTrade.price)} | ${fmt$(latestTrade.notional)}`,
          `${key}-buy-${latestTrade.time}`
        );
      } else if (latestTrade.side === "SELL") {
        const pnlStr = latestTrade.pnl != null
          ? `${latestTrade.pnl >= 0 ? "+" : ""}${fmt$(latestTrade.pnl)}`
          : "";
        const icon = latestTrade.pnl >= 0 ? "WIN" : "LOSS";
        notify(
          `${botName}: Sold ${coin} — ${icon}`,
          `Exit @ ${fmt$(latestTrade.price)}${pnlStr ? ` | P&L: ${pnlStr}` : ""}`,
          `${key}-sell-${latestTrade.time}`
        );
      }

      prevTradesRef.current[key] = latestTrade;
    }

    // After first full pass, mark as initialized
    if (!initialized.current) {
      for (const { key, status } of statuses) {
        if (status?.trades?.[0]) {
          prevTradesRef.current[key] = status.trades[0];
        }
      }
      initialized.current = true;
    }
  }, [statuses, notify]);
}

/**
 * Request notification permission. Call this from a user gesture (button click).
 * @returns {Promise<"granted"|"denied"|"default">}
 */
export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") return "granted";
  return Notification.requestPermission();
}

/**
 * Check current notification permission state.
 * @returns {"granted"|"denied"|"default"|"unsupported"}
 */
export function getNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}
