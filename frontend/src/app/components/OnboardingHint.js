"use client";
import { useState, useEffect } from "react";
import styles from "../page.module.css";

const HINTS = {
  signals: {
    icon: "\uD83D\uDCE1",
    text: "These are live market signals scanned every 60 seconds. Each coin gets a score based on technical indicators. Tap \"Details\" to see the raw numbers, or stay in simple mode for plain-English summaries.",
  },
  chart: {
    icon: "\uD83D\uDCC8",
    text: "This chart shows your portfolio value over time compared to three benchmarks: holding BTC, equal-weighting your watchlist, and market-cap weighting. If your line is above the dashed lines, the bot is outperforming passive strategies.",
  },
  regime: {
    icon: "\uD83C\uDF0D",
    text: "The market regime tells you what BTC is doing right now. The bot automatically switches between offensive (bull) and defensive (bear) strategies based on this. Tap the ? icons next to indicators to learn what they mean.",
  },
  positions: {
    icon: "\uD83D\uDCBC",
    text: "Open positions show your active trades with live P&L. Each has a stop loss (limits downside) and take profit target. You can manually sell any position with the SELL button.",
  },
  trades: {
    icon: "\uD83D\uDCCB",
    text: "Your trade history shows every buy and sell with WIN/LOSS tags. Hold duration shows how long each trade was open. The bot learns nothing from past trades — it follows fixed rules every time.",
  },
};

export default function OnboardingHint({ hintKey }) {
  const [dismissed, setDismissed] = useState(true); // Start hidden until we check localStorage

  useEffect(() => {
    const stored = localStorage.getItem(`hint_${hintKey}`);
    setDismissed(stored === "dismissed");
  }, [hintKey]);

  const dismiss = () => {
    localStorage.setItem(`hint_${hintKey}`, "dismissed");
    setDismissed(true);
  };

  if (dismissed) return null;
  const hint = HINTS[hintKey];
  if (!hint) return null;

  return (
    <div className={styles.onboardingHint}>
      <span className={styles.onboardingIcon}>{hint.icon}</span>
      <span>{hint.text}</span>
      <button className={styles.onboardingDismiss} onClick={dismiss}>GOT IT</button>
    </div>
  );
}

// Reset all hints (useful for testing)
export function resetOnboardingHints() {
  Object.keys(HINTS).forEach(key => localStorage.removeItem(`hint_${key}`));
}
